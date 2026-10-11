#pragma once
/**
 * VoicePool.h — Fixed-size voice pool for VibeCore Groove.
 *
 * kMaxVoices = 64 voices (pre-allocated, no dynamic allocation).
 *
 * Voice allocation strategy:
 *   1. Find an Idle voice → use it
 *   2. No idle voice → steal the oldest (lowest playback progress) voice
 *      of the same track or choke group
 *   3. Still none → steal the oldest voice globally (last resort)
 *
 * Choke groups (1–8):
 *   When a trigger with chokeGroup > 0 fires, all other voices in
 *   the same choke group are immediately released (moved to Releasing).
 *
 * Voice Stealing (deterministic — no randomness):
 *   Oldest voice = voice with lowest readPosQ16 / buffer.length ratio.
 *   This gives deterministic, reproducible behavior.
 *
 * process():
 *   For each active voice, render samples from startOffset to numFrames.
 *   Voices that finished are set to Idle.
 *   Release envelope: simple linear fade at envRelease rate.
 *
 * AUDIO THREAD ONLY. Zero allocation. Zero locking.
 */

#include "GrooveTypes.h"
#include <array>
#include <cstdint>

namespace vibecore {

class VoicePool {
public:
    VoicePool();
    ~VoicePool() = default;

    VoicePool(const VoicePool&)            = delete;
    VoicePool& operator=(const VoicePool&) = delete;

    // ── Lifecycle (Audio Thread) ──────────────────────────────────────────

    /** Called before stream starts. Sets sampleRate and release coefficients. */
    void prepare(int32_t sampleRate, int32_t maxFrames) noexcept;

    /** Called when stream stops. Silences all voices. */
    void reset() noexcept;

    // ── Sample registry (UI Thread — before stream starts) ───────────────
    /** Register a pre-loaded sample buffer. Must be called before stream starts. */
    void registerSample(int32_t sampleId, const SampleBuffer& buf) noexcept;

    // ── Trigger (Audio Thread — called from GrooveNode::onTick) ──────────
    /**
     * Trigger a voice for this sample at the given sampleOffset.
     * Handles choke group silencing and voice stealing.
     */
    void trigger(const Trigger& t) noexcept;
    void setTrackVolume(int32_t track, uint8_t volume) noexcept;
    void setTrackPan(int32_t track, int8_t pan) noexcept;

    // ── Render (Audio Thread — called from GrooveNode::process) ──────────
    /**
     * Mix all active voices into outputBuffer.
     * outputBuffer: interleaved float32, numFrames * numChannels samples
     * Handles start offsets: a voice with startOffset=N begins at frame N.
     */
    void process(float* outputBuffer, int32_t numFrames, int32_t numChannels) noexcept;

    // ── Query ──────────────────────────────────────────────────────────────
    int32_t activeVoiceCount() const noexcept;
    int32_t totalStolenVoices() const noexcept { return mStolenCount; }

private:
    std::array<Voice, kMaxVoices>       mVoices       = {};
    std::array<SampleBuffer, kMaxSamples> mSamples    = {};
    std::array<uint8_t, kMaxTracks>       mTrackVolume = {};
    std::array<int8_t, kMaxTracks>        mTrackPan    = {};
    int32_t mSampleRate    = 48000;
    int32_t mStolenCount   = 0;

    // Default release: 10 ms
    float mDefaultRelease  = 0.0f;  // set in prepare()

    int32_t findIdleVoice() const noexcept;
    int32_t findStealVoice(uint8_t trackIndex, uint8_t chokeGroup) const noexcept;
    void    chokeGroup(uint8_t group) noexcept;
    void    renderVoice(Voice& v, float* out, int32_t numFrames, int32_t numChannels) noexcept;

    /** Deterministic xorshift32 for probability checks. Audio Thread only. */
    uint32_t mRng = 0xDEADBEEF;
    uint32_t nextRandom() noexcept {
        mRng ^= mRng << 13;
        mRng ^= mRng >> 17;
        mRng ^= mRng << 5;
        return mRng;
    }
    uint8_t randomByte() noexcept { return static_cast<uint8_t>(nextRandom() & 0xFF); }
};

} // namespace vibecore
