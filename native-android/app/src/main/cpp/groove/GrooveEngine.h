#pragma once
/**
 * GrooveEngine.h — UI-facing coordinator for the VibeCore Groove system.
 *
 * GrooveEngine owns:
 *   · GrooveNode (the AudioNode in the graph)
 *   · Pattern undo/redo stack (UI thread only)
 *   · Pattern copy/paste clipboard (UI thread only)
 *   · High-level API (load kit, import pattern, etc.)
 *
 * GrooveEngine does NOT own the VibeCoreAudioEngine — it receives
 * the GrooveNode reference from VibeCoreAudioEngine::graph().
 *
 * Thread model:
 *   All GrooveEngine methods: UI Thread.
 *   All audio operations: via GrooveNode command queue (lock-free).
 *
 * Undo/Redo:
 *   PatternSnapshot — a copy of one track's Pattern + PianoRollData.
 *   UndoStack — fixed-size ring of kMaxUndoDepth snapshots.
 *   pushUndo() / undo() / redo() — UI Thread only.
 */

#include "GrooveNode.h"
#include "GrooveTypes.h"
#include <array>
#include <memory>
#include <cstdint>

namespace vibecore {

static constexpr int kMaxUndoDepth = 64;

struct PatternSnapshot {
    int32_t  trackIndex = 0;
    int32_t  bankIndex  = 0;
    Pattern  pattern    = {};
    bool     valid      = false;
};

class UndoStack {
public:
    bool canUndo() const noexcept { return mSize > 0 && mCursor > 0; }
    bool canRedo() const noexcept { return mCursor < mSize; }

    void push(const PatternSnapshot& snap) noexcept {
        // Truncate any redo history above cursor
        mSize   = mCursor;
        mStack[mCursor % kMaxUndoDepth] = snap;
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

class GrooveEngine {
public:
    explicit GrooveEngine(GrooveNode& node);
    ~GrooveEngine() = default;

    // ── Step editing (with undo) ──────────────────────────────────────────
    void setStep(int track, int step, bool active,
                 uint8_t vel = 100, uint8_t note = 60);
    void setStepVelocity   (int track, int step, uint8_t vel);
    void setStepNote       (int track, int step, uint8_t note);
    void setStepProbability(int track, int step, uint8_t prob);
    void setStepMuted      (int track, int step, bool muted);
    void setStepAccent     (int track, int step, bool accent);
    void setStepRoll       (int track, int step, uint8_t count);
    void setStepFlam       (int track, int step, bool flam);
    void setStepMicroTiming(int track, int step, int16_t ticks);

    // ── Pattern ops (with undo) ────────────────────────────────────────────
    void setPatternLength(int track, int steps);
    void setSwing   (int track, uint8_t swing);
    void setHumanize(int track, uint8_t humanize);
    void clearPattern(int track);

    // ── Copy / Paste ───────────────────────────────────────────────────────
    void copyPattern (int track);
    void pastePattern(int track);

    // ── Undo / Redo ────────────────────────────────────────────────────────
    bool undo();
    bool redo();
    bool canUndo() const noexcept { return mUndoStack.canUndo(); }
    bool canRedo() const noexcept { return mUndoStack.canRedo(); }

    // ── Track ──────────────────────────────────────────────────────────────
    void setTrackMute  (int track, bool muted)    { mNode.setTrackMute(track, muted);   }
    void setTrackSolo  (int track, bool soloed)   { mNode.setTrackSolo(track, soloed);  }
    void setTrackVolume(int track, uint8_t vol)   { mNode.setTrackVolume(track, vol);   }
    void setTrackSample(int track, int sampleId)  { mNode.setTrackSample(track, sampleId); }
    void setTrackMode  (int track, TrackMode mode){ mNode.setTrackMode(track, mode);    }

    // ── Scene ──────────────────────────────────────────────────────────────
    void queueSceneChange(int32_t sceneIdx) { mNode.queueSceneChange(sceneIdx); }

    // ── Piano Roll ─────────────────────────────────────────────────────────
    void addPianoRollNote   (int track, int64_t start, int64_t end,
                             uint8_t note, uint8_t vel);
    void removePianoRollNote(int track, int32_t index);
    void clearPianoRoll     (int track);

    // ── Sample ─────────────────────────────────────────────────────────────
    void registerSample(int32_t id, const SampleBuffer& buf) {
        mNode.registerSample(id, buf);
    }

    // ── Query ──────────────────────────────────────────────────────────────
    int32_t activeVoiceCount()  const noexcept { return mNode.activeVoiceCount(); }
    int32_t currentStep(int t)  const noexcept { return mNode.currentStep(t); }
    int32_t activeScene()       const noexcept { return mNode.activeScene(); }
    bool    isPlaying()         const noexcept { return mNode.isPlaying(); }
    const GrooveNode& node()    const noexcept { return mNode; }
    GrooveNode&       node()          noexcept { return mNode; }

private:
    GrooveNode& mNode;
    UndoStack   mUndoStack;
    Pattern     mClipboard;
    bool        mClipboardValid = false;

    // Snapshot before any destructive change
    void snapshot(int track);

    // Apply a snapshot to the node (for undo/redo)
    void applySnapshot(const PatternSnapshot& snap);
};

} // namespace vibecore
