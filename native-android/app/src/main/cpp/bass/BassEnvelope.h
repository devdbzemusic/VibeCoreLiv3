#pragma once
/**
 * BassEnvelope.h — ADSR envelope for VibeCore 3D Bass.
 *
 * Design:
 *   · Exponential curves for attack/decay/release (natural feel).
 *   · Linear attack variant available via kLinearAttack.
 *   · Per-sample coefficient computation — no branches in inner loop.
 *   · noteOn() / noteOff() set transitions; process() advances state.
 *   · Velocity scaling: env value scaled by velocity at gate time.
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "BassTypes.h"
#include <cmath>

namespace vibecore {

class BassEnvelope {
public:
    static constexpr bool kLinearAttack = true; // linear attack, exp decay/release

    void setSampleRate(int sr) noexcept { mSampleRate = sr; }

    void setParams(const BassADSR& adsr) noexcept {
        mParams = adsr;
        // Recompute only needed coefficients
        recomputeCoeffs();
    }

    void setAttackMs (float ms) noexcept { mParams.attackMs  = ms; recomputeCoeffs(); }
    void setDecayMs  (float ms) noexcept { mParams.decayMs   = ms; recomputeCoeffs(); }
    void setSustain  (float s)  noexcept { mParams.sustain   = s; }
    void setReleaseMs(float ms) noexcept { mParams.releaseMs = ms; recomputeCoeffs(); }
    void setVelAmount(float a)  noexcept { mParams.velocityAmount = a; }

    void noteOn (float velocity) noexcept;
    void noteOff()               noexcept;
    void reset  ()               noexcept;

    // Advance and return next sample value (0–1).
    float process() noexcept;

    bool isIdle() const noexcept { return mState.stage == BassVoiceState::Idle; }
    float currentValue() const noexcept { return mState.value; }

private:
    static float timeToCoeff(float timeMs, int sampleRate) noexcept {
        if (timeMs < 1.0f) return 1.0f;
        return 1.0f - std::exp(-6.91f / (timeMs * 0.001f * static_cast<float>(sampleRate)));
    }

    void recomputeCoeffs() noexcept;

    BassADSR          mParams     = {};
    BassEnvelopeState mState      = {};
    int               mSampleRate = 48000;

    // Pre-computed per-sample coefficients
    float mAttackCoeff  = 1.0f;
    float mDecayCoeff   = 0.001f;
    float mReleaseCoeff = 0.001f;
};

} // namespace vibecore
