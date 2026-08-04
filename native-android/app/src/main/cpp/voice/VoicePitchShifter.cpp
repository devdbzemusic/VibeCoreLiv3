#include "VoicePitchShifter.h"
#include <cstring>

namespace vibecore {

void VoicePitchShifter::reset() noexcept {
    memset(mBufL, 0, sizeof(mBufL));
    memset(mBufR, 0, sizeof(mBufR));
    mWriteIdx = 0;
    mTapPhase = 0.0f;
}

void VoicePitchShifter::recomputeWindow() noexcept {
    // ~46 ms window, clamped below buffer size
    float w = 0.046f * static_cast<float>(mSampleRate);
    const float maxW = static_cast<float>(kVoiceShiftBufSize) * 0.45f;
    mWindowSamps = w > maxW ? maxW : w;
}

float VoicePitchShifter::readTap(const float* buf, float delay) const noexcept {
    // Linear-interpolated read at (writeIdx - delay)
    float pos = static_cast<float>(mWriteIdx) - delay;
    int   i0  = static_cast<int>(std::floor(pos));
    float fr  = pos - static_cast<float>(i0);
    const float a = buf[i0 & kMask];
    const float b = buf[(i0 + 1) & kMask];
    return a + fr * (b - a);
}

float VoicePitchShifter::processSample(float in) noexcept {
    mBufL[mWriteIdx & kMask] = in;

    // Advance grain phase: delta = (1 - ratio) per sample, normalized to window
    const float delta = (1.0f - mRatio) / mWindowSamps;
    mTapPhase += delta;
    mTapPhase -= std::floor(mTapPhase);   // wrap 0–1

    const float d1 = mTapPhase * mWindowSamps;
    float p2 = mTapPhase + 0.5f; p2 -= std::floor(p2);
    const float d2 = p2 * mWindowSamps;

    // Raised-cosine (equal-power) crossfade between taps
    const float g1 = 0.5f - 0.5f * std::cos(6.2831853f * mTapPhase);
    const float g2 = 1.0f - g1;

    const float out = readTap(mBufL, d1 + 1.0f) * g1 +
                      readTap(mBufL, d2 + 1.0f) * g2;

    ++mWriteIdx;
    return out;
}

void VoicePitchShifter::processStereo(float& l, float& r) noexcept {
    mBufL[mWriteIdx & kMask] = l;
    mBufR[mWriteIdx & kMask] = r;

    const float delta = (1.0f - mRatio) / mWindowSamps;
    mTapPhase += delta;
    mTapPhase -= std::floor(mTapPhase);

    const float d1 = mTapPhase * mWindowSamps;
    float p2 = mTapPhase + 0.5f; p2 -= std::floor(p2);
    const float d2 = p2 * mWindowSamps;

    const float g1 = 0.5f - 0.5f * std::cos(6.2831853f * mTapPhase);
    const float g2 = 1.0f - g1;

    l = readTap(mBufL, d1 + 1.0f) * g1 + readTap(mBufL, d2 + 1.0f) * g2;
    r = readTap(mBufR, d1 + 1.0f) * g1 + readTap(mBufR, d2 + 1.0f) * g2;

    ++mWriteIdx;
}

} // namespace vibecore
