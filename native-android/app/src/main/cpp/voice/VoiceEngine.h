#pragma once
/**
 * VoiceEngine.h — UI-facing coordinator for VibeCore Voice.
 *
 * Architecture (matches BassEngine / GrooveEngine pattern exactly):
 *
 *   VoiceEngine owns:
 *     · VoiceNode& (reference — lifetime managed by AudioGraphManager)
 *     · UIVoiceState — UI-Thread mirror of all module parameters
 *     · VoiceUndoStack — preset undo (32 full-param snapshots)
 *     · Sample storage — heap buffers for loaded samples (deferred-free)
 *
 *   EVERY mutation:
 *     1. Updates UIVoiceState (UI Thread — immediately consistent)
 *     2. Sends VoiceCommand to VoiceNode queue (applied on Audio Thread)
 *
 *   Sample ownership (deferred-free protocol):
 *     loadSample() allocates a new buffer, publishes it via SetSampleData,
 *     RETIRES the previous buffer of the same slot, and frees the buffer
 *     retired two loads ago. A published pointer therefore outlives its
 *     replacement by one full load cycle — the Audio Thread drains the
 *     replacement command within one callback, long before that.
 *
 * Thread model: ALL VoiceEngine methods → UI Thread only.
 */

#include "VoiceNode.h"
#include "VoiceTypes.h"
#include "VoiceCommands.h"
#include <array>
#include <memory>

namespace vibecore {

static constexpr int kMaxVoiceUndoDepth = 32;

struct VoiceParamSnapshot {
    VoiceParams params = {};
    bool        valid  = false;
};

class VoiceUndoStack {
public:
    bool canUndo() const noexcept { return mSize > 0 && mCursor > 0; }
    bool canRedo() const noexcept { return mCursor < mSize; }

    void push(const VoiceParamSnapshot& snap) noexcept {
        mSize = mCursor;
        mStack[mCursor % kMaxVoiceUndoDepth] = snap;
        ++mCursor;
        if (mSize < kMaxVoiceUndoDepth) ++mSize;
    }
    const VoiceParamSnapshot* undo() noexcept {
        if (!canUndo()) return nullptr;
        return &mStack[(--mCursor) % kMaxVoiceUndoDepth];
    }
    const VoiceParamSnapshot* redo() noexcept {
        if (!canRedo()) return nullptr;
        const auto* s = &mStack[mCursor % kMaxVoiceUndoDepth];
        ++mCursor;
        return s;
    }
    void clear() noexcept { mSize = mCursor = 0; }

private:
    std::array<VoiceParamSnapshot, kMaxVoiceUndoDepth> mStack = {};
    int mSize = 0, mCursor = 0;
};

// ─── VoiceEngine ──────────────────────────────────────────────────────────────

class VoiceEngine {
public:
    explicit VoiceEngine(VoiceNode& node);
    ~VoiceEngine();

    // ── Mode ──────────────────────────────────────────────────────────────
    void setGlobalMode(VoiceGlobalMode mode);
    void setPolyMode  (VoicePolyMode mode);
    void setPlayMode  (VoicePlayMode mode);

    // ── Master ────────────────────────────────────────────────────────────
    void setVolume    (float v);
    void setDryWet    (float v);
    void setMonitor   (float v);
    void setGlideMs   (float ms);
    void setActiveSlot(int slot);
    void setRootNote  (int note);

    // ── Pitch / Formant ──────────────────────────────────────────────────
    void setPitchSemitones  (float st);
    void setPitchEnabled    (bool e);
    void setFormantSemitones(float st);
    void setFormantEnabled  (bool e);

    // ── Harmonizer / Doubler ─────────────────────────────────────────────
    void setHarmonyVoice  (int index, float semitones, float level, float pan);
    void setHarmonyMaster (float level);
    void setHarmonyEnabled(bool e);
    void setDoubler       (float detuneCents, float level, float widthSpread, bool enabled);

    // ── Dynamics ─────────────────────────────────────────────────────────
    void setGate      (float thresholdDb, float attackMs, float releaseMs, bool enabled);
    void setDeEsser   (float frequencyHz, float thresholdDb, float amount, bool enabled);
    void setCompressor(float thresholdDb, float ratio, float attackMs,
                       float releaseMs, float makeupDb, bool enabled);
    void setEQ        (float lowHz, float lowDb, float midHz, float midDb,
                       float midQ, float highHz, float highDb, bool enabled);

    // ── Breath ───────────────────────────────────────────────────────────
    void setBreath(float level, float colorHz, float widthQ,
                   bool followEnv, bool enabled);

    // ── Texture ──────────────────────────────────────────────────────────
    void setTextureCutoff(float hz);
    void setTextureResonance(float q);

    // ── Envelopes ────────────────────────────────────────────────────────
    void setEnv0(float atkMs, float decMs, float sus, float relMs, float velAmt);
    void setEnv1(float atkMs, float decMs, float sus, float relMs, float velAmt);

    // ── LFOs ─────────────────────────────────────────────────────────────
    void setLFO0(VoiceLFOShape shape, VoiceLFOSync sync, float rateHz,
                 float depth, float phase, bool retrigger);
    void setLFO1(VoiceLFOShape shape, VoiceLFOSync sync, float rateHz,
                 float depth, float phase, bool retrigger);

    // ── Macros (ribbon assignments) ──────────────────────────────────────
    void setMacro1(float v);
    void setMacro2(float v);

    // ── Modulation matrix ────────────────────────────────────────────────
    void setModRoute(int routeIndex, VoiceModSource src, VoiceModDest dest,
                     float amount, bool active);
    void clearModRoutes();

    // ── 3D Stereo ────────────────────────────────────────────────────────
    void setStereoWidth   (float width);
    void setStereoMidGain (float gain);
    void setStereoSideGain(float gain);
    void setStereoPan     (float pan);
    void setStereoEnabled (bool e);

    // ── Triggers (UI keyboard / pads) ────────────────────────────────────
    void noteOn (uint8_t note, uint8_t velocity,
                 int slot = -1, int slice = -1, int32_t sampleOffset = 0);
    void noteOff(uint8_t note);
    void allNotesOff();

    // ── Sample management (UI Thread — heap ownership here) ─────────────
    // Copies `data` into engine-owned storage and publishes it to the AT.
    bool loadSample(int slot, const float* data, int32_t lengthFrames,
                    int32_t sampleRate, int32_t rootNote);
    void clearSample(int slot);
    void setSliceMarkers(int slot, const int32_t* starts, int count);

    // ── Live input (UI Thread) ───────────────────────────────────────────
    bool setLiveInputEnabled(bool enabled);
    bool liveInputEnabled() const noexcept { return mLiveInputOpen; }

    // ── Preset / Undo ────────────────────────────────────────────────────
    void loadPreset(const VoiceParams& params);
    bool undo();
    bool redo();
    bool canUndo() const noexcept { return mUndoStack.canUndo(); }
    bool canRedo() const noexcept { return mUndoStack.canRedo(); }
    void clearUndoHistory() noexcept { mUndoStack.clear(); }

    // ── UI-mirror reads (UI Thread only) ─────────────────────────────────
    const VoiceParams&  params()  const noexcept { return mUIState.params; }
    const UIVoiceState& uiState() const noexcept { return mUIState; }

    // ── Live reads (approximate, any thread) ─────────────────────────────
    int32_t activeUnitCount() const noexcept { return mNode.activeUnitCount(); }
    float   outputLevel()     const noexcept { return mNode.outputLevel(); }
    float   inputLevel()      const noexcept { return mNode.inputLevel(); }
    bool    isPlaying()       const noexcept { return mNode.isPlaying(); }

    VoiceNode&       node()       noexcept { return mNode; }
    const VoiceNode& node() const noexcept { return mNode; }

private:
    void send(const VoiceCommand& cmd) noexcept { mNode.enqueueCommand(cmd); }
    void snapshotBefore() noexcept;
    void sendAllParams() noexcept;

    // Epoch-gated reclamation: block (bounded, UI thread) until the Audio
    // Thread has run enough callbacks past `retireEpoch` to guarantee the
    // retiring command was drained and kill fades completed. If the engine
    // is stopped (epoch frozen), the buffer is unreachable and freeing is safe.
    void waitForRetireEpoch(uint64_t retireEpoch) noexcept;

    VoiceNode&      mNode;
    UIVoiceState    mUIState;
    VoiceUndoStack  mUndoStack;
    bool            mLiveInputOpen = false;

    // Deferred-free sample storage: current + retired per slot.
    // A retired buffer is freed only after the Audio Thread's process epoch
    // has advanced ≥ kVoiceRetireEpochs past the epoch at retirement.
    std::unique_ptr<float[]> mSlotCurrent[kVoiceSampleSlots];
    std::unique_ptr<float[]> mSlotRetired[kVoiceSampleSlots];
    uint64_t                 mSlotRetireEpoch[kVoiceSampleSlots] = {};
};

} // namespace vibecore
