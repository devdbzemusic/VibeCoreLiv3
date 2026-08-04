#include "Bass3DStereo.h"
#include <cmath>

namespace vibecore {

// ─── M/S processing ───────────────────────────────────────────────────────────
// Encode → process → decode.
//
// Encode:   M = (L + R) / 2,  S = (L - R) / 2
// Scale:    M *= midGain,      S *= sideGain * width
// Decode:   L = M + S,         R = M - S

void Bass3DStereo::applyMidSide(float& l, float& r,
                                  float width,
                                  float midGain, float sideGain) noexcept {
    const float m = (l + r) * 0.5f;
    const float s = (l - r) * 0.5f;

    const float mOut = m * midGain;
    const float sOut = s * sideGain * width;

    l = mOut + sOut;
    r = mOut - sOut;
}

// ─── Constant-power pan ───────────────────────────────────────────────────────
// pan = –1 (full left) … 0 (centre) … +1 (full right)
// Uses equal-power law: gainL = cos(angle), gainR = sin(angle)
// angle in [0, pi/2]

void Bass3DStereo::applyPanPower(float& l, float& r, float pan) noexcept {
    if (std::fabs(pan) < 0.001f) return; // Centre — no op

    static constexpr float kHalfPi = 1.5707963268f;
    const float angle  = (pan + 1.0f) * 0.5f * kHalfPi;  // 0..pi/2
    const float gainL  = std::cos(angle);
    const float gainR  = std::sin(angle);

    l *= gainL;
    r *= gainR;
}

// ─── Per-frame processing ─────────────────────────────────────────────────────

void Bass3DStereo::processFrame(float& l, float& r, const Bass3DParams& p) noexcept {
    if (!p.enabled) return;

    applyMidSide  (l, r, p.stereoWidth, p.midGain, p.sideGain);
    applyPanPower (l, r, p.pan);
}

// ─── Buffer processing ────────────────────────────────────────────────────────

void Bass3DStereo::processBuffer(float* bufferL, float* bufferR,
                                   int numFrames,
                                   const Bass3DParams& p) noexcept {
    if (!p.enabled) return;
    for (int i = 0; i < numFrames; ++i) {
        processFrame(bufferL[i], bufferR[i], p);
    }
}

} // namespace vibecore
