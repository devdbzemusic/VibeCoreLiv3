#pragma once
/**
 * VoiceFormant.h — Formant shifting for VibeCore Voice.
 *
 * Design (Phase 6 baseline):
 *   Spectral-envelope tilt approximation using a 4-band peaking filter bank
 *   anchored at typical vocal formant regions (F1–F4). Shifting the formant
 *   moves the bank's center frequencies by the formant ratio and applies a
 *   complementary cut at the original positions — perceptually shifts the
 *   vocal tract resonances while true pitch stays untouched.
 *
 *   Advanced Formant Morphing (LPC/cepstral) is PREPARED via this API and
 *   will replace the bank internally in a later phase — API stays stable.
 *
 * Thread model: process on Audio Thread only.
 */

#include "VoiceTypes.h"
#include <cmath>

namespace vibecore {

class VoiceFormant {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; mDirty = true; }

    // semitones: –12 … +12. 0 = neutral (bank flat).
    void setShiftSemitones(float st) noexcept {
        st = st < -12.0f ? -12.0f : (st > 12.0f ? 12.0f : st);
        if (st != mShift) { mShift = st; mDirty = true; }
    }

    void reset() noexcept;

    // Stereo in-place.
    void processStereo(float& l, float& r) noexcept;

private:
    struct Band {
        // Direct Form 2 biquad per channel
        float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
        float x1L = 0, x2L = 0, y1L = 0, y2L = 0;
        float x1R = 0, x2R = 0, y1R = 0, y2R = 0;
    };

    void computeBank() noexcept;
    static void peaking(Band& b, float fs, float f0, float q, float gainDb) noexcept;

    // Neutral vocal formant anchors (Hz)
    static constexpr float kAnchors[kVoiceFormantBands] = { 500.0f, 1500.0f, 2500.0f, 3500.0f };

    Band  mBoost[kVoiceFormantBands] = {};   // at shifted positions
    Band  mCut  [kVoiceFormantBands] = {};   // at original positions
    float mShift      = 0.0f;
    int   mSampleRate = 48000;
    bool  mDirty      = true;
};

} // namespace vibecore
