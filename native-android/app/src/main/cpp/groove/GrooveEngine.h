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
 *
 *   EVERY mutation:
 *     1. Updates mUITracks (UI Thread — immediately consistent)
 *     2. Sends GrooveCommand to GrooveNode queue (applied on Audio Thread)
 *     3. Pushes a PatternSnapshot to UndoStack (for undo-able ops)
 *
 *   This guarantees:
 *     · undo() / redo() always work from real pattern data
 *     · copyPattern() always copies real pattern data
 *     · no gap between UI state and Audio Thread state (eventual consistency)
 *
 *   UI Mirror contract:
 *     · mUITracks is ONLY written on UI Thread
 *     · mUITracks is NEVER read on Audio Thread
 *     · Audio Thread owns mTracks inside GrooveNode (separate copy)
 *     · Commands are the synchronisation mechanism — not shared pointers
 *
 * Thread model: ALL GrooveEngine methods → UI Thread only.
 */

#include "GrooveNode.h"
#include "GrooveTypes.h"
#include <array>
#include <cstdint>
#include <cstring>

namespace vibecore {

static constexpr int kMaxUndoDepth = 64;

// ─── PatternSnapshot ──────────────────────────────────────────────────────────
// One snapshot = one track's full pattern at one point in time.
// Stored in the undo ring. Never heap-allocated.

struct PatternSnapshot {
    int32_t trackIndex = 0;
    int32_t bankIndex  = 0;
    Pattern pattern    = {};
    bool    valid      = false;
};

// ─── UndoStack ────────────────────────────────────────────────────────────────

class UndoStack {
public:
    bool canUndo() const noexcept { return mSize > 0 && mCursor > 0; }
    bool canRedo() const noexcept { return mCursor < mSize; }

    void push(const PatternSnapshot& snap) noexcept {
        mSize   = mCursor;  // truncate redo history
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

// ─── UITrack — UI-Thread-side track mirror ────────────────────────────────────

struct UITrack {
    std::array<Pattern, kMaxPatternsPerBank> banks  = {};
    int32_t   activeBank   = 0;
    TrackMode mode         = TrackMode::Drum;
    int32_t   sampleId     = -1;
    uint8_t   volume       = 100;
    uint8_t   chokeGroup   = 0;
    bool      muted        = false;
    bool      soloed       = false;

    Pattern&       activePattern()             noexcept { return banks[activeBank]; }
    const Pattern& activePattern()       const noexcept { return banks[activeBank]; }
    Pattern&       bank(int32_t b)             noexcept { return banks[b % kMaxPatternsPerBank]; }
    const Pattern& bank(int32_t b)       const noexcept { return banks[b % kMaxPatternsPerBank]; }
};

// ─── GrooveEngine ─────────────────────────────────────────────────────────────

class GrooveEngine {
public:
    explicit GrooveEngine(GrooveNode& node);
    ~GrooveEngine() = default;

    // ── Step editing (with undo) ──────────────────────────────────────────
    void setStep           (int t, int s, bool active, uint8_t vel = 100, uint8_t note = 60);
    void setStepVelocity   (int t, int s, uint8_t vel);
    void setStepNote       (int t, int s, uint8_t note);
    void setStepProbability(int t, int s, uint8_t prob);
    void setStepMuted      (int t, int s, bool muted);
    void setStepAccent     (int t, int s, bool accent);
    void setStepRoll       (int t, int s, uint8_t count);
    void setStepFlam       (int t, int s, bool flam);
    void setStepMicroTiming(int t, int s, int16_t ticks);

    // ── Pattern (with undo) ───────────────────────────────────────────────
    void setPatternLength(int t, int steps);
    void setSwing        (int t, uint8_t swing);
    void setHumanize     (int t, uint8_t humanize);
    void clearPattern    (int t);

    // ── Copy / Paste (fully implemented) ─────────────────────────────────
    void copyPattern (int t);                  // snapshot active pattern to clipboard
    void pastePattern(int t);                  // paste clipboard → track t (with undo)
    bool hasClipboard() const noexcept { return mClipboardValid; }
    const Pattern& clipboard() const noexcept  { return mClipboard; }

    // ── Undo / Redo ────────────────────────────────────────────────────────
    bool undo();
    bool redo();
    bool canUndo() const noexcept { return mUndoStack.canUndo(); }
    bool canRedo() const noexcept { return mUndoStack.canRedo(); }
    void clearUndoHistory() noexcept { mUndoStack.clear(); }

    // ── Track ──────────────────────────────────────────────────────────────
    void setTrackMute  (int t, bool muted);
    void setTrackSolo  (int t, bool soloed);
    void setTrackVolume(int t, uint8_t vol);
    void setTrackSample(int t, int sampleId);
    void setTrackMode  (int t, TrackMode mode);

    // ── Scene ──────────────────────────────────────────────────────────────
    void queueSceneChange(int32_t sceneIdx) { mNode.queueSceneChange(sceneIdx); }

    // ── Piano Roll ──────────────────────────────────────────────────────────
    void addPianoRollNote   (int t, int64_t start, int64_t end, uint8_t note, uint8_t vel);
    void removePianoRollNote(int t, int32_t index);
    void clearPianoRoll     (int t);

    // ── Sample ─────────────────────────────────────────────────────────────
    void registerSample(int32_t id, const SampleBuffer& buf) {
        mNode.registerSample(id, buf);
    }

    // ── UI-mirror reads (UI Thread only) ──────────────────────────────────
    const UITrack&  uiTrack(int t)          const noexcept { return mUITracks[t]; }
    const Pattern&  uiActivePattern(int t)  const noexcept { return mUITracks[t].activePattern(); }
    const Step&     uiStep(int t, int s)    const noexcept { return mUITracks[t].activePattern().steps[s]; }
    bool            uiTrackMuted(int t)     const noexcept { return mUITracks[t].muted; }
    bool            uiTrackSoloed(int t)    const noexcept { return mUITracks[t].soloed; }

    // ── Live query (approximate, any thread) ──────────────────────────────
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

    // UI-Thread mirror of all track state
    std::array<UITrack, kMaxTracks> mUITracks = {};

    // ── Internal helpers ──────────────────────────────────────────────────
    bool validTrack(int t) const noexcept { return t >= 0 && t < kMaxTracks; }
    bool validStep (int s) const noexcept { return s >= 0 && s < kMaxSteps;  }

    // Snapshot the current active pattern of track t BEFORE mutation.
    // Must be called before any destructive step/pattern change.
    void snapshotBefore(int t);

    // Apply a PatternSnapshot to both the UI mirror and GrooveNode.
    // Used by undo() and redo().
    void applySnapshot(const PatternSnapshot& snap);

    // Replay the full content of `pat` to the GrooveNode for track t.
    void replayPatternToNode(int t, const Pattern& pat);
};

} // namespace vibecore
