#pragma once
/**
 * VoiceEQ.h — 3-band EQ (low shelf / mid peak / high shelf) for VibeCore Voice.
 *
 * RBJ biquads, Direct Form 2, stereo states, anti-denormal bias.
 * Coefficients recomputed only when parameters change (command handling).
 *
 * Thread model: process on Audio Thread only.
 */

#include "VoiceTypes.h"
#include <cmath>

namespace vibecore {

class VoiceEQ {
public:
    void setSampleRate(int sr) noexcept { mSampleRate = sr; mDirty = true; }
    void setParams(const VoiceEQParams& p) noexcept { mParams = p; mDirty = true; }
    void reset() noexcept;

    void processStereo(float& l, float& r) noexcept;

private:
    struct Biq {
        float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
        float x1L = 0, x2L = 0, y1L = 0, y2L = 0;
        float x1R = 0, x2R = 0, y1R = 0, y2R = 0;

        inline void tick(float& l, float& r) noexcept {
            float y = b0 * l + b1 * x1L + b2 * x2L - a1 * y1L - a2 * y2L + 1e-25f;
            x2L = x1L; x1L = l; y2L = y1L; y1L = y; l = y;
            y = b0 * r + b1 * x1R + b2 * x2R - a1 * y1R - a2 * y2R + 1e-25f;
            x2R = x1R; x1R = r; y2R = y1R; y1R = y; r = y;
        }
    };

    void compute() noexcept;
    void lowShelf (Biq& b, float f0, float gainDb) noexcept;
    void highShelf(Biq& b, float f0, float gainDb) noexcept;
    void peak     (Biq& b, float f0, float q, float gainDb) noexcept;

    VoiceEQParams mParams = {};
    Biq  mLow, mMid, mHigh;
    int  mSampleRate = 48000;
    bool mDirty = true;
};

} // namespace vibecore
