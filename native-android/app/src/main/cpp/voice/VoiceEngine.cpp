#include "VoiceEngine.h"
#include "../platform/VibeCoreLog.h"
#include <cstring>
#include <thread>
#include <chrono>

namespace vibecore {

// Callbacks that must elapse after retiring a buffer before it may be freed:
// 1 (drain replace command) + kill fade (2 ms ≤ 1 callback @96f/48k) + margin.
static constexpr uint64_t kVoiceRetireEpochs = 4;

void VoiceEngine::waitForRetireEpoch(uint64_t retireEpoch) noexcept {
    // Bounded wait ~200 ms. If the epoch is frozen (engine stopped), the
    // Audio Thread cannot be touching the buffer — freeing is safe.
    const uint64_t target = retireEpoch + kVoiceRetireEpochs;
    uint64_t last = mNode.processEpoch();
    if (last >= target) return;
    for (int i = 0; i < 200; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
        const uint64_t now = mNode.processEpoch();
        if (now >= target) return;
        if (now == last && i >= 20) return;   // frozen ≥ 20 ms → engine stopped
        last = now;
    }
}

// Clamp helper for UI-facing setters (bounds validation at the bridge boundary)
static inline float clampf(float v, float lo, float hi) noexcept {
    return v < lo ? lo : (v > hi ? hi : v);
}

VoiceEngine::VoiceEngine(VoiceNode& node) : mNode(node) {}

VoiceEngine::~VoiceEngine() {
    if (mLiveInputOpen) {
        mNode.input().setActive(false);
        mNode.input().close();
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

void VoiceEngine::snapshotBefore() noexcept {
    VoiceParamSnapshot snap;
    snap.params = mUIState.params;
    snap.valid  = true;
    mUndoStack.push(snap);
}

void VoiceEngine::sendAllParams() noexcept {
    VoiceCommand c;
    c.type = VoiceCommandType::SetAllParams;
    c.payload.allParams.params = mUIState.params;
    send(c);
}

static VoiceCommand f32Cmd(VoiceCommandType t, float v) noexcept {
    VoiceCommand c; c.type = t; c.payload.f32.value = v; return c;
}
static VoiceCommand i32Cmd(VoiceCommandType t, int32_t v) noexcept {
    VoiceCommand c; c.type = t; c.payload.i32.value = v; return c;
}
static VoiceCommand u8Cmd(VoiceCommandType t, uint8_t v) noexcept {
    VoiceCommand c; c.type = t; c.payload.u8.mode = v; return c;
}

// ─── Mode ─────────────────────────────────────────────────────────────────────

void VoiceEngine::setGlobalMode(VoiceGlobalMode mode) {
    mUIState.params.mode = mode;
    send(u8Cmd(VoiceCommandType::SetGlobalMode, static_cast<uint8_t>(mode)));
}
void VoiceEngine::setPolyMode(VoicePolyMode mode) {
    mUIState.params.polyMode = mode;
    send(u8Cmd(VoiceCommandType::SetPolyMode, static_cast<uint8_t>(mode)));
}
void VoiceEngine::setPlayMode(VoicePlayMode mode) {
    mUIState.params.playMode = mode;
    send(u8Cmd(VoiceCommandType::SetPlayMode, static_cast<uint8_t>(mode)));
}

// ─── Master ───────────────────────────────────────────────────────────────────

void VoiceEngine::setVolume(float v)   { v = clampf(v, 0.0f, 2.0f); mUIState.params.volume  = v; send(f32Cmd(VoiceCommandType::SetVolume, v)); }
void VoiceEngine::setDryWet(float v)   { v = clampf(v, 0.0f, 1.0f); mUIState.params.dryWet  = v; send(f32Cmd(VoiceCommandType::SetDryWet, v)); }
void VoiceEngine::setMonitor(float v)  { v = clampf(v, 0.0f, 1.0f); mUIState.params.monitor = v; send(f32Cmd(VoiceCommandType::SetMonitor, v)); }
void VoiceEngine::setGlideMs(float ms) { ms = clampf(ms, 0.0f, 5000.0f); mUIState.params.glideMs = ms; send(f32Cmd(VoiceCommandType::SetGlideMs, ms)); }
void VoiceEngine::setActiveSlot(int s) { if (s < 0 || s >= kVoiceSampleSlots) return; mUIState.params.activeSampleSlot = s; send(i32Cmd(VoiceCommandType::SetActiveSlot, s)); }
void VoiceEngine::setRootNote(int n)   { if (n < 0 || n > 127) return; mUIState.params.rootNote = n; send(i32Cmd(VoiceCommandType::SetRootNote, n)); }

// ─── Pitch / Formant ──────────────────────────────────────────────────────────

void VoiceEngine::setPitchSemitones(float st) {
    st = clampf(st, -24.0f, 24.0f);
    mUIState.params.pitch.pitchSemitones = st;
    send(f32Cmd(VoiceCommandType::SetPitchSemitones, st));
}
void VoiceEngine::setPitchEnabled(bool e) {
    mUIState.params.pitch.pitchEnabled = e;
    send(i32Cmd(VoiceCommandType::SetPitchEnabled, e ? 1 : 0));
}
void VoiceEngine::setFormantSemitones(float st) {
    st = clampf(st, -12.0f, 12.0f);
    mUIState.params.pitch.formantSemitones = st;
    send(f32Cmd(VoiceCommandType::SetFormantSemitones, st));
}
void VoiceEngine::setFormantEnabled(bool e) {
    mUIState.params.pitch.formantEnabled = e;
    send(i32Cmd(VoiceCommandType::SetFormantEnabled, e ? 1 : 0));
}

// ─── Harmonizer / Doubler ─────────────────────────────────────────────────────

void VoiceEngine::setHarmonyVoice(int index, float semitones, float level, float pan) {
    if (index < 0 || index >= kVoiceHarmonyVoices) return;
    VoiceHarmonyVoiceDef def;
    def.semitones = semitones; def.level = level; def.pan = pan;
    mUIState.params.harmonizer.voices[index] = def;
    VoiceCommand c;
    c.type = VoiceCommandType::SetHarmonyVoice;
    c.payload.harmony.index = static_cast<uint8_t>(index);
    c.payload.harmony.def   = def;
    send(c);
}
void VoiceEngine::setHarmonyMaster(float level) {
    mUIState.params.harmonizer.masterLevel = level;
    send(f32Cmd(VoiceCommandType::SetHarmonyMaster, level));
}
void VoiceEngine::setHarmonyEnabled(bool e) {
    mUIState.params.harmonizer.enabled = e;
    send(i32Cmd(VoiceCommandType::SetHarmonyEnabled, e ? 1 : 0));
}
void VoiceEngine::setDoubler(float detuneCents, float level, float widthSpread, bool enabled) {
    VoiceDoublerParams p;
    p.detuneCents = detuneCents; p.level = level;
    p.widthSpread = widthSpread; p.enabled = enabled;
    mUIState.params.doubler = p;
    VoiceCommand c; c.type = VoiceCommandType::SetDoubler; c.payload.doubler.p = p;
    send(c);
}

// ─── Dynamics ─────────────────────────────────────────────────────────────────

void VoiceEngine::setGate(float thresholdDb, float attackMs, float releaseMs, bool enabled) {
    VoiceGateParams p;
    p.thresholdDb = thresholdDb; p.attackMs = attackMs;
    p.releaseMs = releaseMs; p.enabled = enabled;
    mUIState.params.gate = p;
    VoiceCommand c; c.type = VoiceCommandType::SetGate; c.payload.gate.p = p;
    send(c);
}
void VoiceEngine::setDeEsser(float frequencyHz, float thresholdDb, float amount, bool enabled) {
    VoiceDeEsserParams p;
    p.frequencyHz = frequencyHz; p.thresholdDb = thresholdDb;
    p.amount = amount; p.enabled = enabled;
    mUIState.params.deEsser = p;
    VoiceCommand c; c.type = VoiceCommandType::SetDeEsser; c.payload.deEsser.p = p;
    send(c);
}
void VoiceEngine::setCompressor(float thresholdDb, float ratio, float attackMs,
                                float releaseMs, float makeupDb, bool enabled) {
    VoiceCompressorParams p;
    p.thresholdDb = thresholdDb; p.ratio = ratio < 1.0f ? 1.0f : ratio;
    p.attackMs = attackMs; p.releaseMs = releaseMs;
    p.makeupDb = makeupDb; p.enabled = enabled;
    mUIState.params.compressor = p;
    VoiceCommand c; c.type = VoiceCommandType::SetCompressor; c.payload.compressor.p = p;
    send(c);
}
void VoiceEngine::setEQ(float lowHz, float lowDb, float midHz, float midDb,
                        float midQ, float highHz, float highDb, bool enabled) {
    VoiceEQParams p;
    p.lowShelfHz = lowHz; p.lowGainDb = lowDb;
    p.midHz = midHz; p.midGainDb = midDb; p.midQ = midQ;
    p.highShelfHz = highHz; p.highGainDb = highDb; p.enabled = enabled;
    mUIState.params.eq = p;
    VoiceCommand c; c.type = VoiceCommandType::SetEQ; c.payload.eq.p = p;
    send(c);
}

// ─── Breath ───────────────────────────────────────────────────────────────────

void VoiceEngine::setBreath(float level, float colorHz, float widthQ,
                            bool followEnv, bool enabled) {
    VoiceBreathParams p;
    p.level = level; p.colorHz = colorHz; p.widthQ = widthQ;
    p.followEnv = followEnv; p.enabled = enabled;
    mUIState.params.breath = p;
    VoiceCommand c; c.type = VoiceCommandType::SetBreath; c.payload.breath.p = p;
    send(c);
}

// ─── Texture ──────────────────────────────────────────────────────────────────

void VoiceEngine::setTextureCutoff(float hz) {
    hz = clampf(hz, 20.0f, 20000.0f);
    mUIState.params.textureCutoffHz = hz;
    send(f32Cmd(VoiceCommandType::SetTextureCutoff, hz));
}
void VoiceEngine::setTextureResonance(float q) {
    q = clampf(q, 0.0f, 1.0f);
    mUIState.params.textureResonance = q;
    send(f32Cmd(VoiceCommandType::SetTextureRes, q));
}

// ─── Envelopes ────────────────────────────────────────────────────────────────

void VoiceEngine::setEnv0(float atkMs, float decMs, float sus, float relMs, float velAmt) {
    VoiceADSR a; a.attackMs = atkMs; a.decayMs = decMs;
    a.sustain = sus; a.releaseMs = relMs; a.velocityAmount = velAmt;
    mUIState.params.env0 = a;
    VoiceCommand c; c.type = VoiceCommandType::SetEnv0;
    c.payload.env.envIndex = 0; c.payload.env.adsr = a;
    send(c);
}
void VoiceEngine::setEnv1(float atkMs, float decMs, float sus, float relMs, float velAmt) {
    VoiceADSR a; a.attackMs = atkMs; a.decayMs = decMs;
    a.sustain = sus; a.releaseMs = relMs; a.velocityAmount = velAmt;
    mUIState.params.env1 = a;
    VoiceCommand c; c.type = VoiceCommandType::SetEnv1;
    c.payload.env.envIndex = 1; c.payload.env.adsr = a;
    send(c);
}

// ─── LFOs ─────────────────────────────────────────────────────────────────────

void VoiceEngine::setLFO0(VoiceLFOShape shape, VoiceLFOSync sync, float rateHz,
                          float depth, float phase, bool retrigger) {
    VoiceLFODef d;
    d.shape = shape; d.sync = sync; d.rateHz = rateHz;
    d.depth = depth; d.phase = phase; d.retrigger = retrigger;
    mUIState.params.lfo0 = d;
    VoiceCommand c; c.type = VoiceCommandType::SetLFO0;
    c.payload.lfo.lfoIndex = 0; c.payload.lfo.def = d;
    send(c);
}
void VoiceEngine::setLFO1(VoiceLFOShape shape, VoiceLFOSync sync, float rateHz,
                          float depth, float phase, bool retrigger) {
    VoiceLFODef d;
    d.shape = shape; d.sync = sync; d.rateHz = rateHz;
    d.depth = depth; d.phase = phase; d.retrigger = retrigger;
    mUIState.params.lfo1 = d;
    VoiceCommand c; c.type = VoiceCommandType::SetLFO1;
    c.payload.lfo.lfoIndex = 1; c.payload.lfo.def = d;
    send(c);
}

// ─── Macros ───────────────────────────────────────────────────────────────────

void VoiceEngine::setMacro1(float v) { mUIState.params.macro1 = v; send(f32Cmd(VoiceCommandType::SetMacro1, v)); }
void VoiceEngine::setMacro2(float v) { mUIState.params.macro2 = v; send(f32Cmd(VoiceCommandType::SetMacro2, v)); }

// ─── Modulation matrix ────────────────────────────────────────────────────────

void VoiceEngine::setModRoute(int routeIndex, VoiceModSource src, VoiceModDest dest,
                              float amount, bool active) {
    if (routeIndex < 0 || routeIndex >= kVoiceModRoutes) return;
    VoiceModRoute r;
    r.source = src; r.dest = dest; r.amount = amount; r.active = active;
    mUIState.params.modMatrix[routeIndex] = r;
    VoiceCommand c; c.type = VoiceCommandType::SetModRoute;
    c.payload.modRoute.routeIndex = static_cast<uint8_t>(routeIndex);
    c.payload.modRoute.route = r;
    send(c);
}
void VoiceEngine::clearModRoutes() {
    for (int i = 0; i < kVoiceModRoutes; ++i)
        setModRoute(i, VoiceModSource::None, VoiceModDest::None, 0.0f, false);
}

// ─── 3D Stereo ────────────────────────────────────────────────────────────────

void VoiceEngine::setStereoWidth(float w)    { mUIState.params.stereo3D.stereoWidth = w; send(f32Cmd(VoiceCommandType::SetStereoWidth, w)); }
void VoiceEngine::setStereoMidGain(float g)  { mUIState.params.stereo3D.midGain = g; send(f32Cmd(VoiceCommandType::SetStereoMidGain, g)); }
void VoiceEngine::setStereoSideGain(float g) { mUIState.params.stereo3D.sideGain = g; send(f32Cmd(VoiceCommandType::SetStereoSideGain, g)); }
void VoiceEngine::setStereoPan(float p)      { mUIState.params.stereo3D.pan = p; send(f32Cmd(VoiceCommandType::SetStereoPan, p)); }
void VoiceEngine::setStereoEnabled(bool e)   { mUIState.params.stereo3D.enabled = e; send(i32Cmd(VoiceCommandType::SetStereoEnabled, e ? 1 : 0)); }

// ─── Triggers ─────────────────────────────────────────────────────────────────

void VoiceEngine::noteOn(uint8_t note, uint8_t velocity,
                         int slot, int slice, int32_t sampleOffset) {
    VoiceCommand c; c.type = VoiceCommandType::NoteOn;
    c.payload.trigger.note = note;
    c.payload.trigger.velocity = velocity;
    c.payload.trigger.slot = static_cast<int8_t>(slot);
    c.payload.trigger.slice = static_cast<int8_t>(slice);
    c.payload.trigger.retrigger = true;
    c.payload.trigger.sampleOffset = sampleOffset;
    send(c);
}
void VoiceEngine::noteOff(uint8_t note) {
    VoiceCommand c; c.type = VoiceCommandType::NoteOff;
    c.payload.trigger.note = note;
    send(c);
}
void VoiceEngine::allNotesOff() {
    VoiceCommand c; c.type = VoiceCommandType::AllNotesOff;
    send(c);
}

// ─── Sample management ────────────────────────────────────────────────────────

bool VoiceEngine::loadSample(int slot, const float* data, int32_t lengthFrames,
                             int32_t sampleRate, int32_t rootNote) {
    if (slot < 0 || slot >= kVoiceSampleSlots) return false;
    if (!data || lengthFrames <= 0) return false;

    // 1. Allocate + copy (UI Thread — heap allowed here)
    auto storage = std::unique_ptr<float[]>(new float[lengthFrames]);
    memcpy(storage.get(), data, sizeof(float) * static_cast<size_t>(lengthFrames));

    // 2. Epoch-gated reclamation: before freeing the previously retired
    //    buffer, wait until the Audio Thread has provably moved past its
    //    retirement (command drained + kill fades done).
    if (mSlotRetired[slot]) {
        waitForRetireEpoch(mSlotRetireEpoch[slot]);
        mSlotRetired[slot].reset();
    }
    mSlotRetired[slot]     = std::move(mSlotCurrent[slot]);
    mSlotRetireEpoch[slot] = mNode.processEpoch();
    mSlotCurrent[slot]     = std::move(storage);

    // 3. Publish to Audio Thread
    VoiceCommand c; c.type = VoiceCommandType::SetSampleData;
    c.payload.sample.slot         = slot;
    c.payload.sample.data         = mSlotCurrent[slot].get();
    c.payload.sample.lengthFrames = lengthFrames;
    c.payload.sample.sampleRate   = sampleRate;
    c.payload.sample.rootNote     = rootNote;
    send(c);

    // 4. UI mirror
    VoiceSampleInfo& info = mUIState.samples[slot];
    info.lengthFrames = lengthFrames;
    info.sampleRate   = sampleRate;
    info.rootNote     = rootNote;
    info.loaded       = true;

    VLOG_I("VoiceEngine: sample loaded slot=%d frames=%d sr=%d",
           slot, lengthFrames, sampleRate);
    return true;
}

void VoiceEngine::clearSample(int slot) {
    if (slot < 0 || slot >= kVoiceSampleSlots) return;
    send(i32Cmd(VoiceCommandType::ClearSample, slot));
    // Retire storage — freed only after the retire epoch has passed
    // (see loadSample). Never free a pointer the Audio Thread may still hold.
    if (mSlotRetired[slot]) {
        waitForRetireEpoch(mSlotRetireEpoch[slot]);
        mSlotRetired[slot].reset();
    }
    mSlotRetired[slot]     = std::move(mSlotCurrent[slot]);
    mSlotRetireEpoch[slot] = mNode.processEpoch();
    mUIState.samples[slot] = {};
}

void VoiceEngine::setSliceMarkers(int slot, const int32_t* starts, int count) {
    if (slot < 0 || slot >= kVoiceSampleSlots || !starts) return;
    if (count > kVoiceMaxSlices) count = kVoiceMaxSlices;
    VoiceCommand c; c.type = VoiceCommandType::SetSliceMarkers;
    c.payload.slices.slot  = slot;
    c.payload.slices.count = count;
    for (int i = 0; i < count; ++i) c.payload.slices.start[i] = starts[i];
    send(c);

    VoiceSampleInfo& info = mUIState.samples[slot];
    info.sliceCount = count;
    for (int i = 0; i < count; ++i) info.sliceStart[i] = starts[i];
}

// ─── Live input ───────────────────────────────────────────────────────────────

bool VoiceEngine::setLiveInputEnabled(bool enabled) {
    if (enabled && !mLiveInputOpen) {
        if (!mNode.input().open(mNode.sampleRate(), mNode.maxFrames()))
            return false;
        mNode.input().setActive(true);
        send(i32Cmd(VoiceCommandType::SetLiveInputActive, 1));
        mLiveInputOpen = true;
        return true;
    }
    if (!enabled && mLiveInputOpen) {
        // Gate off first — the AT stops touching the stream immediately.
        mNode.input().setActive(false);
        send(i32Cmd(VoiceCommandType::SetLiveInputActive, 0));
        mNode.input().close();
        mLiveInputOpen = false;
    }
    return true;
}

// ─── Preset / Undo ────────────────────────────────────────────────────────────

void VoiceEngine::loadPreset(const VoiceParams& params) {
    snapshotBefore();
    mUIState.params = params;
    sendAllParams();
}

bool VoiceEngine::undo() {
    if (!mUndoStack.canUndo()) return false;
    // Push current state as redo target if at top of stack
    if (!mUndoStack.canRedo()) {
        VoiceParamSnapshot cur; cur.params = mUIState.params; cur.valid = true;
        mUndoStack.push(cur);
        mUndoStack.undo();   // step back over the snapshot we just pushed
    }
    const VoiceParamSnapshot* snap = mUndoStack.undo();
    if (!snap || !snap->valid) return false;
    mUIState.params = snap->params;
    sendAllParams();
    return true;
}

bool VoiceEngine::redo() {
    const VoiceParamSnapshot* snap = mUndoStack.redo();
    if (!snap || !snap->valid) return false;
    mUIState.params = snap->params;
    sendAllParams();
    return true;
}

} // namespace vibecore
