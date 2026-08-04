#include "VoiceUnit.h"

namespace vibecore {

static inline float noteToHz(float note) noexcept {
    return 440.0f * std::pow(2.0f, (note - 69.0f) / 12.0f);
}

void VoiceUnit::init(int sampleRate) noexcept {
    mSampleRate = sampleRate;
    for (auto& e : mEnv) e.setSampleRate(sampleRate);
    for (auto& l : mLfo) l.setSampleRate(sampleRate);
    kill();
    mKillGain = 0.0f;
    mActive = false;
    mKilling = false;
}

void VoiceUnit::applyParams(const VoiceParams& p) noexcept {
    mEnv[0].setParams(p.env0);
    mEnv[1].setParams(p.env1);
    mLfo[0].setDef(p.lfo0);
    mLfo[1].setDef(p.lfo1);
}

void VoiceUnit::noteOn(const VoiceTrigger& trig, const VoiceParams& p,
                       const VoiceSampleSlot& slot, float glideFromHz) noexcept {
    mMode     = p.mode;
    mNote     = trig.note;
    mVelocity = static_cast<float>(trig.velocity) / 127.0f;
    mAge      = 0;
    mStartDelay = trig.sampleOffset > 0 ? trig.sampleOffset : 0;
    mKilling  = false;
    mKillGain = 1.0f;
    mPlayMode = p.playMode;

    // Pitch target
    mTargetHz = noteToHz(static_cast<float>(trig.note));
    if (glideFromHz > 0.0f && p.glideMs > 0.5f) {
        mCurrentHz = glideFromHz;
        mGlideCoeff = 1.0f - std::exp(-6.91f / (p.glideMs * 0.001f * static_cast<float>(mSampleRate)));
    } else {
        mCurrentHz = mTargetHz;
        mGlideCoeff = 1.0f;
    }

    // Sample source (Sample / Instrument modes)
    if (p.mode == VoiceGlobalMode::Sample || p.mode == VoiceGlobalMode::Instrument) {
        if (slot.valid()) {
            mData    = slot.data;
            mLength  = slot.lengthFrames;
            // Global root-note override (VoiceParams) wins over per-slot root.
            const int32_t root = (p.rootNote > 0) ? p.rootNote : slot.rootNote;
            mRootHz  = noteToHz(static_cast<float>(root));
            mBaseInc = static_cast<double>(slot.sampleRate) / static_cast<double>(mSampleRate);

            // Slice start
            int32_t startFrame = 0;
            if (p.playMode == VoicePlayMode::Slice && trig.sliceIndex >= 0 &&
                trig.sliceIndex < slot.sliceCount) {
                startFrame = slot.sliceStart[trig.sliceIndex];
                mLoopStart = startFrame;
                mLoopEnd   = (trig.sliceIndex + 1 < slot.sliceCount)
                             ? slot.sliceStart[trig.sliceIndex + 1] : mLength;
            } else {
                mLoopStart = 0;
                mLoopEnd   = mLength;
            }
            mPlayPos = static_cast<double>(startFrame);
        } else {
            mData = nullptr;   // no sample loaded — unit stays silent but env runs
            mLength = 0;
        }
    } else {
        mData = nullptr;
        mLength = 0;
    }

    mEnv[0].noteOn(mVelocity);
    mEnv[1].noteOn(mVelocity);
    mLfo[0].noteOn();
    mLfo[1].noteOn();
    mActive = true;
    mHasPending = false;
}

void VoiceUnit::noteOnDeferred(const VoiceTrigger& trig,
                               const VoiceSampleSlot& slot) noexcept {
    mPendingTrig = trig;
    mPendingSlot = slot;
    mHasPending  = true;
    if (mActive) {
        mKilling = true;   // renderFrame starts the pending note when fade completes
    }
    // If inactive, the pool should have used noteOn directly; renderFrame's
    // idle path also promotes the pending note defensively.
}

void VoiceUnit::noteOff() noexcept {
    mEnv[0].noteOff();
    mEnv[1].noteOff();
}

void VoiceUnit::kill() noexcept {
    if (mActive) mKilling = true;   // 2 ms fade in renderFrame
    else { mEnv[0].reset(); mEnv[1].reset(); }
}

float VoiceUnit::readSample() noexcept {
    if (!mData || mLength <= 0) return 0.0f;

    if (mPlayPos >= static_cast<double>(mLoopEnd)) {
        if (mPlayMode == VoicePlayMode::Loop ||
            (mPlayMode == VoicePlayMode::Slice && false)) {
            mPlayPos = static_cast<double>(mLoopStart) +
                       (mPlayPos - static_cast<double>(mLoopEnd));
        } else {
            // One-shot / slice end: release the envelope so the tail is clean
            if (!mEnv[0].isReleasing() && !mEnv[0].isIdle()) noteOff();
            return 0.0f;
        }
    }

    const int32_t i0 = static_cast<int32_t>(mPlayPos);
    const float   fr = static_cast<float>(mPlayPos - static_cast<double>(i0));
    const float a = mData[i0];
    const float b = (i0 + 1 < mLength) ? mData[i0 + 1] : 0.0f;

    // Advance: base rate × pitch ratio (Instrument repitches from root)
    double inc = mBaseInc;
    if (mMode == VoiceGlobalMode::Instrument && mRootHz > 0.0f) {
        inc *= static_cast<double>(mCurrentHz / mRootHz);
    }
    mPlayPos += inc;

    return a + fr * (b - a);
}

float VoiceUnit::textureSample(const VoiceParams& p, float cutoffOffsetHz) noexcept {
    float cutoff = p.textureCutoffHz + cutoffOffsetHz;
    if (cutoff < 20.0f) cutoff = 20.0f;
    const float nyq = 0.45f * static_cast<float>(mSampleRate);
    if (cutoff > nyq) cutoff = nyq;

    // Recompute texture bandpass only when params changed
    if (cutoff != mTexCutoff || p.textureResonance != mTexRes) {
        mTexCutoff = cutoff;
        mTexRes    = p.textureResonance;
        const float q     = 0.5f + mTexRes * 8.0f;
        const float w0    = 6.2831853f * mTexCutoff / static_cast<float>(mSampleRate);
        const float alpha = std::sin(w0) / (2.0f * q);
        const float cw    = std::cos(w0);
        const float a0    = 1.0f + alpha;
        mTb0 =  alpha / a0; mTb1 = 0.0f; mTb2 = -alpha / a0;
        mTa1 = (-2.0f * cw) / a0; mTa2 = (1.0f - alpha) / a0;
    }

    mRng ^= mRng << 13; mRng ^= mRng >> 17; mRng ^= mRng << 5;
    const float n = (static_cast<float>(mRng & 0xFFFFFF) / 8388608.0f) - 1.0f;

    const float y = mTb0 * n + mTb1 * mTx1 + mTb2 * mTx2 - mTa1 * mTy1 - mTa2 * mTy2 + 1e-25f;
    mTx2 = mTx1; mTx1 = n;
    mTy2 = mTy1; mTy1 = y;
    return y;
}

float VoiceUnit::renderFrame(float& l, float& r, const VoiceParams& p,
                             const VoiceModValues& mod) noexcept {
    if (!mActive) {
        // Defensive: promote a pending note if the unit went idle before the
        // fade path could (e.g. envelope finished in the same buffer).
        if (mHasPending) {
            const VoiceTrigger t = mPendingTrig;
            mHasPending = false;
            noteOn(t, p, mPendingSlot, -1.0f);
        }
        return 0.0f;
    }

    // Sample-accurate start offset
    if (mStartDelay > 0) { --mStartDelay; return 0.0f; }

    ++mAge;

    // Glide
    mCurrentHz += (mTargetHz - mCurrentHz) * mGlideCoeff;

    // Modulators
    const float e0 = mEnv[0].process();
    mEnv[1].process();
    mLfo[0].process();
    mLfo[1].process();

    if (mEnv[0].isIdle()) { mActive = false; mKilling = false; return 0.0f; }

    // Source
    float s;
    if (mMode == VoiceGlobalMode::Texture) s = textureSample(p, mod.cutoffHz);
    else                                   s = readSample();

    float g = e0 * mVelocity * (1.0f - p.env0.velocityAmount * 0.0f);

    // Kill fade (2 ms) for click-free stealing / sample retirement
    if (mKilling) {
        mKillGain -= 1.0f / (0.002f * static_cast<float>(mSampleRate));
        if (mKillGain <= 0.0f) {
            mActive = false; mKilling = false;
            if (mHasPending) {
                // Steal-with-fade: begin the deferred note now, click-free.
                const VoiceTrigger t = mPendingTrig;
                mHasPending = false;
                noteOn(t, p, mPendingSlot, -1.0f);
            }
            return 0.0f;
        }
        g *= mKillGain;
    }

    const float out = s * g;
    l += out;
    r += out;
    return e0;
}

void VoiceUnit::accumulateMod(const VoiceParams& p, VoiceModValues& out) noexcept {
    if (!mActive) return;
    for (int i = 0; i < kVoiceModRoutes; ++i) {
        const VoiceModRoute& rt = p.modMatrix[i];
        if (!rt.active || rt.source == VoiceModSource::None ||
            rt.dest == VoiceModDest::None) continue;

        float src = 0.0f;
        switch (rt.source) {
        case VoiceModSource::Env1:        src = mEnv[0].currentValue(); break;
        case VoiceModSource::Env2:        src = mEnv[1].currentValue(); break;
        case VoiceModSource::LFO1:        src = mLfo[0].value();        break;
        case VoiceModSource::LFO2:        src = mLfo[1].value();        break;
        case VoiceModSource::Velocity:    src = mVelocity;              break;
        case VoiceModSource::KeyTracking: src = (static_cast<float>(mNote) - 60.0f) / 24.0f; break;
        case VoiceModSource::Macro1:      src = p.macro1;               break;
        case VoiceModSource::Macro2:      src = p.macro2;               break;
        default: break;
        }

        const float v = src * rt.amount;
        switch (rt.dest) {
        case VoiceModDest::Pitch:        out.pitchCents   += v * 100.0f;  break;
        case VoiceModDest::Formant:      out.formantSemis += v * 6.0f;    break;
        case VoiceModDest::Cutoff:       out.cutoffHz     += v * 4000.0f; break;
        case VoiceModDest::Volume:       out.volume       += v;           break;
        case VoiceModDest::Pan:          out.pan          += v;           break;
        case VoiceModDest::HarmonyLevel: out.harmonyLevel += v;           break;
        case VoiceModDest::BreathLevel:  out.breathLevel  += v;           break;
        case VoiceModDest::StereoWidth:  out.stereoWidth  += v;           break;
        default: break;
        }
    }
}

} // namespace vibecore
