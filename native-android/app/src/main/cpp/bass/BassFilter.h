#pragma once
/**
 * BassFilter.h — Biquad filter with LP/HP/BP/Notch for VibeCore 3D Bass.
 *
 * Design: Direct Form 2 biquad for numerical stability.
 * Anti-denormal: FTZ via small bias constant technique.
 * Coefficient computation: on UI/command thread (CPU-safe), applied on Audio Thread.
 * Stereo: dual filter states (L/R), same coefficients.
 * Drive: soft-clipping tanh(x) before filter stage.
 *
 * Thread model: computeCoefficients() on Audio Thread ONLY (called from BassVoicePool
 * when a SetCutoff/SetResonance command is processed).
 * process() on Audio Thread ONLY.
 */

#include "BassTypes.h"
#include <cmath>

namespace vibecore {

class BassFilter {
public:
    void setType      (BassFilterType type) noexcept { mType = type; }
    void setCutoff    (float hz)            noexcept { mCutoffHz = hz; mDirty = true; }
    void setResonance (float q)             noexcept { mResonance = q;  mDirty = true; }
    void setDrive     (float d)             noexcept { mDrive = d; }
    void setSampleRate(int sr)              noexcept { mSampleRate = sr; mDirty = true; }

    // Recompute biquad coefficients. Call when dirty = true.
    // Safe to call on Audio Thread (pure arithmetic, no alloc).
    void computeCoefficients() noexcept;

    bool isDirty() const noexcept { return mDirty; }

    // Process one stereo sample pair (in-place).
    void processStereo(float& l, float& r) noexcept;

    // Process one mono sample.
    float processMono(float x) noexcept;

    // Reset filter memory (voice reset).
    void reset() noexcept;

    // Apply modulation to cutoff in-place (for modulation matrix).
    void modulateCutoff(float deltaHz) noexcept {
        mCutoffHz = clampCutoff(mCutoffHz + deltaHz);
        mDirty = true;
    }

    float cutoffHz()   const noexcept { return mCutoffHz; }
    float resonance()  const noexcept { return mResonance; }

private:
    static constexpr float kDenormalOffset = 1e-25f; // anti-denormal bias

    float clampCutoff(float hz) const noexcept {
        return hz < 20.0f ? 20.0f : (hz > static_cast<float>(mSampleRate) * 0.499f
                                     ? static_cast<float>(mSampleRate) * 0.499f : hz);
    }

    BassFilterType  mType       = BassFilterType::Lowpass;
    float           mCutoffHz   = 8000.0f;
    float           mResonance  = 0.0f;   // 0–1 mapped to Q
    float           mDrive      = 0.0f;   // 0–1
    int             mSampleRate = 48000;
    bool            mDirty      = true;

    BiqFilterCoeffs mCoeffs = {};
    BiqFilterState  mStateL = {};
    BiqFilterState  mStateR = {};
};

} // namespace vibecore
