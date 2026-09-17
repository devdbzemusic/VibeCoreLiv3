#include "GrooveEngine.h"
#include "../platform/VibeCoreLog.h"
#include <cstring>

namespace vibecore {

GrooveEngine::GrooveEngine(GrooveNode& node) : mNode(node) {
    // UI mirror starts as default-constructed (all tracks empty, inactive)
    mSampleLengths.fill(0);
    mSampleRates.fill(0);
}

// ─── Internal: snapshot + apply ───────────────────────────────────────────────

void GrooveEngine::snapshotBefore(int t) {
    if (!validTrack(t) || isProjectLoading()) return;
    PatternSnapshot snap;
    snap.trackIndex = t;
    snap.bankIndex  = mUITracks[t].activeBank;
    snap.pattern    = mUITracks[t].activePattern();  // full copy of current state
    snap.valid      = true;
    mUndoStack.push(snap);
}

void GrooveEngine::applySnapshot(const PatternSnapshot& snap) {
    if (!snap.valid || !validTrack(snap.trackIndex)) return;
    const int t = snap.trackIndex;

    // 1. Update UI mirror
    mUITracks[t].banks[snap.bankIndex] = snap.pattern;

    // 2. Replay to GrooveNode (applies via command queue → Audio Thread)
    replayPatternToNode(t, snap.pattern);
}

void GrooveEngine::replayPatternToNode(int t, const Pattern& pat) {
    // Full deterministic replay: clear → set length → set each step
    mNode.clearPattern(t);
    mNode.setPatternLength(t, pat.length);
    mNode.setSwing   (t, pat.swing);
    mNode.setHumanize(t, pat.humanize);

    for (int s = 0; s < pat.length; ++s) {
        const Step& st = pat.steps[s];
        if (st.active) {
            mNode.setStep(t, s, true, st.velocity, st.note);
        }
        if (st.probability < 100)  mNode.setStepProbability(t, s, st.probability);
        if (st.muted)              mNode.setStepMuted       (t, s, true);
        if (st.accent)             mNode.setStepAccent      (t, s, true);
        if (st.rollCount > 0)      mNode.setStepRoll        (t, s, st.rollCount);
        if (st.flam)               mNode.setStepFlam        (t, s, true);
        if (st.microTiming != 0)   mNode.setStepMicroTiming (t, s, st.microTiming);
    }
}

// ─── Step editing ──────────────────────────────────────────────────────────────

void GrooveEngine::setStep(int t, int s, bool active, uint8_t vel, uint8_t note) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    Step& st        = mUITracks[t].activePattern().steps[s];
    st.active       = active;
    st.velocity     = vel;
    st.note         = note;
    mNode.setStep(t, s, active, vel, note);
}

void GrooveEngine::setStepVelocity(int t, int s, uint8_t vel) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].velocity = vel;
    mNode.setStepVelocity(t, s, vel);
}

void GrooveEngine::setStepNote(int t, int s, uint8_t note) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].note = note;
    mNode.setStepNote(t, s, note);
}

void GrooveEngine::setStepProbability(int t, int s, uint8_t prob) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].probability = prob;
    mNode.setStepProbability(t, s, prob);
}

void GrooveEngine::setStepMuted(int t, int s, bool muted) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].muted = muted;
    mNode.setStepMuted(t, s, muted);
}

void GrooveEngine::setStepAccent(int t, int s, bool accent) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].accent = accent;
    mNode.setStepAccent(t, s, accent);
}

void GrooveEngine::setStepRoll(int t, int s, uint8_t count) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].rollCount = count;
    mNode.setStepRoll(t, s, count);
}

void GrooveEngine::setStepFlam(int t, int s, bool flam) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].flam = flam;
    mNode.setStepFlam(t, s, flam);
}

void GrooveEngine::setStepMicroTiming(int t, int s, int16_t ticks) {
    if (!validTrack(t) || !validStep(s)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().steps[s].microTiming = ticks;
    mNode.setStepMicroTiming(t, s, ticks);
}

// ─── Pattern ops ──────────────────────────────────────────────────────────────

void GrooveEngine::setPatternBank(int t, int bank) {
    if (!validTrack(t) || bank < 0 || bank >= kMaxPatternsPerBank) return;
    mUITracks[t].activeBank = bank;
    mNode.setPatternBank(t, bank);
}

void GrooveEngine::setPatternLength(int t, int steps) {
    if (!validTrack(t) || steps < 1 || steps > kMaxSteps) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().length = steps;
    mNode.setPatternLength(t, steps);
}

void GrooveEngine::setSwing(int t, uint8_t swing) {
    if (!validTrack(t)) return;
    mUITracks[t].activePattern().swing = swing;
    mNode.setSwing(t, swing);
}

void GrooveEngine::setHumanize(int t, uint8_t humanize) {
    if (!validTrack(t)) return;
    mUITracks[t].activePattern().humanize = humanize;
    mNode.setHumanize(t, humanize);
}

void GrooveEngine::clearPattern(int t) {
    if (!validTrack(t)) return;
    snapshotBefore(t);
    mUITracks[t].activePattern().clear();
    mNode.clearPattern(t);
    VLOG_I("GrooveEngine: clearPattern track=%d", t);
}

// ─── Copy / Paste ─────────────────────────────────────────────────────────────

void GrooveEngine::copyPattern(int t) {
    if (!validTrack(t)) return;
    mClipboard      = mUITracks[t].activePattern();
    mClipboardValid = true;
    VLOG_I("GrooveEngine: copyPattern track=%d length=%d", t, mClipboard.length);
}

void GrooveEngine::pastePattern(int t) {
    if (!validTrack(t) || !mClipboardValid) return;
    snapshotBefore(t);
    mUITracks[t].activePattern() = mClipboard;
    replayPatternToNode(t, mClipboard);
    VLOG_I("GrooveEngine: pastePattern track=%d length=%d", t, mClipboard.length);
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

bool GrooveEngine::undo() {
    const PatternSnapshot* snap = mUndoStack.undo();
    if (!snap) return false;
    applySnapshot(*snap);
    VLOG_I("GrooveEngine: undo → track=%d", snap->trackIndex);
    return true;
}

bool GrooveEngine::redo() {
    const PatternSnapshot* snap = mUndoStack.redo();
    if (!snap) return false;
    applySnapshot(*snap);
    VLOG_I("GrooveEngine: redo → track=%d", snap->trackIndex);
    return true;
}

// ─── Track ─────────────────────────────────────────────────────────────────────

void GrooveEngine::setTrackMute(int t, bool muted) {
    if (!validTrack(t)) return;
    mUITracks[t].muted = muted;
    mNode.setTrackMute(t, muted);
}

void GrooveEngine::setTrackSolo(int t, bool soloed) {
    if (!validTrack(t)) return;
    mUITracks[t].soloed = soloed;
    mNode.setTrackSolo(t, soloed);
}

void GrooveEngine::setTrackVolume(int t, uint8_t vol) {
    if (!validTrack(t)) return;
    mUITracks[t].volume = vol;
    mNode.setTrackVolume(t, vol);
}

void GrooveEngine::setTrackPan(int t, int8_t pan) {
    if (!validTrack(t)) return;
    mUITracks[t].pan = pan;
    mNode.setTrackPan(t, pan);
}

void GrooveEngine::setTrackSample(int t, int id) {
    if (!validTrack(t)) return;
    mUITracks[t].sampleId = id;
    mNode.setTrackSample(t, id);
}

void GrooveEngine::setTrackMode(int t, TrackMode mode) {
    if (!validTrack(t)) return;
    mUITracks[t].mode = mode;
    mNode.setTrackMode(t, mode);
}

// ─── Sample storage (cold-load only) ─────────────────────────────────────────

bool GrooveEngine::loadSample(int32_t id, const float* monoData,
                              int32_t lengthFrames, int32_t sampleRate) {
    if (id < 0 || id >= kMaxSamples || monoData == nullptr || lengthFrames <= 0 || sampleRate <= 0)
        return false;

    auto storage = std::unique_ptr<float[]>(new float[static_cast<size_t>(lengthFrames)]);
    std::memcpy(storage.get(), monoData, sizeof(float) * static_cast<size_t>(lengthFrames));

    // PRECONDITION: stream stopped. Replacing storage while the callback can
    // read Voice::buffer would require epoch/deferred reclamation (VoiceEngine
    // already provides the reference design for the later hot-swap contract).
    mSampleStorage[id] = std::move(storage);
    mSampleLengths[id] = lengthFrames;
    mSampleRates[id]   = sampleRate;

    SampleBuffer view;
    view.data       = mSampleStorage[id].get();
    view.length     = lengthFrames;
    view.sampleRate = sampleRate;
    view.looping    = false;
    view.loopStart  = 0;
    view.loopEnd    = lengthFrames;
    view.valid      = true;
    mNode.registerSample(id, view);

    VLOG_I("GrooveEngine: cold-loaded sample id=%d frames=%d sr=%d", id, lengthFrames, sampleRate);
    return true;
}

void GrooveEngine::clearSample(int32_t id) {
    if (id < 0 || id >= kMaxSamples) return;

    // PRECONDITION: stream stopped; see loadSample().
    mNode.registerSample(id, SampleBuffer{});
    mSampleStorage[id].reset();
    mSampleLengths[id] = 0;
    mSampleRates[id] = 0;
}

bool GrooveEngine::sampleLoaded(int32_t id) const noexcept {
    return id >= 0 && id < kMaxSamples
        && mSampleStorage[id] != nullptr
        && mSampleLengths[id] > 0
        && mSampleRates[id] > 0;
}

// ─── Piano Roll ────────────────────────────────────────────────────────────────

void GrooveEngine::addPianoRollNote(int t, int64_t start, int64_t end,
                                     uint8_t note, uint8_t vel) {
    if (!validTrack(t)) return;
    mNode.addPianoRollNote(t, start, end, note, vel);
}

void GrooveEngine::removePianoRollNote(int t, int32_t idx) {
    if (!validTrack(t)) return;
    mNode.removePianoRollNote(t, idx);
}

void GrooveEngine::clearPianoRoll(int t) {
    if (!validTrack(t)) return;
    mNode.clearPianoRoll(t);
}

} // namespace vibecore
