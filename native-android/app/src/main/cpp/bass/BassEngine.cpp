#include "BassEngine.h"
#include "../platform/VibeCoreLog.h"

namespace vibecore {

BassEngine::BassEngine(BassNode& node) : mNode(node) {}

// ─── Snapshot (before destructive changes) ────────────────────────────────────

void BassEngine::snapshotBefore() noexcept {
    BassParamSnapshot snap;
    snap.params = mUIState.params;
    snap.valid  = true;
    mUndoStack.push(snap);
}

// ─── Oscillator ───────────────────────────────────────────────────────────────

void BassEngine::setWaveform(BassWaveform w) {
    mUIState.params.waveform = w;
    BassCommand cmd; cmd.type = BassCommandType::SetWaveform;
    cmd.payload.waveform.waveform = w; send(cmd);
}

void BassEngine::setMorphPos(float pos) {
    mUIState.params.morphPos = pos;
    BassCommand cmd; cmd.type = BassCommandType::SetMorphPos;
    cmd.payload.f32.value = pos; send(cmd);
}

void BassEngine::setDetune(float cents) {
    mUIState.params.detune = cents;
    BassCommand cmd; cmd.type = BassCommandType::SetDetune;
    cmd.payload.f32.value = cents; send(cmd);
}

void BassEngine::setOctave(float oct) {
    mUIState.params.octave = oct;
    BassCommand cmd; cmd.type = BassCommandType::SetOctave;
    cmd.payload.f32.value = oct; send(cmd);
}

void BassEngine::setSemi(float semi) {
    mUIState.params.semi = semi;
    BassCommand cmd; cmd.type = BassCommandType::SetSemi;
    cmd.payload.f32.value = semi; send(cmd);
}

void BassEngine::setFine(float cents) {
    mUIState.params.fine = cents;
    BassCommand cmd; cmd.type = BassCommandType::SetFine;
    cmd.payload.f32.value = cents; send(cmd);
}

// ─── Voice ────────────────────────────────────────────────────────────────────

void BassEngine::setVoiceMode(BassVoiceMode mode) {
    mUIState.params.voiceMode = mode;
    BassCommand cmd; cmd.type = BassCommandType::SetVoiceMode;
    cmd.payload.voiceMode.mode = mode; send(cmd);
}

void BassEngine::setGlideMs(float ms) {
    mUIState.params.glideMs = ms;
    BassCommand cmd; cmd.type = BassCommandType::SetGlideMs;
    cmd.payload.f32.value = ms; send(cmd);
}

void BassEngine::setVolume(float vol) {
    mUIState.params.volume = vol;
    BassCommand cmd; cmd.type = BassCommandType::SetVolume;
    cmd.payload.f32.value = vol; send(cmd);
}

void BassEngine::setPan(float pan) {
    mUIState.params.pan = pan;
    mUIState.params.stereo3D.pan = pan;
    BassCommand cmd; cmd.type = BassCommandType::SetPan;
    cmd.payload.f32.value = pan; send(cmd);
}

// ─── Filter ───────────────────────────────────────────────────────────────────

void BassEngine::setFilterType(BassFilterType type) {
    mUIState.params.filterType = type;
    BassCommand cmd; cmd.type = BassCommandType::SetFilterType;
    cmd.payload.filterType.type = type; send(cmd);
}

void BassEngine::setCutoff(float hz) {
    mUIState.params.cutoffHz = hz;
    BassCommand cmd; cmd.type = BassCommandType::SetCutoff;
    cmd.payload.f32.value = hz; send(cmd);
}

void BassEngine::setResonance(float q) {
    mUIState.params.resonance = q;
    BassCommand cmd; cmd.type = BassCommandType::SetResonance;
    cmd.payload.f32.value = q; send(cmd);
}

void BassEngine::setFilterDrive(float d) {
    mUIState.params.filterDrive = d;
    BassCommand cmd; cmd.type = BassCommandType::SetFilterDrive;
    cmd.payload.f32.value = d; send(cmd);
}

// ─── Envelope 0 ───────────────────────────────────────────────────────────────

void BassEngine::setEnv0Attack (float ms) {
    mUIState.params.env0.attackMs = ms;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv0Attack;
    cmd.payload.f32.value = ms; send(cmd);
}
void BassEngine::setEnv0Decay  (float ms) {
    mUIState.params.env0.decayMs = ms;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv0Decay;
    cmd.payload.f32.value = ms; send(cmd);
}
void BassEngine::setEnv0Sustain(float s) {
    mUIState.params.env0.sustain = s;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv0Sustain;
    cmd.payload.f32.value = s; send(cmd);
}
void BassEngine::setEnv0Release(float ms) {
    mUIState.params.env0.releaseMs = ms;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv0Release;
    cmd.payload.f32.value = ms; send(cmd);
}
void BassEngine::setEnv0VelAmt (float a) {
    mUIState.params.env0.velocityAmount = a;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv0VelAmt;
    cmd.payload.f32.value = a; send(cmd);
}

// ─── Envelope 1 ───────────────────────────────────────────────────────────────

void BassEngine::setEnv1Attack (float ms) {
    mUIState.params.env1.attackMs = ms;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv1Attack;
    cmd.payload.f32.value = ms; send(cmd);
}
void BassEngine::setEnv1Decay  (float ms) {
    mUIState.params.env1.decayMs = ms;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv1Decay;
    cmd.payload.f32.value = ms; send(cmd);
}
void BassEngine::setEnv1Sustain(float s) {
    mUIState.params.env1.sustain = s;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv1Sustain;
    cmd.payload.f32.value = s; send(cmd);
}
void BassEngine::setEnv1Release(float ms) {
    mUIState.params.env1.releaseMs = ms;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv1Release;
    cmd.payload.f32.value = ms; send(cmd);
}
void BassEngine::setEnv1VelAmt (float a) {
    mUIState.params.env1.velocityAmount = a;
    BassCommand cmd; cmd.type = BassCommandType::SetEnv1VelAmt;
    cmd.payload.f32.value = a; send(cmd);
}

// ─── LFO 0 ────────────────────────────────────────────────────────────────────

void BassEngine::setLFO0Shape (BassLFOShape s) {
    mUIState.params.lfo0.shape = s;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO0Shape;
    cmd.payload.lfo.shape = s; send(cmd);
}
void BassEngine::setLFO0Rate  (float hz) {
    mUIState.params.lfo0.rateHz = hz;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO0Rate;
    cmd.payload.lfo.rateHz = hz; send(cmd);
}
void BassEngine::setLFO0Depth (float d) {
    mUIState.params.lfo0.depth = d;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO0Depth;
    cmd.payload.lfo.depth = d; send(cmd);
}
void BassEngine::setLFO0Sync  (BassLFOSync sync) {
    mUIState.params.lfo0.sync = sync;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO0Sync;
    cmd.payload.lfo.sync = sync; send(cmd);
}
void BassEngine::setLFO0Retrig(bool r) {
    mUIState.params.lfo0.retrigger = r;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO0Retrig;
    cmd.payload.lfo.retrigger = r; send(cmd);
}

// ─── LFO 1 ────────────────────────────────────────────────────────────────────

void BassEngine::setLFO1Shape (BassLFOShape s) {
    mUIState.params.lfo1.shape = s;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO1Shape;
    cmd.payload.lfo.shape = s; send(cmd);
}
void BassEngine::setLFO1Rate  (float hz) {
    mUIState.params.lfo1.rateHz = hz;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO1Rate;
    cmd.payload.lfo.rateHz = hz; send(cmd);
}
void BassEngine::setLFO1Depth (float d) {
    mUIState.params.lfo1.depth = d;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO1Depth;
    cmd.payload.lfo.depth = d; send(cmd);
}
void BassEngine::setLFO1Sync  (BassLFOSync sync) {
    mUIState.params.lfo1.sync = sync;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO1Sync;
    cmd.payload.lfo.sync = sync; send(cmd);
}
void BassEngine::setLFO1Retrig(bool r) {
    mUIState.params.lfo1.retrigger = r;
    BassCommand cmd; cmd.type = BassCommandType::SetLFO1Retrig;
    cmd.payload.lfo.retrigger = r; send(cmd);
}

// ─── Modulation matrix ────────────────────────────────────────────────────────

void BassEngine::setModRoute(int idx, const BassModRoute& route) {
    if (idx < 0 || idx >= kBassModRoutes) return;
    mUIState.params.modMatrix[idx] = route;
    BassCommand cmd; cmd.type = BassCommandType::SetModRoute;
    cmd.payload.modRoute.routeIndex = static_cast<uint8_t>(idx);
    cmd.payload.modRoute.route = route;
    send(cmd);
}

void BassEngine::clearModRoutes() {
    for (int i = 0; i < kBassModRoutes; ++i) {
        mUIState.params.modMatrix[i] = BassModRoute{};
        setModRoute(i, BassModRoute{});
    }
}

// ─── 3D Stereo ────────────────────────────────────────────────────────────────

void BassEngine::setStereoWidth(float w) {
    mUIState.params.stereo3D.stereoWidth = w;
    BassCommand cmd; cmd.type = BassCommandType::SetStereoWidth;
    cmd.payload.f32.value = w; send(cmd);
}
void BassEngine::setStereoMidGain(float g) {
    mUIState.params.stereo3D.midGain = g;
    BassCommand cmd; cmd.type = BassCommandType::SetStereoMidGain;
    cmd.payload.f32.value = g; send(cmd);
}
void BassEngine::setStereoSideGain(float g) {
    mUIState.params.stereo3D.sideGain = g;
    BassCommand cmd; cmd.type = BassCommandType::SetStereoSideGain;
    cmd.payload.f32.value = g; send(cmd);
}
void BassEngine::setStereoEnabled(bool en) {
    mUIState.params.stereo3D.enabled = en;
    BassCommand cmd; cmd.type = BassCommandType::SetStereoEnabled;
    cmd.payload.i32.value = en ? 1 : 0; send(cmd);
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

void BassEngine::noteOn(uint8_t note, uint8_t velocity, int32_t sampleOffset) {
    BassCommand cmd; cmd.type = BassCommandType::NoteOn;
    cmd.payload.trigger.note         = note;
    cmd.payload.trigger.velocity     = velocity;
    cmd.payload.trigger.retrigger    = true;
    cmd.payload.trigger.sampleOffset = sampleOffset;
    cmd.payload.trigger.glideFromPitch = -1.0f; // auto
    send(cmd);
}

void BassEngine::noteOff(uint8_t note, int32_t sampleOffset) {
    BassCommand cmd; cmd.type = BassCommandType::NoteOff;
    cmd.payload.trigger.note         = note;
    cmd.payload.trigger.sampleOffset = sampleOffset;
    send(cmd);
}

void BassEngine::allNotesOff() {
    BassCommand cmd; cmd.type = BassCommandType::AllNotesOff;
    send(cmd);
}

// ─── Preset load / Undo ───────────────────────────────────────────────────────

void BassEngine::loadPreset(const BassParams& params) {
    snapshotBefore();
    mUIState.params = params;
    BassCommand cmd; cmd.type = BassCommandType::SetAllParams;
    cmd.payload.allParams.params = params;
    send(cmd);
    VLOG_I("BassEngine: preset loaded");
}

bool BassEngine::undo() {
    const BassParamSnapshot* snap = mUndoStack.undo();
    if (!snap) return false;
    mUIState.params = snap->params;
    BassCommand cmd; cmd.type = BassCommandType::SetAllParams;
    cmd.payload.allParams.params = snap->params;
    send(cmd);
    VLOG_I("BassEngine: undo");
    return true;
}

bool BassEngine::redo() {
    const BassParamSnapshot* snap = mUndoStack.redo();
    if (!snap) return false;
    mUIState.params = snap->params;
    BassCommand cmd; cmd.type = BassCommandType::SetAllParams;
    cmd.payload.allParams.params = snap->params;
    send(cmd);
    VLOG_I("BassEngine: redo");
    return true;
}

} // namespace vibecore
