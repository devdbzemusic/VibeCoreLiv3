#pragma once
/**
 * VoiceMod.h — ADSR envelope + LFO for VibeCore Voice.
 *
 * Same design language as the Bass envelope/LFO (linear attack, exponential
 * decay/release; LFO with beat/bar sync via onBeat/onBar), implemented on
 * Voice-owned types so the modules stay decoupled (documented-API rule).
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "VoiceTypes.h"
#include <cmath>

namespace vibecore {

// ─── VoiceEnvelope ────────────────────────────────────────────────────────────

class VoiceEnvelope {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; recompute(); }
    void setParams(const VoiceADSR& p) noexcept { mParams = p; recompute(); }

    void noteOn(float velocity) noexcept {
        mState.velocity = 1.0f - mParams.velocityAmount * (1.0f - velocity);
        mState.stage = VoiceUnitState::Attack;
    }
    void noteOff() noexcept {
        if (mState.stage != VoiceUnitState::Idle)
            mState.stage = VoiceUnitState::Release;
    }
    void reset() noexcept { mState.reset(); }

    float process() noexcept {
        switch (mState.stage) {
        case VoiceUnitState::Attack:
            mState.value += mAttackInc;
            if (mState.value >= 1.0f) { mState.value = 1.0f; mState.stage = VoiceUnitState::Decay; }
            break;
        case VoiceUnitState::Decay:
            mState.value += (mParams.sustain - mState.value) * mDecayCoeff;
            if (mState.value - mParams.sustain < 0.001f) mState.stage = VoiceUnitState::Sustain;
            break;
        case VoiceUnitState::Sustain:
            mState.value = mParams.sustain;
            break;
        case VoiceUnitState::Release:
            mState.value += (0.0f - mState.value) * mReleaseCoeff;
            if (mState.value < 0.0005f) { mState.value = 0.0f; mState.stage = VoiceUnitState::Idle; }
            break;
        case VoiceUnitState::Idle:
        default:
            return 0.0f;
        }
        return mState.value * mState.velocity;
    }

    bool  isIdle()       const noexcept { return mState.stage == VoiceUnitState::Idle; }
    bool  isReleasing()  const noexcept { return mState.stage == VoiceUnitState::Release; }
    float currentValue() const noexcept { return mState.value * mState.velocity; }

private:
    void recompute() noexcept {
        const float sr = static_cast<float>(mSampleRate);
        mAttackInc    = mParams.attackMs  < 0.05f ? 1.0f : 1.0f / (mParams.attackMs  * 0.001f * sr);
        mDecayCoeff   = coeff(mParams.decayMs);
        mReleaseCoeff = coeff(mParams.releaseMs);
    }
    float coeff(float ms) const noexcept {
        if (ms < 0.05f) return 1.0f;
        return 1.0f - std::exp(-6.91f / (ms * 0.001f * static_cast<float>(mSampleRate)));
    }

    VoiceADSR     mParams = {};
    VoiceEnvState mState  = {};
    int           mSampleRate = 48000;
    float mAttackInc = 1.0f, mDecayCoeff = 0.01f, mReleaseCoeff = 0.01f;
};

// ─── VoiceLFO ─────────────────────────────────────────────────────────────────

class VoiceLFO {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; updateInc(); }
    void setDef(const VoiceLFODef& d) noexcept { mDef = d; updateInc(); }

    void noteOn() noexcept { if (mDef.retrigger) mState.phaseAccum = mDef.phase; }
    void reset()  noexcept { mState.reset(mDef.phase); }

    // Beat/Bar sync — called from VoiceNode::onBeat / onBar
    void syncBeat(double bpm) noexcept {
        if (mDef.sync != VoiceLFOSync::Beat) return;
        mState.phaseAccum = 0.0f;
        const float beatHz = static_cast<float>(bpm / 60.0);
        mState.phaseInc = beatHz / static_cast<float>(mSampleRate);
    }
    void syncBar(double bpm, int beatsPerBar) noexcept {
        if (mDef.sync != VoiceLFOSync::Bar) return;
        mState.phaseAccum = 0.0f;
        const float barHz = static_cast<float>(bpm / 60.0) / static_cast<float>(beatsPerBar < 1 ? 4 : beatsPerBar);
        mState.phaseInc = barHz / static_cast<float>(mSampleRate);
    }

    float process() noexcept {
        mState.phaseAccum += mState.phaseInc;
        if (mState.phaseAccum >= 1.0f) {
            mState.phaseAccum -= 1.0f;
            // Latch new sample & hold value on wrap (deterministic xorshift)
            mState.rng ^= mState.rng << 13; mState.rng ^= mState.rng >> 17; mState.rng ^= mState.rng << 5;
            mState.shValue = (static_cast<float>(mState.rng & 0xFFFFFF) / 8388608.0f) - 1.0f;
        }
        mState.value = shape() * mDef.depth;
        return mState.value;
    }

    float value() const noexcept { return mState.value; }

private:
    float shape() const noexcept {
        const float p = mState.phaseAccum;
        switch (mDef.shape) {
        case VoiceLFOShape::Sine:       return std::sin(6.2831853f * p);
        case VoiceLFOShape::Triangle:   return p < 0.5f ? 4.0f * p - 1.0f : 3.0f - 4.0f * p;
        case VoiceLFOShape::Saw:        return 2.0f * p - 1.0f;
        case VoiceLFOShape::Square:     return p < 0.5f ? 1.0f : -1.0f;
        case VoiceLFOShape::SampleHold: return mState.shValue;
        default:                        return 0.0f;
        }
    }
    void updateInc() noexcept {
        if (mDef.sync == VoiceLFOSync::Free)
            mState.phaseInc = mDef.rateHz / static_cast<float>(mSampleRate);
    }

    VoiceLFODef   mDef   = {};
    VoiceLFOState mState = {};
    int           mSampleRate = 48000;
};

} // namespace vibecore
