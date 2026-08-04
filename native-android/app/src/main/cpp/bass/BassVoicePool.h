#pragma once
/**
 * BassVoicePool.h — Fixed-size voice pool with O(1) allocation for VibeCore 3D Bass.
 *
 * Architecture:
 *   · kBassMaxVoices (16) voices allocated at init — zero heap on Audio Thread.
 *   · Free list for O(1) allocation.
 *   · Deterministic voice stealing: oldest active voice.
 *   · Voice recycling: voices in Release phase are preferred for stealing.
 *   · Voice mode enforcement: Mono/Legato/Poly4/Poly8.
 *   · Glide tracking: previous note pitch carried forward to new voice.
 *   · Sample-accurate trigger dispatch via sampleOffset in BassTrigger.
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "BassVoice.h"
#include "BassTypes.h"
#include <array>
#include <cstdint>

namespace vibecore {

class BassVoicePool {
public:
    BassVoicePool() = default;

    void init(const BassWavetable* wt, int sampleRate);

    // ── Process one audio frame (called per sample from BassNode::process) ─
    void renderFrame(float& outL, float& outR, const BassParams& params) noexcept;

    // ── Trigger management ─────────────────────────────────────────────────
    void noteOn (const BassTrigger& trig, const BassParams& params) noexcept;
    void noteOff(uint8_t note, int32_t sampleOffset) noexcept;
    void allNotesOff() noexcept;

    // ── Parameter propagation ──────────────────────────────────────────────
    void applyFilterParams(const BassParams& params) noexcept;
    void applyEnvParams   (const BassParams& params) noexcept;
    void applyLFOParams   (const BassParams& params) noexcept;

    // ── Tempo sync (from BassNode::onBeat / onBar) ─────────────────────────
    void onBeat(double bpm) noexcept;
    void onBar (double bpm, int beatsPerBar) noexcept;

    // ── Stats ──────────────────────────────────────────────────────────────
    int32_t activeVoiceCount() const noexcept;

    // ── Mono/Legato state ─────────────────────────────────────────────────
    float   lastPitch()     const noexcept { return mLastPitch; }
    uint8_t lastNote()      const noexcept { return mLastNote; }

private:
    // ── Voice allocation ───────────────────────────────────────────────────
    // Returns voice index. –1 if none available (should not happen in practice).
    int32_t allocateVoice(const BassParams& params) noexcept;

    // Steal the oldest / releasing voice
    int32_t stealVoice() noexcept;

    // Find voice playing a given note (for note-off matching)
    int32_t findVoice(uint8_t note) const noexcept;

    // Maximum voices for current voice mode
    int32_t maxVoices(const BassParams& params) const noexcept;

    std::array<BassVoiceImpl, kBassMaxVoices> mVoices = {};

    // Free list: stack of free voice indices
    int32_t mFreeList[kBassMaxVoices] = {};
    int32_t mFreeCount = 0;

    // For Mono/Legato: last sounding pitch and note
    float   mLastPitch = 440.0f;
    uint8_t mLastNote  = 69;

    int mSampleRate = 48000;
};

} // namespace vibecore
