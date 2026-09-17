#pragma once
/**
 * GrooveNode.h — VibeCore Groove as an AudioNode.
 *
 * GrooveNode is the Audio Graph entry point for the entire Groove Engine.
 * It bridges the Phase 1+2 native platform (Oboe + VibeCoreSync) with
 * the full groove feature set: step sequencing, piano roll, voice playback,
 * scene management, and all groove controls.
 *
 * Audio Thread callback sequence (every Oboe callback):
 *   ① VibeCoreSync dispatches TickEventBuffer to AudioGraphManager
 *   ② AudioGraphManager::dispatchSyncEvents() calls our onTick/onBeat/onBar/…
 *   ③ In onTick(): StepSequencers + PianoRolls write Triggers to mTriggerQueue
 *   ④ AudioGraphManager::process() calls our process()
 *   ⑤ In process(): drain TriggerQueue → VoicePool::trigger() → VoicePool::process()
 *
 * UI Thread → Audio Thread: all state changes go through mCommandQueue.
 *   drainCommands() runs at the start of every onTick() call.
 *
 * Memory model:
 *   mTracks[kMaxTracks]        — pattern/piano roll data (Audio Thread copy)
 *   mSequencers[kMaxTracks]    — per-track step sequencer state
 *   mPianoRolls[kMaxTracks]    — per-track piano roll scheduler
 *   mVoicePool                 — 64-voice polyphonic engine
 *   mTriggerQueue              — within-callback trigger buffer (stack equiv.)
 *   mSceneEngine               — scene/chain management
 *   mCommandQueue              — UI→Audio lock-free SPSC
 *
 * AUDIO THREAD SAFETY:
 *   All onSync*() and process() methods: zero allocation, zero locking.
 *   Probability RNG: single xorshift32 state (Audio Thread only).
 *   Pattern changes: double-buffered via mPendingPattern per track.
 *
 * UNDO / REDO (UI Thread, not Audio Thread):
 *   GrooveEngine owns the undo/redo stack (not GrooveNode).
 *   GrooveNode only knows about current state.
 */

#include "../graph/AudioNode.h"
#include "../platform/sync/MusicalPosition.h"
#include "../threads/AudioThreadSafeQueue.h"
#include "GrooveTypes.h"
#include "GrooveCommands.h"
#include "StepSequencer.h"
#include "PianoRoll.h"
#include "VoicePool.h"
#include "TriggerQueue.h"
#include "SceneEngine.h"
#include <array>
#include <atomic>
#include <cstdint>

namespace vibecore {

class BassNode;    // Phase 5 instrument target (zero-latency trigger path)
class VoiceNode;   // Phase 6 instrument target (zero-latency trigger path)

class GrooveNode : public AudioNode {
public:
    explicit GrooveNode(NodeId id);
    ~GrooveNode() override = default;

    // ── AudioNode lifecycle (UI Thread) ───────────────────────────────────
    void prepare(int sampleRate, int maxFramesPerCallback) override;
    void reset()  override;
    void process(const float* input, float* output,
                 int numFrames, int numChannels) noexcept override;

    // ── AudioNode sync events (Audio Thread) ─────────────────────────────
    void onTransportStart(int32_t sampleOffset)                             noexcept override;
    void onTransportStop (int32_t sampleOffset)                             noexcept override;
    void onTick  (int64_t tick, const MusicalPosition& pos, int32_t off)    noexcept override;
    void onBeat  (int64_t tick, const MusicalPosition& pos, int32_t off)    noexcept override;
    void onBar   (int64_t tick, const MusicalPosition& pos, int32_t off)    noexcept override;
    void onLoop  (int64_t loopCount, int32_t sampleOffset)                  noexcept override;
    void onTempoChanged(double newBpm, int32_t sampleOffset)                noexcept override;

    // ── UI Thread API (all go through command queue) ──────────────────────

    // Step editing
    void setStep(int track, int step, bool active,
                 uint8_t vel = 100, uint8_t note = 60) noexcept;
    void setStepVelocity   (int track, int step, uint8_t vel)   noexcept;
    void setStepNote       (int track, int step, uint8_t note)  noexcept;
    void setStepProbability(int track, int step, uint8_t prob)  noexcept;
    void setStepMuted      (int track, int step, bool muted)    noexcept;
    void setStepAccent     (int track, int step, bool accent)   noexcept;
    void setStepRoll       (int track, int step, uint8_t count) noexcept;
    void setStepFlam       (int track, int step, bool flam)     noexcept;
    void setStepMicroTiming(int track, int step, int16_t ticks) noexcept;

    // Pattern
    void setPatternLength(int track, int steps) noexcept;
    void setSwing        (int track, uint8_t swing) noexcept;
    void setHumanize     (int track, uint8_t humanize) noexcept;
    void clearPattern    (int track) noexcept;

    // Track
    void setTrackMute  (int track, bool muted)   noexcept;
    void setTrackSolo  (int track, bool soloed)  noexcept;
    void setTrackVolume(int track, uint8_t vol)  noexcept;
    void setTrackSample(int track, int sampleId) noexcept;
    void setTrackMode  (int track, TrackMode mode) noexcept;

    // Scene
    void setActiveScene(int32_t sceneIdx) noexcept;
    void setPatternBank(int track, int bank) noexcept;
    void configureSceneBank(int32_t sceneIdx, int track, int bank) noexcept;
    void queueSceneChange(int32_t sceneIdx) noexcept;

    // Piano Roll
    void addPianoRollNote   (int track, int64_t start, int64_t end,
                             uint8_t note, uint8_t vel) noexcept;
    void updatePianoRollNote(int track, int32_t noteIndex,
                             int64_t start, int64_t end,
                             uint8_t note, uint8_t vel) noexcept;
    void removePianoRollNote(int track, int32_t noteIndex) noexcept;
    void clearPianoRoll     (int track) noexcept;

    // Sample registration (before stream starts)
    void registerSample(int32_t sampleId, const SampleBuffer& buf) noexcept;

    // Instrument targets (UI Thread, before stream starts).
    // Triggers for tracks in Bass/Voice mode are dispatched DIRECTLY on the
    // Audio Thread to these nodes — zero latency, no queue hop.
    void setBassTarget (BassNode*  node) noexcept { mBassTarget  = node; }
    void setVoiceTarget(VoiceNode* node) noexcept { mVoiceTarget = node; }

    // ── Query (approximate, any thread) ───────────────────────────────────
    int32_t activeVoiceCount()  const noexcept;
    int32_t currentStep(int track) const noexcept;
    int32_t activeScene()       const noexcept;
    bool    isPlaying()         const noexcept;

private:
    // ── Audio Thread exclusive state ──────────────────────────────────────
    std::array<Track, kMaxTracks>           mTracks    = {};
    std::array<StepSequencer, kMaxTracks>   mSequencers= {};
    std::array<PianoRoll, kMaxTracks>       mPianoRolls= {};
    VoicePool                               mVoicePool;
    TriggerQueue                            mTriggerQueue;
    SceneEngine                             mSceneEngine;

    // Instrument targets — set on UI Thread before stream, read on Audio Thread
    BassNode*                               mBassTarget  = nullptr;
    VoiceNode*                              mVoiceTarget = nullptr;

    bool    mTransportRunning = false;
    int32_t mSampleRate       = 48000;

    // Per-track solo bookkeeping (Audio Thread)
    bool    mAnySoloed        = false;

    // Deterministic RNG (Audio Thread only)
    uint32_t mRng = 0xC0FFEE42;

    // ── Cross-thread command queue ────────────────────────────────────────
    AudioThreadSafeQueue<GrooveCommand, 4096> mCommandQueue;

    // ── Atomic approximate state (for UI display) ─────────────────────────
    std::atomic<int32_t> mPublicActiveVoices{0};
    std::atomic<bool>    mPublicIsPlaying{false};

    // ── Private Audio Thread methods ──────────────────────────────────────
    void drainCommands()            noexcept;
    void handleCommand(const GrooveCommand& cmd) noexcept;
    bool trackShouldPlay(int t)     const noexcept;
    void rebuildSoloState()         noexcept;
    void syncSequencerToTrack(int t) noexcept;

    void sendCommand(const GrooveCommand& c) noexcept;
};

} // namespace vibecore
