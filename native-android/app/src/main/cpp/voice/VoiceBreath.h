#pragma once
/**
 * VoiceBreath.h — Breath / Noise / Air layer for VibeCore Voice.
 *
 * Deterministic xorshift32 noise → bandpass biquad ("color") → level.
 * Optionally gated by an external envelope value (amp env of active units,
 * or input envelope in Live mode) for natural breath behavior.
 *
 * Thread model: process on Audio Thread only.
 */

#include "VoiceTypes.h"
#include <cmath>

namespace vibecore {

class VoiceBreath {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; mDirty = true; }
    void setParams(const VoiceBreathParams& p) noexcept { mParams = p; mDirty = true; }
    void reset() noexcept {
        mX1 = mX2 = mY1 = mY2 = 0.0f;
        mRng = 0xBAD5EED1;
    }

    // Returns the breath sample to ADD to the mix (mono — caller spreads).
    // envGate: 0–1 external envelope (ignored if followEnv = false).
    float process(float envGate) noexcept {
        if (!mParams.enabled || mParams.level <= 0.0f) return 0.0f;
        if (mDirty) compute();

        // xorshift32 — deterministic, no rand() on Audio Thread
        mRng ^= mRng << 13; mRng ^= mRng >> 17; mRng ^= mRng << 5;
        const float n = (static_cast<float>(mRng & 0xFFFFFF) / 8388608.0f) - 1.0f;

        const float y = mB0 * n + mB1 * mX1 + mB2 * mX2 - mA1 * mY1 - mA2 * mY2 + 1e-25f;
        mX2 = mX1; mX1 = n;
        mY2 = mY1; mY1 = y;

        const float gate = mParams.followEnv ? envGate : 1.0f;
        return y * mParams.level * gate;
    }

private:
    void compute() noexcept {
        const float w0    = 6.2831853f * mParams.colorHz / static_cast<float>(mSampleRate);
        const float alpha = std::sin(w0) / (2.0f * (mParams.widthQ < 0.1f ? 0.1f : mParams.widthQ));
        const float cw    = std::cos(w0);
        const float a0    = 1.0f + alpha;
        mB0 =  alpha / a0;
        mB1 =  0.0f;
        mB2 = -alpha / a0;
        mA1 = (-2.0f * cw) / a0;
        mA2 = (1.0f - alpha) / a0;
        mDirty = false;
    }

    VoiceBreathParams mParams = {};
    int      mSampleRate = 48000;
    bool     mDirty = true;
    uint32_t mRng   = 0xBAD5EED1;
    float    mB0 = 0, mB1 = 0, mB2 = 0, mA1 = 0, mA2 = 0;
    float    mX1 = 0, mX2 = 0, mY1 = 0, mY2 = 0;
};

} // namespace vibecore
