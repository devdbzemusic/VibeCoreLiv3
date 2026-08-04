#include "VoiceDynamics.h"

namespace vibecore {

// ─── De-Esser ─────────────────────────────────────────────────────────────────

void VoiceDeEsser::update() noexcept {
    // 1-pole HP at detection frequency
    const float w = 6.2831853f * mParams.frequencyHz / static_cast<float>(mSampleRate);
    mHpCoeff = (1.0f - std::sin(w)) / std::cos(w);
    if (mHpCoeff < 0.0f) mHpCoeff = 0.0f;
    if (mHpCoeff > 0.9999f) mHpCoeff = 0.9999f;

    mThreshLin = std::pow(10.0f, mParams.thresholdDb / 20.0f);
    mAtk = 1.0f - std::exp(-1.0f / (0.0005f * static_cast<float>(mSampleRate)));  // 0.5 ms
    mRel = 1.0f - std::exp(-1.0f / (0.040f  * static_cast<float>(mSampleRate)));  // 40 ms
    mCurRedDb = -1000.0f;   // force coefficient rebuild
}

void VoiceDeEsser::processStereo(float& l, float& r) noexcept {
    if (!mParams.enabled) return;

    // Sibilance detection: 1-pole HP on mono sum
    const float x = (l + r) * 0.5f;
    const float hpL = 0.5f * (1.0f + mHpCoeff) * (x - mHx1L) + mHpCoeff * mHy1L;
    mHx1L = x; mHy1L = hpL;

    const float det = std::fabs(hpL);
    mEnv += (det - mEnv) * (det > mEnv ? mAtk : mRel);

    // Reduction depth in dB (0 … –12 * amount)
    float redDb = 0.0f;
    if (mEnv > mThreshLin) {
        const float overDb = 20.0f * std::log10(mEnv / mThreshLin + 1e-9f);
        redDb = overDb * mParams.amount;
        if (redDb > 12.0f) redDb = 12.0f;
    }

    // Rebuild peaking-cut coefficients only when reduction changed noticeably
    if (std::fabs(redDb - mCurRedDb) > 0.5f) {
        mCurRedDb = redDb;
        const float A     = std::pow(10.0f, -redDb / 40.0f);
        const float w0    = 6.2831853f * mParams.frequencyHz / static_cast<float>(mSampleRate);
        const float alpha = std::sin(w0) / (2.0f * 2.0f);   // Q = 2
        const float cw    = std::cos(w0);
        const float a0    = 1.0f + alpha / A;
        mB0 = (1.0f + alpha * A) / a0;
        mB1 = (-2.0f * cw) / a0;
        mB2 = (1.0f - alpha * A) / a0;
        mA1 = (-2.0f * cw) / a0;
        mA2 = (1.0f - alpha / A) / a0;
    }

    // Apply dynamic cut
    float y = mB0 * l + mB1 * mPk.x1L + mB2 * mPk.x2L - mA1 * mPk.y1L - mA2 * mPk.y2L + 1e-25f;
    mPk.x2L = mPk.x1L; mPk.x1L = l;
    mPk.y2L = mPk.y1L; mPk.y1L = y;
    l = y;

    y = mB0 * r + mB1 * mPk.x1R + mB2 * mPk.x2R - mA1 * mPk.y1R - mA2 * mPk.y2R + 1e-25f;
    mPk.x2R = mPk.x1R; mPk.x1R = r;
    mPk.y2R = mPk.y1R; mPk.y1R = y;
    r = y;
}

} // namespace vibecore
