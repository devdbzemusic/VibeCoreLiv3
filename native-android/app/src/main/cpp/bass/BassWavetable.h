#pragma once
/**
 * BassWavetable.h — Band-limited wavetable engine for VibeCore 3D Bass.
 *
 * Architecture:
 *   · kNumBuiltinWavetables waveforms, each with kBassMaxMipLevels band-limited mip levels.
 *   · Mip selection based on playback frequency vs. Nyquist (anti-aliasing).
 *   · Linear interpolation between adjacent mip levels (smooth transition).
 *   · Double-precision phase accumulator for pitch accuracy.
 *   · Linear crossfade between two wavetable frames for morphing.
 *   · Wavetable data: pre-computed at init, never modified on Audio Thread.
 *   · Oversampling: framework prepared (oversample flag × 1/2/4).
 *
 * Thread model: init() on UI/Worker Thread. render() on Audio Thread ONLY.
 */

#include "BassTypes.h"

namespace vibecore {

class BassWavetable {
public:
    BassWavetable() = default;

    // ── Called once on Worker/UI Thread before engine starts ──────────────
    void init(int sampleRate);

    // ── Returns a sample given phase (0–kWavetableSize), morph and freq ───
    // morphPos: 0.0 = first waveform, 1.0 = second, 2.0 = third…
    // frequencyHz: for mip level selection
    float render(double phase, float morphPos, float frequencyHz) const noexcept;

    // ── Compute phase increment for a given frequency ──────────────────────
    double phaseIncrement(float frequencyHz) const noexcept;

    int sampleRate() const noexcept { return mSampleRate; }

private:
    static constexpr int kMipSizes[kBassMaxMipLevels] = {
        2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2
    };

    // Selects appropriate mip level to avoid aliasing
    int selectMip(float frequencyHz) const noexcept;

    // Sample one table at fractional phase
    float sampleTable(const WavetableFrame& frame, double phase) const noexcept;

    // Build all mip levels for all waveforms
    void buildWaveforms();
    void buildSine();
    void buildTriangle();
    void buildSaw();
    void buildReverseSaw();
    void buildSquare();
    void buildPulse25();

    // Build mip pyramid via bandlimiting (zero out harmonics above Nyquist/2^mip)
    void buildMipPyramid(WavetableDef& def);

    WavetableDef mTables[kNumBuiltinWavetables] = {};
    int          mSampleRate = 48000;
    float        mNyquist    = 24000.0f;
};

} // namespace vibecore
