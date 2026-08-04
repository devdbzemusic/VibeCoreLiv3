#pragma once
/**
 * BassEngine.h — UI-facing coordinator for VibeCore 3D Bass.
 *
 * Architecture (matches GrooveEngine pattern exactly):
 *
 *   BassEngine owns:
 *     · BassNode& (reference — lifetime managed by AudioGraphManager)
 *     · UIBassState — UI-Thread mirror of all synth parameters
 *     · UndoBassStack — preset undo (kMaxBassUndoDepth = 32 full-param snapshots)
 *
 *   EVERY mutation:
 *     1. Updates UIBassState (UI Thread — immediately consistent)
 *     2. Sends BassCommand to BassNode queue (applied on Audio Thread)
 *
 *   UI Mirror contract:
 *     · UIBassState is ONLY written on UI Thread
 *     · UIBassState is NEVER read on Audio Thread
 *     · Audio Thread owns mParams inside BassNode (separate copy)
 *
 * Thread model: ALL BassEngine methods → UI Thread only.
 */

#include "BassNode.h"
#include "BassTypes.h"
#include "BassCommands.h"

namespace vibecore {

static constexpr int kMaxBassUndoDepth = 32;

// ─── Param snapshot for undo ──────────────────────────────────────────────────

struct BassParamSnapshot {
    BassParams params = {};
    bool       valid  = false;
};

// ─── BassUndoStack ────────────────────────────────────────────────────────────

class BassUndoStack {
public:
    bool canUndo() const noexcept { return mSize > 0 && mCursor > 0; }
    bool canRedo() const noexcept { return mCursor < mSize; }

    void push(const BassParamSnapshot& snap) noexcept {
        mSize   = mCursor;
        const int slot = mCursor % kMaxBassUndoDepth;
        mStack[slot] = snap;
        ++mCursor;
        if (mSize < kMaxBassUndoDepth) ++mSize;
    }

    const BassParamSnapshot* undo() noexcept {
        if (!canUndo()) return nullptr;
        return &mStack[(--mCursor) % kMaxBassUndoDepth];
    }

    const BassParamSnapshot* redo() noexcept {
        if (!canRedo()) return nullptr;
        const auto* s = &mStack[mCursor % kMaxBassUndoDepth];
        ++mCursor;
        return s;
    }

    void clear() noexcept { mSize = mCursor = 0; }

private:
    std::array<BassParamSnapshot, kMaxBassUndoDepth> mStack = {};
    int mSize   = 0;
    int mCursor = 0;
};

// ─── BassEngine ───────────────────────────────────────────────────────────────

class BassEngine {
public:
    explicit BassEngine(BassNode& node);

    // ── Oscillator ────────────────────────────────────────────────────────
    void setWaveform  (BassWaveform w);
    void setMorphPos  (float pos);           // 0–7
    void setDetune    (float cents);
    void setOctave    (float octave);
    void setSemi      (float semi);
    void setFine      (float cents);

    // ── Voice ─────────────────────────────────────────────────────────────
    void setVoiceMode (BassVoiceMode mode);
    void setGlideMs   (float ms);
    void setVolume    (float vol);           // 0–1
    void setPan       (float pan);           // –1..+1

    // ── Filter ────────────────────────────────────────────────────────────
    void setFilterType (BassFilterType type);
    void setCutoff     (float hz);
    void setResonance  (float q);            // 0–1
    void setFilterDrive(float drive);        // 0–1

    // ── Envelope 0 (Amp) ──────────────────────────────────────────────────
    void setEnv0Attack (float ms);
    void setEnv0Decay  (float ms);
    void setEnv0Sustain(float s);
    void setEnv0Release(float ms);
    void setEnv0VelAmt (float a);

    // ── Envelope 1 (Mod) ──────────────────────────────────────────────────
    void setEnv1Attack (float ms);
    void setEnv1Decay  (float ms);
    void setEnv1Sustain(float s);
    void setEnv1Release(float ms);
    void setEnv1VelAmt (float a);

    // ── LFO 0 ─────────────────────────────────────────────────────────────
    void setLFO0Shape  (BassLFOShape shape);
    void setLFO0Rate   (float hz);
    void setLFO0Depth  (float depth);
    void setLFO0Sync   (BassLFOSync sync);
    void setLFO0Retrig (bool retrig);

    // ── LFO 1 ─────────────────────────────────────────────────────────────
    void setLFO1Shape  (BassLFOShape shape);
    void setLFO1Rate   (float hz);
    void setLFO1Depth  (float depth);
    void setLFO1Sync   (BassLFOSync sync);
    void setLFO1Retrig (bool retrig);

    // ── Modulation matrix ─────────────────────────────────────────────────
    void setModRoute   (int routeIndex, const BassModRoute& route);
    void clearModRoutes();

    // ── 3D Stereo ─────────────────────────────────────────────────────────
    void setStereoWidth   (float width);    // 0–2
    void setStereoMidGain (float gain);
    void setStereoSideGain(float gain);
    void setStereoEnabled (bool enabled);

    // ── Direct triggers (from UI, e.g. keyboard on screen) ───────────────
    void noteOn (uint8_t note, uint8_t velocity, int32_t sampleOffset = 0);
    void noteOff(uint8_t note, int32_t sampleOffset = 0);
    void allNotesOff();

    // ── Preset load (with undo) ───────────────────────────────────────────
    void loadPreset (const BassParams& params);
    bool undo();
    bool redo();
    bool canUndo() const noexcept { return mUndoStack.canUndo(); }
    bool canRedo() const noexcept { return mUndoStack.canRedo(); }
    void clearUndoHistory() noexcept { mUndoStack.clear(); }

    // ── UI-mirror reads (UI Thread only) ──────────────────────────────────
    const BassParams&   params()        const noexcept { return mUIState.params; }
    const UIBassState&  uiState()       const noexcept { return mUIState; }

    // ── Live reads (approximate, any thread) ──────────────────────────────
    int32_t activeVoiceCount() const noexcept { return mNode.activeVoiceCount(); }
    float   outputLevel()      const noexcept { return mNode.outputLevel(); }
    bool    isPlaying()        const noexcept { return mNode.isPlaying(); }

    BassNode&       node()       noexcept { return mNode; }
    const BassNode& node() const noexcept { return mNode; }

private:
    void send(const BassCommand& cmd) noexcept { mNode.enqueueCommand(cmd); }
    void snapshotBefore() noexcept;

    BassNode&      mNode;
    UIBassState    mUIState;
    BassUndoStack  mUndoStack;
};

} // namespace vibecore
