#pragma once
/**
 * VoicePitchShifter.h — Real-time pitch shifter for VibeCore Voice.
 *
 * Design: dual-tap crossfaded delay-line shifter (time-domain, granular).
 *   · Fixed delay line kVoiceShiftBufSize (power of 2) — zero heap on AT.
 *   · Two read taps 180° apart in the grain window, raised-cosine crossfade.
 *   · Window ~46 ms @ 48 kHz — good compromise for vocals.
 *   · Latency ≈ half window; deterministic, sample-exact.
 *   · Transient-safe time stretch: same tap engine prepared (rate ≠ pitch)
 *     — API present, engaged in a later phase.
 *
 * Thread model: process*() on Audio Thread only. reset()/setSampleRate()
 * on UI thread while stream stopped, or from command handling on AT.
 */

#include "VoiceTypes.h"
#include <cmath>

namespace vibecore {

class VoicePitchShifter {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; recomputeWindow(); }

    // ratio = 2^(semitones/12). 1.0 = bypass-equivalent (still through line).
    void setRatio(float ratio) noexcept { mRatio = ratio < 0.25f ? 0.25f : (ratio > 4.0f ? 4.0f : ratio); }
    void setSemitones(float st) noexcept { setRatio(std::pow(2.0f, st / 12.0f)); }

    void reset() noexcept;

    // Mono in → mono out, one sample.
    float processSample(float in) noexcept;

    // Stereo helper: shares tap phase, separate delay lines.
    void processStereo(float& l, float& r) noexcept;

private:
    static constexpr int kMask = kVoiceShiftBufSize - 1;

    void recomputeWindow() noexcept;
    float readTap(const float* buf, float delay) const noexcept;

    float mBufL[kVoiceShiftBufSize] = {};
    float mBufR[kVoiceShiftBufSize] = {};
    int   mWriteIdx    = 0;
    float mTapPhase    = 0.0f;   // 0–1 grain phase
    float mWindowSamps = 2048.0f;
    float mRatio       = 1.0f;
    int   mSampleRate  = 48000;
};

} // namespace vibecore
