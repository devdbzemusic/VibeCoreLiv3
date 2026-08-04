#pragma once
/**
 * BassNode.h — AudioNode subclass for VibeCore 3D Bass.
 *
 * Architecture (Phase 5):
 *
 *   BassNode IS-A AudioNode — integrated into AudioGraphManager like all other nodes.
 *   It receives ALL timing events from VibeCoreSync (onTick, onBeat, onBar,
 *   onTempoChanged, onTransportStart, onTransportStop, onLoop) through the
 *   AudioNode callback interface. No own clock, no own scheduler, no own thread.
 *
 *   Signal flow:
 *     VibeCoreSync → AudioGraphManager::dispatchSyncEvents()
 *       → BassNode::onTick / onBeat / onBar
 *         → BassVoicePool::noteOn() / noteOff()
 *     AudioGraphManager::process()
 *       → BassNode::process()
 *         → BassVoicePool::renderFrame()  [per sample]
 *         → Bass3DStereo::processBuffer() [post-render]
 *         → output AudioBus (left / right channels)
 *
 *   Command queue:
 *     UI Thread → BassEngine → mCommandQueue → Audio Thread (BassNode)
 *     Drained at top of process() — zero latency to next buffer.
 *
 *   Groove integration:
 *     BassNode::notifyGrooveTrigger() — called from GrooveNode (Audio Thread only)
 *     when a step/piano roll event fires for a track in Bass mode.
 *     This bypasses the queue — it IS the audio thread — direct noteOn to pool.
 *
 * Thread model:
 *   process(), all onXxx callbacks, notifyGrooveTrigger() → Audio Thread ONLY.
 *   All other methods → must not be called directly (use BassEngine API).
 */

#include "../graph/AudioNode.h"
#include "../threads/AudioThreadSafeQueue.h"
#include "BassTypes.h"
#include "BassCommands.h"
#include "BassWavetable.h"
#include "BassVoicePool.h"
#include "Bass3DStereo.h"

#include <atomic>
#include <array>

namespace vibecore {

// Output buffer size — matches Oboe's maxFramesPerCallback
static constexpr int kBassRenderBufferSize = 2048;

class BassNode : public AudioNode {
public:
    explicit BassNode(NodeId id);
    ~BassNode() override = default;

    // ── AudioNode lifecycle ────────────────────────────────────────────────
    void prepare(int sampleRate, int maxFramesPerCallback) override;
    void reset  ()                                          override;

    // ── AudioNode process ─────────────────────────────────────────────────
    // Drains command queue, then renders all active voices into output bus.
    void process(const float* inputBuffer, float* outputBuffer,
                 int numFrames, int numChannels) noexcept override;

    // ── AudioNode sync callbacks (Audio Thread — all with sampleOffset) ───
    void onTransportStart(int32_t sampleOffset)                             noexcept override;
    void onTransportStop (int32_t sampleOffset)                             noexcept override;
    void onTick          (int64_t tick, const MusicalPosition& pos,
                          int32_t sampleOffset)                             noexcept override;
    void onBeat          (int64_t beat, const MusicalPosition& pos,
                          int32_t sampleOffset)                             noexcept override;
    void onBar           (int64_t bar,  const MusicalPosition& pos,
                          int32_t sampleOffset)                             noexcept override;
    void onLoop          (int64_t loopCount, int32_t sampleOffset)          noexcept override;
    void onTempoChanged  (double newBpm, int32_t sampleOffset)              noexcept override;

    // ── Groove integration (Audio Thread only) ────────────────────────────
    // Called by GrooveNode when it fires a note for a track in Bass mode.
    void notifyGrooveTrigger(const BassTrigger& trig) noexcept;

    // ── Command queue (called from BassEngine on UI Thread) ───────────────
    bool enqueueCommand(const BassCommand& cmd) noexcept {
        return mCommandQueue.push(cmd);
    }

    // ── Approximate state reads (atomic — any thread) ─────────────────────
    int32_t activeVoiceCount() const noexcept { return mActiveVoiceCount.load(std::memory_order_relaxed); }
    float   outputLevel()      const noexcept { return mOutputLevel.load (std::memory_order_relaxed); }
    bool    isPlaying()        const noexcept { return mIsPlaying.load   (std::memory_order_relaxed); }

private:
    // ── Command processing (Audio Thread) ─────────────────────────────────
    void drainCommandQueue() noexcept;
    void applyCommand(const BassCommand& cmd) noexcept;

    // ── DSP modules (Audio Thread owned) ──────────────────────────────────
    BassWavetable mWavetable;
    BassVoicePool mVoicePool;

    // ── Parameter state (Audio Thread copy — written by applyCommand) ─────
    BassParams mParams;

    // ── Render buffers (stack-allocated per process() call) ───────────────
    // Pre-allocated to kBassRenderBufferSize — no heap on audio thread
    float mBufL[kBassRenderBufferSize] = {};
    float mBufR[kBassRenderBufferSize] = {};

    // ── Command queue ─────────────────────────────────────────────────────
    AudioThreadSafeQueue<BassCommand, kBassCommandCapacity> mCommandQueue;

    // ── Atomic state (readable from any thread) ────────────────────────────
    std::atomic<int32_t> mActiveVoiceCount{0};
    std::atomic<float>   mOutputLevel    {0.0f};
    std::atomic<bool>    mIsPlaying      {false};

    // ── Tempo (needed for LFO sync) ────────────────────────────────────────
    double mCurrentBpm = 120.0;
    int    mBeatsPerBar = 4;
    int    mSampleRate  = 48000;
    bool   mPrepared    = false;
};

} // namespace vibecore
