#include "VoiceFormant.h"
#include <cstring>

namespace vibecore {

constexpr float VoiceFormant::kAnchors[kVoiceFormantBands];

void VoiceFormant::reset() noexcept {
    for (int i = 0; i < kVoiceFormantBands; ++i) {
        mBoost[i].x1L = mBoost[i].x2L = mBoost[i].y1L = mBoost[i].y2L = 0.0f;
        mBoost[i].x1R = mBoost[i].x2R = mBoost[i].y1R = mBoost[i].y2R = 0.0f;
        mCut[i].x1L = mCut[i].x2L = mCut[i].y1L = mCut[i].y2L = 0.0f;
        mCut[i].x1R = mCut[i].x2R = mCut[i].y1R = mCut[i].y2R = 0.0f;
    }
    mDirty = true;
}

void VoiceFormant::peaking(Band& b, float fs, float f0, float q, float gainDb) noexcept {
    const float A     = std::pow(10.0f, gainDb / 40.0f);
    const float w0    = 6.2831853f * f0 / fs;
    const float alpha = std::sin(w0) / (2.0f * q);
    const float cw    = std::cos(w0);
    const float a0    = 1.0f + alpha / A;
    b.b0 = (1.0f + alpha * A) / a0;
    b.b1 = (-2.0f * cw) / a0;
    b.b2 = (1.0f - alpha * A) / a0;
    b.a1 = (-2.0f * cw) / a0;
    b.a2 = (1.0f - alpha / A) / a0;
}

void VoiceFormant::computeBank() noexcept {
    const float ratio = std::pow(2.0f, mShift / 12.0f);
    const float nyq   = static_cast<float>(mSampleRate) * 0.49f;
    // Depth scales with shift magnitude — flat at 0 semitones.
    const float depth = std::fabs(mShift) * 0.75f;   // up to 9 dB
    const float sgn   = 1.0f;

    for (int i = 0; i < kVoiceFormantBands; ++i) {
        float fShift = kAnchors[i] * ratio;
        if (fShift > nyq) fShift = nyq;
        peaking(mBoost[i], static_cast<float>(mSampleRate), fShift,      1.4f,  sgn * depth);
        peaking(mCut[i],   static_cast<float>(mSampleRate), kAnchors[i], 1.4f, -sgn * depth);
    }
    mDirty = false;
}

static inline float tick(VoiceFormant* /*unused*/, float x,
                         float b0, float b1, float b2, float a1, float a2,
                         float& x1, float& x2, float& y1, float& y2) noexcept {
    const float y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2 + 1e-25f;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    return y;
}

void VoiceFormant::processStereo(float& l, float& r) noexcept {
    if (mDirty) computeBank();
    if (mShift == 0.0f) return;   // neutral — mathematically flat, skip work

    for (int i = 0; i < kVoiceFormantBands; ++i) {
        Band& c = mCut[i];
        l = tick(this, l, c.b0, c.b1, c.b2, c.a1, c.a2, c.x1L, c.x2L, c.y1L, c.y2L);
        r = tick(this, r, c.b0, c.b1, c.b2, c.a1, c.a2, c.x1R, c.x2R, c.y1R, c.y2R);
        Band& b = mBoost[i];
        l = tick(this, l, b.b0, b.b1, b.b2, b.a1, b.a2, b.x1L, b.x2L, b.y1L, b.y2L);
        r = tick(this, r, b.b0, b.b1, b.b2, b.a1, b.a2, b.x1R, b.x2R, b.y1R, b.y2R);
    }
}

} // namespace vibecore
