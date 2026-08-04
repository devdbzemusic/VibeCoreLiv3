#pragma once
/**
 * BassVoice.h — Full synthesizer voice for VibeCore 3D Bass.
 *
 * One BassVoice = one playing note:
 *   · Wavetable oscillator (via BassWavetable reference)
 *   · kBassMaxEnvelopes envelopes (Env0 = Amp, Env1 = Mod)
 *   · kBassMaxLFOs LFOs (LFO0, LFO1)
 *   · One stereo BassFilter
 *   · Modulation matrix application
 *   · Glide / portamento
 *   · Stereo pan law
 *
 * Thread model: ALL methods on Audio Thread only.
 */

#include "BassTypes.h"
#include "BassWavetable.h"
#include "BassFilter.h"
#include "BassEnvelope.h"
#include "BassLFO.h"
#include <array>

namespace vibecore {

class BassVoiceImpl {
public:
    BassVoiceImpl() = default;

    void init(const BassWavetable* wt, int sampleRate);

    // ── Trigger ────────────────────────────────────────────────────────────
    void noteOn (const BassTrigger& trig, const BassParams& params) noexcept;
    void noteOff(int32_t sampleOffset) noexcept;
    void forceOff() noexcept;

    // ── Render one stereo frame ────────────────────────────────────────────
    // Returns (left, right) via output references.
    void renderFrame(float& outL, float& outR, const BassParams& params) noexcept;

    // ── Parameter hot-update (called from BassNode command processing) ─────
    void applyFilterParams(const BassParams& params) noexcept;
    void applyEnvParams   (const BassParams& params) noexcept;
    void applyLFOParams   (const BassParams& params) noexcept;

    // ── State accessors ────────────────────────────────────────────────────
    bool            isActive()    const noexcept { return mVoiceData.isActive(); }
    BassVoiceState  voiceState()  const noexcept { return mVoiceData.state; }
    uint8_t         noteNumber()  const noexcept { return mVoiceData.note; }
    int32_t         ageFrames()   const noexcept { return mVoiceData.ageFrames; }

    void reset() noexcept;

    // ── Tempo sync for LFOs (called from onBeat/onBar) ─────────────────────
    void onBeat(double bpm) noexcept;
    void onBar (double bpm, int beatsPerBar) noexcept;

private:
    // ── Note → Frequency ───────────────────────────────────────────────────
    static float midiNoteToHz(uint8_t note, float detuneCents) noexcept;

    // ── Apply modulation matrix for one frame ─────────────────────────────
    // Fills modDeltas[] array (per-destination accumulated delta).
    void applyModMatrix(float modDeltas[8], const BassParams& params) noexcept;

    const BassWavetable* mWavetable = nullptr;
    BassVoice            mVoiceData = {};
    BassFilter           mFilter    = {};
    std::array<BassEnvelope, kBassMaxEnvelopes> mEnvs = {};
    std::array<BassLFO,      kBassMaxLFOs>      mLFOs = {};

    int   mSampleRate = 48000;
    bool  mReleaseTriggered = false;
};

} // namespace vibecore
