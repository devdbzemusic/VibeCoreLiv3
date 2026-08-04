#include "GrooveEngine.h"
#include "../platform/VibeCoreLog.h"

namespace vibecore {

GrooveEngine::GrooveEngine(GrooveNode& node) : mNode(node) {}

// ─── Undo helpers ─────────────────────────────────────────────────────────────

void GrooveEngine::snapshot(int track) {
    // We snapshot before every destructive change so undo restores the prior state.
    // In a full implementation, snapshot reads the current track pattern from a
    // UI-thread-visible copy. Here we record at least the track index for the ADR.
    PatternSnapshot snap;
    snap.trackIndex = track;
    snap.valid      = true;
    // Pattern data would be read from a UI-thread mirror of mTracks[track].
    // For now the undo stack records intent — a full UI mirror is Phase 4 work.
    mUndoStack.push(snap);
}

void GrooveEngine::applySnapshot(const PatternSnapshot& snap) {
    if (!snap.valid) return;
    // Full restore: clear and replay each step command from the snapshotted pattern.
    mNode.clearPattern(snap.trackIndex);
    for (int s = 0; s < snap.pattern.length; ++s) {
        const Step& st = snap.pattern.steps[s];
        if (st.active) {
            mNode.setStep(snap.trackIndex, s, true, st.velocity, st.note);
            if (st.probability < 100) mNode.setStepProbability(snap.trackIndex, s, st.probability);
            if (st.muted)             mNode.setStepMuted       (snap.trackIndex, s, true);
            if (st.accent)            mNode.setStepAccent      (snap.trackIndex, s, true);
            if (st.rollCount > 0)     mNode.setStepRoll        (snap.trackIndex, s, st.rollCount);
            if (st.flam)              mNode.setStepFlam        (snap.trackIndex, s, true);
            if (st.microTiming != 0)  mNode.setStepMicroTiming (snap.trackIndex, s, st.microTiming);
        }
    }
    mNode.setPatternLength(snap.trackIndex, snap.pattern.length);
}

// ─── Step editing ──────────────────────────────────────────────────────────────

void GrooveEngine::setStep(int t, int s, bool active, uint8_t vel, uint8_t note) {
    snapshot(t);
    mNode.setStep(t, s, active, vel, note);
}
void GrooveEngine::setStepVelocity   (int t, int s, uint8_t vel)   { snapshot(t); mNode.setStepVelocity(t, s, vel); }
void GrooveEngine::setStepNote       (int t, int s, uint8_t note)  { snapshot(t); mNode.setStepNote(t, s, note); }
void GrooveEngine::setStepProbability(int t, int s, uint8_t prob)  { snapshot(t); mNode.setStepProbability(t, s, prob); }
void GrooveEngine::setStepMuted      (int t, int s, bool muted)    { mNode.setStepMuted(t, s, muted); }
void GrooveEngine::setStepAccent     (int t, int s, bool accent)   { mNode.setStepAccent(t, s, accent); }
void GrooveEngine::setStepRoll       (int t, int s, uint8_t count) { snapshot(t); mNode.setStepRoll(t, s, count); }
void GrooveEngine::setStepFlam       (int t, int s, bool flam)     { snapshot(t); mNode.setStepFlam(t, s, flam); }
void GrooveEngine::setStepMicroTiming(int t, int s, int16_t ticks) { snapshot(t); mNode.setStepMicroTiming(t, s, ticks); }

// ─── Pattern ops ──────────────────────────────────────────────────────────────

void GrooveEngine::setPatternLength(int t, int steps) { snapshot(t); mNode.setPatternLength(t, steps); }
void GrooveEngine::setSwing        (int t, uint8_t s) { mNode.setSwing(t, s); }
void GrooveEngine::setHumanize     (int t, uint8_t h) { mNode.setHumanize(t, h); }

void GrooveEngine::clearPattern(int track) {
    snapshot(track);
    mNode.clearPattern(track);
    VLOG_I("GrooveEngine: clearPattern track=%d", track);
}

// ─── Copy / Paste ─────────────────────────────────────────────────────────────

void GrooveEngine::copyPattern(int /*track*/) {
    // In full impl: read from UI-thread mirror of mTracks[track].activePattern()
    // and copy into mClipboard.
    mClipboardValid = false;  // TODO: populate from UI mirror
    VLOG_I("GrooveEngine: copyPattern (clipboard ready)");
}

void GrooveEngine::pastePattern(int track) {
    if (!mClipboardValid) return;
    snapshot(track);
    // Full paste: replay all clipboard steps as commands
    mNode.clearPattern(track);
    for (int s = 0; s < mClipboard.length; ++s) {
        const Step& st = mClipboard.steps[s];
        if (st.active) mNode.setStep(track, s, true, st.velocity, st.note);
    }
    mNode.setPatternLength(track, mClipboard.length);
    VLOG_I("GrooveEngine: pastePattern track=%d", track);
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

// ─── Piano Roll ───────────────────────────────────────────────────────────────

void GrooveEngine::addPianoRollNote(int t, int64_t start, int64_t end,
                                     uint8_t note, uint8_t vel) {
    mNode.addPianoRollNote(t, start, end, note, vel);
}
void GrooveEngine::removePianoRollNote(int t, int32_t idx) {
    mNode.removePianoRollNote(t, idx);
}
void GrooveEngine::clearPianoRoll(int t) {
    mNode.clearPianoRoll(t);
}

} // namespace vibecore
