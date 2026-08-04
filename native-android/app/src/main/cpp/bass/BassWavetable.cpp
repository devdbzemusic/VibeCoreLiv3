#include "BassWavetable.h"
#include <cmath>
#include <algorithm>

namespace vibecore {

static constexpr float kTwoPi = 6.28318530718f;

// ─── Init ─────────────────────────────────────────────────────────────────────

void BassWavetable::init(int sampleRate) {
    mSampleRate = sampleRate;
    mNyquist    = static_cast<float>(sampleRate) * 0.5f;
    buildWaveforms();
}

// ─── Waveform builders ────────────────────────────────────────────────────────
// All builders fill mip[0] at full resolution, then buildMipPyramid() creates
// the band-limited mip levels by zeroing harmonics above Nyquist / 2^mip.

void BassWavetable::buildSine() {
    WavetableDef& def = mTables[static_cast<int>(BassWaveform::Sine)];
    def.waveform = BassWaveform::Sine;
    auto& mip0 = def.mips[0];
    mip0.validSamples = kWavetableSize;
    for (int i = 0; i < kWavetableSize; ++i) {
        mip0.samples[i] = std::sin(kTwoPi * static_cast<float>(i) / kWavetableSize);
    }
    buildMipPyramid(def);
    def.ready = true;
}

void BassWavetable::buildTriangle() {
    WavetableDef& def = mTables[static_cast<int>(BassWaveform::Triangle)];
    def.waveform = BassWaveform::Triangle;
    auto& mip0 = def.mips[0];
    mip0.validSamples = kWavetableSize;
    // Additive synthesis: sum odd harmonics with alternating signs
    for (int i = 0; i < kWavetableSize; ++i) mip0.samples[i] = 0.0f;
    int maxHarmonic = kWavetableSize / 2;
    float sign = 1.0f;
    for (int h = 1; h <= maxHarmonic; h += 2) {
        float amp = (8.0f / (kTwoPi * kTwoPi)) * sign / (static_cast<float>(h * h));
        for (int i = 0; i < kWavetableSize; ++i) {
            mip0.samples[i] += amp * std::sin(kTwoPi * h * static_cast<float>(i) / kWavetableSize);
        }
        sign = -sign;
    }
    buildMipPyramid(def);
    def.ready = true;
}

void BassWavetable::buildSaw() {
    WavetableDef& def = mTables[static_cast<int>(BassWaveform::Saw)];
    def.waveform = BassWaveform::Saw;
    auto& mip0 = def.mips[0];
    mip0.validSamples = kWavetableSize;
    // Additive: sum all harmonics
    for (int i = 0; i < kWavetableSize; ++i) mip0.samples[i] = 0.0f;
    int maxHarmonic = kWavetableSize / 2;
    for (int h = 1; h <= maxHarmonic; ++h) {
        float amp = (2.0f / kTwoPi) * (h % 2 == 0 ? -1.0f : 1.0f) / static_cast<float>(h);
        for (int i = 0; i < kWavetableSize; ++i) {
            mip0.samples[i] += amp * std::sin(kTwoPi * h * static_cast<float>(i) / kWavetableSize);
        }
    }
    buildMipPyramid(def);
    def.ready = true;
}

void BassWavetable::buildReverseSaw() {
    WavetableDef& def = mTables[static_cast<int>(BassWaveform::ReverseSaw)];
    def.waveform = BassWaveform::ReverseSaw;
    // Mirror the saw
    const WavetableDef& saw = mTables[static_cast<int>(BassWaveform::Saw)];
    for (int m = 0; m < kBassMaxMipLevels; ++m) {
        const int sz = kMipSizes[m];
        def.mips[m].validSamples = sz;
        for (int i = 0; i < sz; ++i) {
            def.mips[m].samples[i] = -saw.mips[m].samples[i];
        }
    }
    def.ready = true;
}

void BassWavetable::buildSquare() {
    WavetableDef& def = mTables[static_cast<int>(BassWaveform::Square)];
    def.waveform = BassWaveform::Square;
    auto& mip0 = def.mips[0];
    mip0.validSamples = kWavetableSize;
    for (int i = 0; i < kWavetableSize; ++i) mip0.samples[i] = 0.0f;
    int maxHarmonic = kWavetableSize / 2;
    for (int h = 1; h <= maxHarmonic; h += 2) {
        float amp = (4.0f / kTwoPi) / static_cast<float>(h);
        for (int i = 0; i < kWavetableSize; ++i) {
            mip0.samples[i] += amp * std::sin(kTwoPi * h * static_cast<float>(i) / kWavetableSize);
        }
    }
    buildMipPyramid(def);
    def.ready = true;
}

void BassWavetable::buildPulse25() {
    WavetableDef& def = mTables[static_cast<int>(BassWaveform::Pulse25)];
    def.waveform = BassWaveform::Pulse25;
    auto& mip0 = def.mips[0];
    mip0.validSamples = kWavetableSize;
    // 25% duty cycle: additive with phase shift
    for (int i = 0; i < kWavetableSize; ++i) mip0.samples[i] = 0.0f;
    int maxHarmonic = kWavetableSize / 2;
    for (int h = 1; h <= maxHarmonic; ++h) {
        float amp  = (2.0f / (kTwoPi * h)) * std::sin(kTwoPi * h * 0.25f);
        for (int i = 0; i < kWavetableSize; ++i) {
            mip0.samples[i] += amp * std::sin(kTwoPi * h * static_cast<float>(i) / kWavetableSize);
        }
    }
    buildMipPyramid(def);
    def.ready = true;
}

// ─── Mip Pyramid ──────────────────────────────────────────────────────────────
// For mip level N: only harmonics up to (kWavetableSize >> N) / 2 are kept.
// We zero harmonics above the limit by doing a simple half-band averaging
// (box filter downsample), which preserves band-limited content.

void BassWavetable::buildMipPyramid(WavetableDef& def) {
    for (int mip = 1; mip < kBassMaxMipLevels; ++mip) {
        const int prevSize = kMipSizes[mip - 1];
        const int curSize  = kMipSizes[mip];
        def.mips[mip].validSamples = curSize;
        const float* src = def.mips[mip - 1].samples;
        float*       dst = def.mips[mip].samples;
        // 2:1 averaging downsample
        for (int i = 0; i < curSize; ++i) {
            const int j = i * 2;
            dst[i] = (src[j] + src[(j + 1) % prevSize]) * 0.5f;
        }
    }
}

// ─── Build all waveforms ──────────────────────────────────────────────────────

void BassWavetable::buildWaveforms() {
    buildSine();
    buildTriangle();
    buildSaw();
    buildReverseSaw();
    buildSquare();
    buildPulse25();
    // Slots Custom0, Custom1 remain empty until user provides data
}

// ─── Mip selection ────────────────────────────────────────────────────────────
// Select the mip level where the fundamental frequency * mip_size < Nyquist.
// Higher frequencies → lower mip level (fewer harmonics kept, anti-aliased).

int BassWavetable::selectMip(float frequencyHz) const noexcept {
    if (frequencyHz <= 0.0f) return 0;
    // Find the largest mip level where freq * (kWavetableSize >> mip) < mNyquist
    for (int m = 0; m < kBassMaxMipLevels - 1; ++m) {
        float limit = mNyquist / static_cast<float>(kMipSizes[m]);
        if (frequencyHz >= limit) return m;
    }
    return kBassMaxMipLevels - 1;
}

// ─── Sample one table at fractional phase ─────────────────────────────────────

float BassWavetable::sampleTable(const WavetableFrame& frame, double phase) const noexcept {
    const int sz = frame.validSamples;
    if (sz <= 0) return 0.0f;

    // Wrap phase into [0, sz)
    double p = phase;
    while (p >= sz) p -= sz;
    while (p <  0)  p += sz;

    const int    i0 = static_cast<int>(p);
    const int    i1 = (i0 + 1) % sz;
    const float  frac = static_cast<float>(p - static_cast<double>(i0));

    return frame.samples[i0] + frac * (frame.samples[i1] - frame.samples[i0]);
}

// ─── Render ───────────────────────────────────────────────────────────────────
// morphPos: 0..7 (between wavetable frames, wrapping at kNumBuiltinWavetables)
// phaseAccum: absolute phase in [0, kWavetableSize) domain

float BassWavetable::render(double phaseAccum, float morphPos, float frequencyHz) const noexcept {
    const int mip = selectMip(frequencyHz);

    // Determine the two wavetable frames to morph between
    const float morphClamped = morphPos < 0.0f ? 0.0f
                             : (morphPos > static_cast<float>(kNumBuiltinWavetables - 1)
                                ? static_cast<float>(kNumBuiltinWavetables - 1)
                                : morphPos);

    const int   tableA    = static_cast<int>(morphClamped);
    const int   tableB    = (tableA + 1) % kNumBuiltinWavetables;
    const float morphFrac = morphClamped - static_cast<float>(tableA);

    if (!mTables[tableA].ready && !mTables[tableB].ready) return 0.0f;

    // Scale phase to this mip level's table size
    const int mipSize = kMipSizes[mip];
    const double scaledPhase = phaseAccum * static_cast<double>(mipSize) / kWavetableSize;

    const float sA = mTables[tableA].ready
                   ? sampleTable(mTables[tableA].mips[mip], scaledPhase) : 0.0f;
    const float sB = mTables[tableB].ready
                   ? sampleTable(mTables[tableB].mips[mip], scaledPhase) : 0.0f;

    return sA + morphFrac * (sB - sA);
}

// ─── Phase increment ─────────────────────────────────────────────────────────

double BassWavetable::phaseIncrement(float frequencyHz) const noexcept {
    if (mSampleRate <= 0 || frequencyHz <= 0.0f) return 0.0;
    return static_cast<double>(frequencyHz) * kWavetableSize / mSampleRate;
}

} // namespace vibecore
