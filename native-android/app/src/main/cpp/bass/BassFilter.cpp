#include "BassFilter.h"

namespace vibecore {

static constexpr float kTwoPi = 6.28318530718f;

// ─── Coefficient computation ──────────────────────────────────────────────────
// Bilinear transform biquad design (RBJ cookbook, 1994).
// Q range: 0.1 (resonance=0) to 20 (resonance=1).

void BassFilter::computeCoefficients() noexcept {
    mDirty = false;

    const float hz = clampCutoff(mCutoffHz);
    const float sr = static_cast<float>(mSampleRate);
    // Map resonance [0,1] → Q [0.5, 20]
    const float Q  = 0.5f + mResonance * 19.5f;

    const float w0 = kTwoPi * hz / sr;
    const float cosW0 = std::cos(w0);
    const float sinW0 = std::sin(w0);
    const float alpha = sinW0 / (2.0f * Q);

    float b0, b1, b2, a0, a1, a2;

    switch (mType) {
    case BassFilterType::Lowpass:
        b0 = (1.0f - cosW0) * 0.5f;
        b1 =  1.0f - cosW0;
        b2 = (1.0f - cosW0) * 0.5f;
        a0 =  1.0f + alpha;
        a1 = -2.0f * cosW0;
        a2 =  1.0f - alpha;
        break;
    case BassFilterType::Highpass:
        b0 =  (1.0f + cosW0) * 0.5f;
        b1 = -(1.0f + cosW0);
        b2 =  (1.0f + cosW0) * 0.5f;
        a0 =   1.0f + alpha;
        a1 =  -2.0f * cosW0;
        a2 =   1.0f - alpha;
        break;
    case BassFilterType::Bandpass:
        b0 =  sinW0 * 0.5f;
        b1 =  0.0f;
        b2 = -sinW0 * 0.5f;
        a0 =  1.0f + alpha;
        a1 = -2.0f * cosW0;
        a2 =  1.0f - alpha;
        break;
    case BassFilterType::Notch:
    default:
        b0 =  1.0f;
        b1 = -2.0f * cosW0;
        b2 =  1.0f;
        a0 =  1.0f + alpha;
        a1 = -2.0f * cosW0;
        a2 =  1.0f - alpha;
        break;
    }

    // Normalize by a0
    const float a0Inv = 1.0f / a0;
    mCoeffs.b0 = b0 * a0Inv;
    mCoeffs.b1 = b1 * a0Inv;
    mCoeffs.b2 = b2 * a0Inv;
    mCoeffs.a1 = a1 * a0Inv;
    mCoeffs.a2 = a2 * a0Inv;
}

// ─── Soft clip (drive) ────────────────────────────────────────────────────────
// tanh approximation: faster than std::tanh, accurate for |x| < 3.

inline static float softClip(float x) noexcept {
    // Pade approximation of tanh
    const float x2 = x * x;
    return x * (27.0f + x2) / (27.0f + 9.0f * x2);
}

// ─── Process ─────────────────────────────────────────────────────────────────

void BassFilter::processStereo(float& l, float& r) noexcept {
    if (mDirty) computeCoefficients();

    // Apply drive (soft clip before filter)
    if (mDrive > 0.001f) {
        const float driveGain = 1.0f + mDrive * 4.0f;
        l = softClip(l * driveGain) / driveGain;
        r = softClip(r * driveGain) / driveGain;
    }

    l = mStateL.process(l + kDenormalOffset, mCoeffs);
    r = mStateR.process(r + kDenormalOffset, mCoeffs);
}

float BassFilter::processMono(float x) noexcept {
    if (mDirty) computeCoefficients();
    if (mDrive > 0.001f) {
        const float driveGain = 1.0f + mDrive * 4.0f;
        x = softClip(x * driveGain) / driveGain;
    }
    return mStateL.process(x + kDenormalOffset, mCoeffs);
}

void BassFilter::reset() noexcept {
    mStateL.reset();
    mStateR.reset();
    mDirty = true;
}

} // namespace vibecore
