#pragma once
/**
 * VibeCoreSync.h — The single global timing authority for VibeCore Univers.
 *
 * ONE instance. ONE clock. All modules receive their timing from here.
 * Groove, Synth, Bass, Voice, FX MIX LAB — none has its own clock.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  VibeCoreSync                                           │
 *   │                                                         │
 *   │  Transport Engine  ← TransportStart / TransportStop     │
 *   │  Tempo Engine      ← SetTempo (BPM)                     │
 *   │  Timeline Engine   ← absoluteSample → Bar/Beat/Tick     │
 *   │  Loop Engine       ← SetLoopPoints / SetLoopEnabled     │
 *   │  Scheduler         ← emits TickEventBuffer per callback │
 *   └─────────────────────────────────────────────────────────┘
 *           │
 *           │  TickEventBuffer (stack-allocated)
 *           ▼
 *   AudioGraphManager::dispatchSyncEvents(TickEventBuffer&)
 *           │
 *           ▼
 *   AudioNode::onTick() / onBeat() / onBar() / onLoop() ...
 *
 * Thread ownership:
 *   sendCommand()    → any thread (UI, MIDI, Worker) — lock-free queue
 *   processCallback() → Audio Thread ONLY
 *   getPosition()    → any thread (atomic reads, approximate)
 *
 * PPQ = 1920 (fixed, never configurable)
 * Tick resolution: 1920 ticks per quarter note
 * At 120 BPM, 48 kHz: 1 tick = 12.5 samples = 0.26 ms
 *
 * Audio Thread constraints (enforced by code review):
 *   NO malloc/free · NO mutex · NO logging · NO file I/O · NO JNI
 */

#include "MusicalPosition.h"
#include "TickEvent.h"
#include "SyncCommand.h"
#include "../../threads/AudioThreadSafeQueue.h"
#include <atomic>
#include <cstdint>

namespace vibecore {

class VibeCoreSync {
public:
    explicit VibeCoreSync(int32_t sampleRate);
    ~VibeCoreSync() = default;

    VibeCoreSync(const VibeCoreSync&)            = delete;
    VibeCoreSync& operator=(const VibeCoreSync&) = delete;

    // ── UI Thread API — sends commands via lock-free queue ────────────────

    /** Start transport from current position. */
    void play();

    /** Stop transport. Playhead stays at current position. */
    void stop();

    /** Set tempo. Valid range: 20.0 – 300.0 BPM. */
    void setTempo(double bpm);

    /** Set time signature. Denominator must be a power of 2 (2, 4, 8, 16). */
    void setTimeSignature(int32_t numerator, int32_t denominator);

    /** Jump to an absolute tick position. Safe while stopped. */
    void setPosition(int64_t absoluteTick);

    /** Enable/disable loop mode. */
    void setLoopEnabled(bool enabled);

    /** Set loop region in absolute ticks. loopEnd > loopStart. */
    void setLoopPoints(int64_t startTick, int64_t endTick);

    // ── Audio Thread API — call from VibeCoreAudioEngine::onAudioReady() ─

    /**
     * Process one audio callback.
     * Drains the command queue, advances the playhead, and fills
     * outEvents with all timing events that occur within this callback.
     *
     * absoluteSamplePos: engine's absolute sample counter (0 at first callback)
     * numFrames: actual frames in this callback
     *
     * Returns: reference to outEvents (same object, filled in-place).
     *
     * AUDIO THREAD ONLY. Zero allocation. Zero locking.
     */
    const TickEventBuffer& processCallback(int64_t absoluteSamplePos,
                                           int32_t numFrames) noexcept;

    // ── Any-thread reads (approximate, relaxed atomics) ───────────────────

    bool   isPlaying()      const noexcept;
    double currentBpm()     const noexcept;
    int64_t currentTick()   const noexcept;
    MusicalPosition currentPosition() const noexcept;

private:
    // ── Audio Thread state (NOT shared — only read/written on Audio Thread) ─
    struct AudioThreadState {
        bool    isPlaying       = false;
        double  bpm             = 120.0;
        int32_t numerator       = 4;
        int32_t denominator     = 4;
        bool    loopEnabled     = false;
        int64_t loopStartTick   = 0;
        int64_t loopEndTick     = 0;
        int64_t playheadTick    = 0;   // current playhead in ticks (fractional via accumulator)
        int64_t playheadSample  = 0;   // absolute samples since transport start
        int64_t nextTick        = 0;   // next tick to schedule
        int64_t loopCount       = 0;   // how many times loop has wrapped
        double  tickAccumulator = 0.0; // fractional tick position within callback
    } mAT; // mAT = Audio Thread state (only touch on Audio Thread)

    // ── Sync parameters readable from any thread (atomic) ─────────────────
    std::atomic<bool>    mIsPlaying{false};
    std::atomic<double>  mPublicBpm{120.0};
    std::atomic<int64_t> mPublicTick{0};

    // ── Cross-thread command queue ─────────────────────────────────────────
    AudioThreadSafeQueue<SyncCommand, 128> mCommandQueue;

    // ── Internal ──────────────────────────────────────────────────────────
    int32_t        mSampleRate;
    TickEventBuffer mEventBuffer;  // reused each callback, no allocation

    // Audio Thread helpers (all noexcept, no allocation)
    void drainCommands() noexcept;
    void handleCommand(const SyncCommand& cmd) noexcept;
    void scheduleTicksInRange(int64_t callbackStartSample,
                               int32_t numFrames) noexcept;
    void handleLoop(int32_t sampleOffset) noexcept;
    void emitTransportStart(int32_t sampleOffset) noexcept;
    void emitTransportStop(int32_t sampleOffset) noexcept;
    void emitTempoChanged(int32_t sampleOffset) noexcept;

    /** Samples per tick at current BPM (may be fractional, e.g. 12.5). */
    double samplesPerTick() const noexcept {
        return (static_cast<double>(mSampleRate) * 60.0) / (mAT.bpm * kPPQ);
    }

    /** Compute the sample position of a given tick number. */
    int64_t tickToSample(int64_t tick) const noexcept;

    /** Build a MusicalPosition for the given absolute tick. */
    MusicalPosition positionAt(int64_t tick, int64_t sample) const noexcept {
        return MusicalPosition::fromTick(tick, mAT.numerator, sample);
    }

    bool sendCommand(const SyncCommand& cmd);
};

} // namespace vibecore
