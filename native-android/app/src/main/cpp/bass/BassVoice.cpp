#include "BassVoice.h"
#include <cmath>

namespace vibecore {

static constexpr float kTwoPi    = 6.28318530718f;
static constexpr float kA4Hz     = 440.0f;
static constexpr int   kA4MIDI   = 69;

// ─── Init ─────────────────────────────────────────────────────────────────────

void BassVoiceImpl::init(const BassWavetable* wt, int sampleRate) {
    mWavetable  = wt;
    mSampleRate = sampleRate;
    for (auto& e : mEnvs) e.setSampleRate(sampleRate);
    for (auto& l : mLFOs) l.setSampleRate(sampleRate);
    mFilter.setSampleRate(sampleRate);
}

// ─── Note → Hz ────────────────────────────────────────────────────────────────

float BassVoiceImpl::midiNoteToHz(uint8_t note, float detuneCents) noexcept {
    const float semitones = static_cast<float>(note) - static_cast<float>(kA4MIDI)
                          + detuneCents / 100.0f;
    return kA4Hz * std::pow(2.0f, semitones / 12.0f);
}

// ─── Reset ────────────────────────────────────────────────────────────────────

void BassVoiceImpl::reset() noexcept {
    mVoiceData.reset();
    mFilter.reset();
    for (auto& e : mEnvs) e.reset();
    for (auto& l : mLFOs) l.reset();
    mReleaseTriggered = false;
}

// ─── NoteOn ───────────────────────────────────────────────────────────────────

void BassVoiceImpl::noteOn(const BassTrigger& trig, const BassParams& params) noexcept {
    const float vel = static_cast<float>(trig.velocity) / 127.0f;

    mVoiceData.note     = trig.note;
    mVoiceData.velocity = trig.velocity;
    mVoiceData.state    = BassVoiceState::Attack;
    mVoiceData.ageFrames= 0;
    mVoiceData.morphPos = params.morphPos;
    mReleaseTriggered   = false;

    // Compute target pitch
    const float detuneTotal = params.detune + params.semi * 100.0f + params.fine;
    mVoiceData.targetPitch  = midiNoteToHz(trig.note, detuneTotal)
                            * std::pow(2.0f, params.octave);

    // Glide from previous pitch
    if (trig.glideFromPitch > 0.0f && params.glideMs > 1.0f) {
        mVoiceData.currentPitch = trig.glideFromPitch;
        // Compute per-sample multiplicative factor toward target
        const float samplesGlide = params.glideMs * 0.001f * static_cast<float>(mSampleRate);
        mVoiceData.glideCoeff = std::pow(
            mVoiceData.targetPitch / (mVoiceData.currentPitch > 0.1f ? mVoiceData.currentPitch : mVoiceData.targetPitch),
            1.0f / samplesGlide
        );
    } else {
        mVoiceData.currentPitch = mVoiceData.targetPitch;
        mVoiceData.glideCoeff   = 1.0f;
    }

    // Set phase inc for current pitch
    mVoiceData.phaseInc = mWavetable->phaseIncrement(mVoiceData.currentPitch);

    // Apply envelope / filter params before starting
    applyFilterParams(params);
    applyEnvParams(params);
    applyLFOParams(params);

    // Trigger envelopes
    mEnvs[0].noteOn(vel);
    mEnvs[1].noteOn(vel);

    // Trigger LFOs (retrigger if configured)
    for (auto& l : mLFOs) l.noteOn();
}

// ─── NoteOff ──────────────────────────────────────────────────────────────────

void BassVoiceImpl::noteOff(int32_t /*sampleOffset*/) noexcept {
    if (mReleaseTriggered) return;
    mReleaseTriggered = true;
    mEnvs[0].noteOff();
    mEnvs[1].noteOff();
    mVoiceData.state = BassVoiceState::Release;
}

void BassVoiceImpl::forceOff() noexcept {
    mVoiceData.reset();
    for (auto& e : mEnvs) e.reset();
    for (auto& l : mLFOs) l.reset();
    mFilter.reset();
    mReleaseTriggered = false;
}

// ─── Apply parameters ─────────────────────────────────────────────────────────

void BassVoiceImpl::applyFilterParams(const BassParams& params) noexcept {
    mFilter.setType     (params.filterType);
    mFilter.setCutoff   (params.cutoffHz);
    mFilter.setResonance(params.resonance);
    mFilter.setDrive    (params.filterDrive);
}

void BassVoiceImpl::applyEnvParams(const BassParams& params) noexcept {
    mEnvs[0].setParams(params.env0);
    mEnvs[1].setParams(params.env1);
}

void BassVoiceImpl::applyLFOParams(const BassParams& params) noexcept {
    mLFOs[0].setDef(params.lfo0);
    mLFOs[1].setDef(params.lfo1);
}

// ─── Modulation matrix ────────────────────────────────────────────────────────
// Fills an array indexed by BassModDest with accumulated modulation values.

void BassVoiceImpl::applyModMatrix(float modDeltas[8], const BassParams& params) noexcept {
    // Zero out
    for (int i = 0; i < 8; ++i) modDeltas[i] = 0.0f;

    for (int r = 0; r < kBassModRoutes; ++r) {
        const BassModRoute& route = params.modMatrix[r];
        if (!route.active || route.source == BassModSource::None
                          || route.dest   == BassModDest::None) continue;

        float sourceVal = 0.0f;
        switch (route.source) {
        case BassModSource::Env1:        sourceVal = mEnvs[1].currentValue(); break;
        case BassModSource::Env2:        sourceVal = mEnvs[0].currentValue(); break;
        case BassModSource::LFO1:        sourceVal = mLFOs[0].value(); break;
        case BassModSource::LFO2:        sourceVal = mLFOs[1].value(); break;
        case BassModSource::Velocity:    sourceVal = static_cast<float>(mVoiceData.velocity) / 127.0f; break;
        case BassModSource::KeyTracking: sourceVal = (static_cast<float>(mVoiceData.note) - 60.0f) / 64.0f; break;
        default: break;
        }

        const int destIdx = static_cast<int>(route.dest);
        if (destIdx < 8) {
            modDeltas[destIdx] += sourceVal * route.amount;
        }
    }
}

// ─── Render ───────────────────────────────────────────────────────────────────

void BassVoiceImpl::renderFrame(float& outL, float& outR, const BassParams& params) noexcept {
    if (!mVoiceData.isActive() && mEnvs[0].isIdle()) {
        // Voice fully silent — mark idle
        mVoiceData.state = BassVoiceState::Idle;
        outL = outR = 0.0f;
        return;
    }

    // ── Advance age ──────────────────────────────────────────────────────────
    ++mVoiceData.ageFrames;

    // ── Advance envelopes ────────────────────────────────────────────────────
    const float env0 = mEnvs[0].process();
    const float env1 = mEnvs[1].process();

    // ── Advance LFOs ─────────────────────────────────────────────────────────
    const float lfo0 = mLFOs[0].process();
    const float lfo1 = mLFOs[1].process();
    (void)lfo1;  // used via mod matrix

    // ── Modulation matrix ────────────────────────────────────────────────────
    float modDeltas[8] = {};
    applyModMatrix(modDeltas, params);

    // ── Glide ─────────────────────────────────────────────────────────────────
    if (std::fabs(mVoiceData.currentPitch - mVoiceData.targetPitch) > 0.01f) {
        mVoiceData.currentPitch *= mVoiceData.glideCoeff;
        // Clamp to prevent overshoot
        if ((mVoiceData.glideCoeff > 1.0f && mVoiceData.currentPitch > mVoiceData.targetPitch) ||
            (mVoiceData.glideCoeff < 1.0f && mVoiceData.currentPitch < mVoiceData.targetPitch)) {
            mVoiceData.currentPitch = mVoiceData.targetPitch;
        }
    } else {
        mVoiceData.currentPitch = mVoiceData.targetPitch;
    }

    // ── Pitch modulation ─────────────────────────────────────────────────────
    // modDeltas[Pitch] is in cents
    float pitchMod = mVoiceData.currentPitch;
    if (modDeltas[static_cast<int>(BassModDest::Pitch)] != 0.0f) {
        pitchMod *= std::pow(2.0f, modDeltas[static_cast<int>(BassModDest::Pitch)] / 1200.0f);
    }
    // Also apply LFO0 to pitch (hardwired vibrato path as convenience)
    if (params.lfo0.depth > 0.001f && params.modMatrix[0].source == BassModSource::None) {
        // Default: LFO0 → pitch 50 cents when no route configured
        // (only active if no explicit route overrides)
    }

    mVoiceData.phaseInc = mWavetable->phaseIncrement(pitchMod);

    // ── Wavetable synthesis ───────────────────────────────────────────────────
    // Apply morph modulation
    float morphMod = params.morphPos + modDeltas[static_cast<int>(BassModDest::WavePos)];
    if (morphMod < 0.0f) morphMod = 0.0f;
    if (morphMod > static_cast<float>(kNumBuiltinWavetables - 1))
        morphMod = static_cast<float>(kNumBuiltinWavetables - 1);

    const float sample = mWavetable->render(mVoiceData.phaseAccum, morphMod, pitchMod);

    // ── Advance phase ─────────────────────────────────────────────────────────
    mVoiceData.phaseAccum += mVoiceData.phaseInc;
    if (mVoiceData.phaseAccum >= kWavetableSize)
        mVoiceData.phaseAccum -= kWavetableSize;

    // ── Amplitude ─────────────────────────────────────────────────────────────
    float ampMod = modDeltas[static_cast<int>(BassModDest::Volume)];
    const float gain = (env0 + ampMod) * params.volume;

    float s = sample * gain;

    // ── Filter ────────────────────────────────────────────────────────────────
    // Apply cutoff modulation
    float cutoffMod = modDeltas[static_cast<int>(BassModDest::Cutoff)];
    if (cutoffMod != 0.0f) mFilter.modulateCutoff(cutoffMod);
    if (mFilter.isDirty()) mFilter.computeCoefficients();

    float l = s, r = s;
    mFilter.processStereo(l, r);

    // ── Pan ───────────────────────────────────────────────────────────────────
    const float pan = params.pan + modDeltas[static_cast<int>(BassModDest::StereoWidth)];
    // Constant power pan law
    const float panR = (pan + 1.0f) * 0.5f;   // 0..1 right
    const float panL = 1.0f - panR;
    outL = l * panL;
    outR = r * panR;

    // ── Update voice state from envelope ─────────────────────────────────────
    if (mEnvs[0].isIdle()) {
        mVoiceData.state = BassVoiceState::Idle;
    } else if (!mReleaseTriggered) {
        mVoiceData.state = static_cast<BassVoiceState>(
            static_cast<uint8_t>(mEnvs[0].currentValue() > mEnvs[0].currentValue()
                ? BassVoiceState::Attack : BassVoiceState::Sustain));
    }
}

// ─── Tempo sync ────────────────────────────────────────────────────────────────

void BassVoiceImpl::onBeat(double bpm) noexcept {
    for (auto& l : mLFOs) l.syncBeat(bpm);
}

void BassVoiceImpl::onBar(double bpm, int beatsPerBar) noexcept {
    for (auto& l : mLFOs) l.syncBar(bpm, beatsPerBar);
}

} // namespace vibecore
