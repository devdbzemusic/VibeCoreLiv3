#pragma once
/**
 * GrooveEngine.h — UI-facing coordinator for the VibeCore Groove system.
 *
 * Architecture (Phase 4 — fully hardened):
 *
 *   GrooveEngine owns:
 *     · GrooveNode& (reference — lifetime managed by AudioGraphManager)
 *     · mUITracks[kMaxTracks]  — UI-Thread mirror of every track's state
 *     · mUIBanks per track     — full copy of all pattern banks
 *     · UndoStack              — fixed-depth (kMaxUndoDepth = 64) snapshot ring
 *     · mClipboard             — copy/paste pattern buffer
 *     · mSampleStorage         — UI-thread-owned PCM backing for cold-loaded
 *                               Groove SampleBuffer views
 *
 *   EVERY user mutation:
 *     1. Updates mUITracks (UI Thread — immediately consistent)
 *     2. Sends GrooveCommand to GrooveNode queue (applied on Audio Thread)
 *     3. Pushes a PatternSnapshot to UndoStack (for undo-able ops)
 *
 *   Project-load replay is the one explicit exception: beginProjectLoad() /
 *   endProjectLoad() suppress undo snapshots while the authoritative JS project
 *   is mirrored into the native renderer. This prevents startup hydration from
 *   becoming fake user-edit history.
 *
 * Thread model: ALL GrooveEngine methods → UI Thread only.
 */

#include "GrooveNode.h"
#include "GrooveTypes.h"
#include <array>
#include <cstdint>
#include <cstring>
#include <memory>

namespace vibecore {

static constexpr int kMaxUndoDepth = 64;

struct PatternSnapshot {
    int32_t trackIndex = 0;
    int32_t bankIndex  = 0;
    Pattern pattern    = {};
    bool    valid      = false;
};

class UndoStack {
public:
    bool canUndo() const noexcept { return mSize > 0 && mCursor > 0; }
    bool canRedo() const noexcept { return mCursor < mSize; }

    void push(const PatternSnapshot& snap) noexcept {
        mSize   = mCursor;
        const int32_t slot = mCursor % kMaxUndoDepth;
        mStack[slot] = snap;
        mCursor++;
        if (mSize < kMaxUndoDepth) mSize++;
    }

    const PatternSnapshot* undo() noexcept {
        if (!canUndo()) return nullptr;
        --mCursor;
        return &mStack[mCursor % kMaxUndoDepth];
    }

    const PatternSnapshot* redo() noexcept {
        if (!canRedo()) return nullptr;
        const PatternSnapshot* s = &mStack[mCursor % kMaxUndoDepth];
        ++mCursor;
        return s;
    }

    void clear() noexcept { mSize = mCursor = 0; }

private:
    std::array<PatternSnapshot, kMaxUndoDepth> mStack = {};
    int32_t mSize   = 0;
    int32_t mCursor = 0;
};

struct UITrack {
    std::array<Pattern, kMaxPatternsPerBank> banks  = {};
    int32_t   activeBank   = 0;
    TrackMode mode         = TrackMode::Drum;
    int32_t   sampleId     = -1;
    uint8_t   volume       = 100;
    int8_t    pan          = 0;
    uint8_t   chokeGroup   = 0;
    bool      muted        = false;
    bool      soloed       = false;

    Pattern&       activePattern()             noexcept { return banks[activeBank]; }
    const Pattern& activePattern()       const noexcept { return banks[activeBank]; }
    Pattern&       bank(int32_t b)             noexcept { return banks[b % kMaxPatternsPerBank]; }
    const Pattern& bank(int32_t b)       const noexcept { return banks[b % kMaxPatternsPerBank]; }
};

class GrooveEngine {
public:
    explicit GrooveEngine(GrooveNode& node);
    ~GrooveEngine() = default;

    void setStep           (int t, int s, bool active, uint8_t vel = 100, uint8_t note = 60);
    void setStepVelocity   (int t, int s, uint8_t vel);
    void setStepNote       (int t, int s, uint8_t note);
    void setStepProbability(int t, int s, uint8_t prob);
    void setStepMuted      (int t, int s, bool muted);
    void setStepAccent     (int t, int s, bool accent);
    void setStepRoll       (int t, int s, uint8_t count);
    void setStepFlam       (int t, int s, bool flam);
    void setStepMicroTiming(int t, int s, int16_t ticks);

    void setPatternLength(int t, int steps);
    void setSwing        (int t, uint8_t swing);
    void setHumanize     (int t, uint8_t humanize);
    void clearPattern    (int t);

    void copyPattern (int t);
    void pastePattern(int t);
    bool hasClipboard() const noexcept { return mClipboardValid; }
    const Pattern& clipboard() const noexcept  { return mClipboard; }

    bool undo();
    bool redo();
    bool canUndo() const noexcept { return mUndoStack.canUndo(); }
    bool canRedo() const noexcept { return mUndoStack.canRedo(); }
    void clearUndoHistory() noexcept { mUndoStack.clear(); }

    /** Hydration boundary: suppress undo snapshots during authoritative project replay. */
    void beginProjectLoad() noexcept { mProjectLoadDepth++; }
    void endProjectLoad() noexcept { if (mProjectLoadDepth > 0) --mProjectLoadDepth; }
    bool isProjectLoading() const noexcept { return mProjectLoadDepth > 0; }

    void setTrackMute  (int t, bool muted);
    void setTrackSolo  (int t, bool soloed);
    void setTrackVolume(int t, uint8_t vol);
    void setTrackPan   (int t, int8_t pan);
    void setTrackSample(int t, int sampleId);
    void setTrackMode  (int t, TrackMode mode);

    void setPatternBank(int t, int bank);
    void configureSceneBank(int32_t sceneIdx, int t, int bank) {
        mNode.configureSceneBank(sceneIdx, t, bank);
    }
    void setActiveScene(int32_t sceneIdx) { mNode.setActiveScene(sceneIdx); }
    void queueSceneChange(int32_t sceneIdx) { mNode.queueSceneChange(sceneIdx); }

    void addPianoRollNote   (int t, int64_t start, int64_t end, uint8_t note, uint8_t vel);
    void removePianoRollNote(int t, int32_t index);
    void clearPianoRoll     (int t);

    /**
     * Cold-load PCM into Groove-owned storage and publish a read-only view to
     * VoicePool. PRECONDITION: native audio stream is stopped. Hot replacement
     * requires the later epoch/deferred-free protocol and must not call this.
     */
    bool loadSample(int32_t id, const float* monoData, int32_t lengthFrames, int32_t sampleRate);
    void clearSample(int32_t id);
    bool sampleLoaded(int32_t id) const noexcept;

    /** Low-level view registration retained for native tests/bootstrap only. */
    void registerSample(int32_t id, const SampleBuffer& buf) {
        mNode.registerSample(id, buf);
    }

    const UITrack&  uiTrack(int t)          const noexcept { return mUITracks[t]; }
    const Pattern&  uiActivePattern(int t)  const noexcept { return mUITracks[t].activePattern(); }
    const Step&     uiStep(int t, int s)    const noexcept { return mUITracks[t].activePattern().steps[s]; }
    bool            uiTrackMuted(int t)     const noexcept { return mUITracks[t].muted; }
    bool            uiTrackSoloed(int t)    const noexcept { return mUITracks[t].soloed; }

    int32_t activeVoiceCount()  const noexcept { return mNode.activeVoiceCount(); }
    int32_t currentStep(int t)  const noexcept { return mNode.currentStep(t); }
    int32_t activeScene()       const noexcept { return mNode.activeScene(); }
    bool    isPlaying()         const noexcept { return mNode.isPlaying(); }

    GrooveNode& node()             noexcept { return mNode; }
    const GrooveNode& node() const noexcept { return mNode; }

private:
    GrooveNode&  mNode;
    UndoStack    mUndoStack;
    Pattern      mClipboard;
    bool         mClipboardValid = false;
    int32_t      mProjectLoadDepth = 0;

    std::array<UITrack, kMaxTracks> mUITracks = {};
    std::array<std::unique_ptr<float[]>, kMaxSamples> mSampleStorage = {};
    std::array<int32_t, kMaxSamples> mSampleLengths = {};
    std::array<int32_t, kMaxSamples> mSampleRates = {};

    bool validTrack(int t) const noexcept { return t >= 0 && t < kMaxTracks; }
    bool validStep (int s) const noexcept { return s >= 0 && s < kMaxSteps;  }

    void snapshotBefore(int t);
    void applySnapshot(const PatternSnapshot& snap);
    void replayPatternToNode(int t, const Pattern& pat);
};

} // namespace vibecore
