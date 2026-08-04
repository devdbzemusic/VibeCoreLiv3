#pragma once
/**
 * AudioNode.h — Abstract base for all nodes in the VibeCore Audio Graph.
 *
 * Every audio processing unit (mixer, instrument, effect, output) is a node.
 * Nodes are connected through AudioBus references managed by AudioGraphManager.
 *
 * Lifecycle:
 *   prepare(sampleRate, maxFrames)  — called on UI thread before stream starts
 *   process(...)                    — called exclusively on Audio Thread
 *   reset()                         — called on UI thread (stream stopped)
 *
 * Timing events (Phase 2 — VibeCore Sync):
 *   All onSync* methods are called on the Audio Thread, BEFORE process().
 *   sampleOffset indicates the exact sample within the current callback
 *   at which the event occurs. Nodes use this for sample-accurate scheduling.
 *
 *   Default implementations are empty — nodes override only what they need.
 *
 * Thread-safety contract:
 *   process() and all onSync*() are called ONLY on the Audio Thread.
 *   All other methods MUST NOT be called while process() is running.
 *   Parameter changes use AudioThreadSafeQueue, not direct mutation.
 *
 * Audio Thread constraints in ALL virtual methods:
 *   NO malloc · NO free · NO mutex · NO file I/O · NO JNI · NO exceptions
 */

#include <cstdint>

namespace vibecore {

// Forward declarations (avoid circular includes)
struct MusicalPosition;

using NodeId = uint32_t;
static constexpr NodeId kInvalidNodeId = 0;

class AudioNode {
public:
    explicit AudioNode(NodeId id, const char* name)
        : mId(id), mName(name), mEnabled(true) {}

    virtual ~AudioNode() = default;

    AudioNode(const AudioNode&)            = delete;
    AudioNode& operator=(const AudioNode&) = delete;

    // ── Lifecycle (UI Thread) ─────────────────────────────────────────────

    /**
     * Called on UI thread before the audio stream starts.
     * Allocate all scratch buffers here. This is the ONLY place where
     * heap allocation for audio processing is permitted.
     */
    virtual void prepare(int sampleRate, int maxFramesPerCallback) = 0;

    /**
     * Called on UI thread when the stream stops.
     * Reset all internal state. Clear buffers.
     */
    virtual void reset() = 0;

    // ── Audio Rendering (Audio Thread) ────────────────────────────────────

    /**
     * Called on Audio Thread every callback, AFTER all sync events.
     * outputBuffer: interleaved float32, numFrames * numChannels samples
     * inputBuffer:  may be nullptr for source nodes
     * numFrames:    actual frames this callback (≤ maxFramesPerCallback)
     * numChannels:  2 (stereo) in current platform
     *
     * FORBIDDEN: malloc · free · mutex · file I/O · JNI · exceptions
     */
    virtual void process(const float* inputBuffer,
                         float*       outputBuffer,
                         int          numFrames,
                         int          numChannels) noexcept = 0;

    // ── Sync Events (Audio Thread — called BEFORE process()) ─────────────
    //
    // sampleOffset: sample index within current callback [0..numFrames-1]
    //               at which this event occurs.
    //
    // Nodes use sampleOffset to schedule note-on/off at the exact sample,
    // not at the start of the callback (sample-accurate scheduling).

    /** Transport started. */
    virtual void onTransportStart(int32_t sampleOffset) noexcept {}

    /** Transport stopped. */
    virtual void onTransportStop(int32_t sampleOffset) noexcept {}

    /**
     * Every PPQ pulse (1920 per quarter note).
     * Called for EVERY tick — Groove, Synth, Bass receive note schedules here.
     */
    virtual void onTick(int64_t          absoluteTick,
                        const MusicalPosition& pos,
                        int32_t          sampleOffset) noexcept {}

    /**
     * Beat boundary (every PPQ ticks — one quarter note).
     * Called in addition to onTick when the tick falls on a beat.
     */
    virtual void onBeat(int64_t          absoluteTick,
                        const MusicalPosition& pos,
                        int32_t          sampleOffset) noexcept {}

    /**
     * Bar boundary (beat 0, tick 0 of a new measure).
     * Called in addition to onTick and onBeat at bar boundaries.
     */
    virtual void onBar(int64_t          absoluteTick,
                        const MusicalPosition& pos,
                        int32_t          sampleOffset) noexcept {}

    /**
     * Loop restart. Called when the playhead wraps to the loop start point.
     * loopCount: how many times the loop has wrapped (1-based after first wrap).
     */
    virtual void onLoop(int64_t loopCount,
                        int32_t sampleOffset) noexcept {}

    /**
     * Tempo changed mid-playback.
     * Nodes that pre-compute timing (pattern steps, LFO sync) must
     * recalculate from this point.
     */
    virtual void onTempoChanged(double  newBpm,
                                int32_t sampleOffset) noexcept {}

    // ── Accessors ─────────────────────────────────────────────────────────

    NodeId      id()      const noexcept { return mId; }
    const char* name()    const noexcept { return mName; }
    bool        enabled() const noexcept { return mEnabled; }
    void        setEnabled(bool e) noexcept { mEnabled = e; }

protected:
    const NodeId    mId;
    const char*     mName;
    bool            mEnabled;
};

} // namespace vibecore
