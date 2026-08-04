#pragma once
/**
 * Bass3DStereo.h — 3D Stereo engine for VibeCore 3D Bass.
 *
 * Architecture:
 *   · M/S (Mid/Side) matrix for stereo width control.
 *   · Stereo width: 0 = mono, 1 = unprocessed stereo, 2 = extra-wide.
 *   · Mid gain / Side gain independent control.
 *   · Pan: applied as constant-power law post-width.
 *   · Binaural HRTF: framework prepared — pass-through until Phase 7+.
 *   · No forcing to mono — full stereo pipeline at all times.
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "BassTypes.h"

namespace vibecore {

class Bass3DStereo {
public:
    // Apply 3D stereo processing to one stereo frame (in-place).
    // Called once per output sample from BassNode::process().
    static void processFrame(float& l, float& r, const Bass3DParams& p) noexcept;

    // Convenience: process one buffer in-place.
    // bufferL and bufferR must have numFrames samples each.
    static void processBuffer(float* bufferL, float* bufferR,
                              int numFrames,
                              const Bass3DParams& p) noexcept;

private:
    static void applyMidSide (float& l, float& r, float width,
                               float midGain, float sideGain) noexcept;
    static void applyPanPower(float& l, float& r, float pan) noexcept;
};

} // namespace vibecore
