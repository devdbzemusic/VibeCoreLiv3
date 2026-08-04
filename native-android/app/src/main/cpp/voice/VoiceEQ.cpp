#include "VoiceEQ.h"

namespace vibecore {

void VoiceEQ::reset() noexcept {
    auto clr = [](Biq& b) {
        b.x1L = b.x2L = b.y1L = b.y2L = 0.0f;
        b.x1R = b.x2R = b.y1R = b.y2R = 0.0f;
    };
    clr(mLow); clr(mMid); clr(mHigh);
}

void VoiceEQ::lowShelf(Biq& b, float f0, float gainDb) noexcept {
    const float A  = std::pow(10.0f, gainDb / 40.0f);
    const float w0 = 6.2831853f * f0 / static_cast<float>(mSampleRate);
    const float cw = std::cos(w0);
    const float sw = std::sin(w0);
    const float alpha = sw / 2.0f * std::sqrt(2.0f);   // S = 1
    const float sqA = std::sqrt(A);
    const float a0 =          (A + 1) + (A - 1) * cw + 2 * sqA * alpha;
    b.b0 =  A * ((A + 1) - (A - 1) * cw + 2 * sqA * alpha) / a0;
    b.b1 =  2 * A * ((A - 1) - (A + 1) * cw) / a0;
    b.b2 =  A * ((A + 1) - (A - 1) * cw - 2 * sqA * alpha) / a0;
    b.a1 = -2 * ((A - 1) + (A + 1) * cw) / a0;
    b.a2 =      ((A + 1) + (A - 1) * cw - 2 * sqA * alpha) / a0;
}

void VoiceEQ::highShelf(Biq& b, float f0, float gainDb) noexcept {
    const float A  = std::pow(10.0f, gainDb / 40.0f);
    const float w0 = 6.2831853f * f0 / static_cast<float>(mSampleRate);
    const float cw = std::cos(w0);
    const float sw = std::sin(w0);
    const float alpha = sw / 2.0f * std::sqrt(2.0f);
    const float sqA = std::sqrt(A);
    const float a0 =          (A + 1) - (A - 1) * cw + 2 * sqA * alpha;
    b.b0 =  A * ((A + 1) + (A - 1) * cw + 2 * sqA * alpha) / a0;
    b.b1 = -2 * A * ((A - 1) + (A + 1) * cw) / a0;
    b.b2 =  A * ((A + 1) + (A - 1) * cw - 2 * sqA * alpha) / a0;
    b.a1 =  2 * ((A - 1) - (A + 1) * cw) / a0;
    b.a2 =      ((A + 1) - (A - 1) * cw - 2 * sqA * alpha) / a0;
}

void VoiceEQ::peak(Biq& b, float f0, float q, float gainDb) noexcept {
    const float A     = std::pow(10.0f, gainDb / 40.0f);
    const float w0    = 6.2831853f * f0 / static_cast<float>(mSampleRate);
    const float alpha = std::sin(w0) / (2.0f * q);
    const float cw    = std::cos(w0);
    const float a0    = 1.0f + alpha / A;
    b.b0 = (1.0f + alpha * A) / a0;
    b.b1 = (-2.0f * cw) / a0;
    b.b2 = (1.0f - alpha * A) / a0;
    b.a1 = (-2.0f * cw) / a0;
    b.a2 = (1.0f - alpha / A) / a0;
}

void VoiceEQ::compute() noexcept {
    lowShelf (mLow,  mParams.lowShelfHz,  mParams.lowGainDb);
    peak     (mMid,  mParams.midHz, mParams.midQ, mParams.midGainDb);
    highShelf(mHigh, mParams.highShelfHz, mParams.highGainDb);
    mDirty = false;
}

void VoiceEQ::processStereo(float& l, float& r) noexcept {
    if (!mParams.enabled) return;
    if (mDirty) compute();
    mLow.tick(l, r);
    mMid.tick(l, r);
    mHigh.tick(l, r);
}

} // namespace vibecore
