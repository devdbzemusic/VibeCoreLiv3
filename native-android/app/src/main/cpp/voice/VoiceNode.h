#pragma once
/**
 * VoiceNode.h — AudioNode subclass for VibeCore Voice (Phase 6).
 *
 * Architecture:
 *
 *   VoiceNode IS-A AudioNode — registered in AudioGraphManager (NodeId = 3).
 *   It receives ALL timing events from VibeCoreSync through the AudioNode
 *   callback interface. No own clock, no own scheduler, no own audio thread.
 *
 *   Signal flow (inside process()):
 *     source (live input ring | unit pool render)      [mBufL/R]
 *       → pitch shift (global, optional)
 *       → formant shift (optional)
 *       → harmonizer + doubler (adds shifted copies)
 *       → breath layer (add)
 *       → gate → de-esser → compressor → EQ
 *       → 3D stereo (M/S width, pan)
 *       → dry/wet (Live mode) → output bus (+=)
 *
 *   Command queue: UI Thread → VoiceEngine → mCommandQueue → Audio Thread.
 *   Drained at the top of process().
 *
 *   Groove integration:
 *     VoiceNode::notifyGrooveTrigger() — direct Audio-Thread call from
 *     GrooveNode when a step/piano-roll event fires for a Voice-mode track.
 *     Zero latency, no queue (same pattern as BassNode).
 *
 * Thread model:
 *   process(), all onXxx callbacks, notifyGrooveTrigger() → Audio Thread ONLY.
 *   All other methods → via VoiceEngine (UI Thread).
 */

#include "../graph/AudioNode.h"
#include "../threads/AudioThreadSafeQueue.h"
#include "VoiceTypes.h"
#include "VoiceCommands.h"
#include "VoiceSampleBank.h"
#include "VoiceUnitPool.h"
#include "VoicePitchShifter.h"
#include "VoiceFormant.h"
#include "VoiceHarmonizer.h"
#include "VoiceDynamics.h"
#include "VoiceEQ.h"
#include "VoiceBreath.h"
#include "VoiceInput.h"

#include <atomic>

namespace vibecore {

static constexpr int kVoiceRenderBufferSize = 2048;

class VoiceNode : public AudioNode {
public:
    explicit VoiceNode(NodeId id);
    ~VoiceNode() override = default;

    // ── AudioNode lifecycle ───────────────────────────────────────────────
    void prepare(int sampleRate, int maxFramesPerCallback) override;
    void reset  ()                                          override;

    // ── AudioNode process ─────────────────────────────────────────────────
    void process(const float* inputBuffer, float* outputBuffer,
                 int numFrames, int numChannels) noexcept override;

    // ── AudioNode sync callbacks (Audio Thread) ───────────────────────────
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
    void notifyGrooveTrigger(const VoiceTrigger& trig) noexcept;

    // ── Command queue (VoiceEngine, UI Thread) ────────────────────────────
    bool enqueueCommand(const VoiceCommand& cmd) noexcept {
        return mCommandQueue.push(cmd);
    }

    // ── Live input (opened/closed by VoiceEngine on UI Thread) ────────────
    VoiceInput& input() noexcept { return mInput; }

    // ── Approximate state reads (atomic — any thread) ─────────────────────
    int32_t activeUnitCount() const noexcept { return mActiveUnits.load(std::memory_order_relaxed); }
    float   outputLevel()     const noexcept { return mOutputLevel.load(std::memory_order_relaxed); }
    float   inputLevel()      const noexcept { return mInputLevel.load (std::memory_order_relaxed); }
    bool    isPlaying()       const noexcept { return mIsPlaying.load  (std::memory_order_relaxed); }
    int32_t sampleRate()      const noexcept { return mSampleRate; }
    int32_t maxFrames()       const noexcept { return mMaxFrames; }

    // Monotonic callback counter. The UI thread reclaims retired sample
    // buffers only after this has advanced past the retire epoch — proof the
    // Audio Thread has drained the replacing command AND finished kill fades.
    uint64_t processEpoch()   const noexcept { return mProcessEpoch.load(std::memory_order_acquire); }

private:
    void drainCommandQueue() noexcept;
    void applyCommand(const VoiceCommand& cmd) noexcept;
    void applyStereo3D(float* l, float* r, int numFrames,
                       float widthMod, float panMod) noexcept;

    // ── DSP modules (Audio Thread owned) ──────────────────────────────────
    VoiceSampleBank   mBank;
    VoiceUnitPool     mPool;
    VoicePitchShifter mPitchShift;
    VoiceFormant      mFormant;
    VoiceHarmonizer   mHarmonizer;
    VoiceGate         mGate;
    VoiceDeEsser      mDeEsser;
    VoiceCompressor   mCompressor;
    VoiceEQ           mEQ;
    VoiceBreath       mBreath;
    VoiceInput        mInput;

    // ── Parameter state (Audio Thread copy) ───────────────────────────────
    VoiceParams mParams;

    // ── Render buffers (member — no heap on audio thread) ─────────────────
    float mBufL[kVoiceRenderBufferSize] = {};
    float mBufR[kVoiceRenderBufferSize] = {};
    float mDry [kVoiceRenderBufferSize] = {};   // live-mode dry copy (mono)
    float mIn  [kVoiceRenderBufferSize] = {};   // live input pull buffer

    // ── Command queue ─────────────────────────────────────────────────────
    AudioThreadSafeQueue<VoiceCommand, kVoiceCommandCapacity> mCommandQueue;

    // ── Atomic state ──────────────────────────────────────────────────────
    std::atomic<int32_t> mActiveUnits{0};
    std::atomic<float>   mOutputLevel{0.0f};
    std::atomic<float>   mInputLevel {0.0f};
    std::atomic<bool>    mIsPlaying  {false};
    std::atomic<uint64_t> mProcessEpoch{0};

    double mCurrentBpm  = 120.0;
    int    mBeatsPerBar = 4;
    int    mSampleRate  = 48000;
    int    mMaxFrames   = 96;
    bool   mPrepared    = false;

    // Input envelope (for breath gating in Live mode)
    float  mInputEnv    = 0.0f;
};

} // namespace vibecore
