/**
 * jni_bridge.cpp — JNI marshalling for VibeCore Native Platform (Phase 5).
 *
 * Bridge contract (ADR-005): NO business logic. Marshalling only.
 *
 * Phase 1: engine lifecycle, master gain, diagnostics
 * Phase 2: transport, tempo, time signature, loop, playhead
 * Phase 3: groove — steps, patterns, tracks, scenes, piano roll
 * Phase 5: bass — wavetable, voice, filter, envelope, LFO, mod matrix, 3D stereo
 */

#include <jni.h>
#include <memory>

#include "../platform/VibeCoreAudioEngine.h"
#include "../platform/VibeCoreLog.h"
#include "../threads/ThreadModel.h"
#include "../groove/GrooveEngine.h"
#include "../bass/BassEngine.h"
#include "../bass/BassNode.h"

// ─── Engine + GrooveEngine + BassEngine singletons ───────────────────────────

static std::unique_ptr<vibecore::VibeCoreAudioEngine> gEngine;
static std::unique_ptr<vibecore::GrooveEngine>        gGroove;
static std::unique_ptr<vibecore::BassEngine>          gBass;
static vibecore::NodeId                                gGrooveNodeId = vibecore::kInvalidNodeId;
static vibecore::NodeId                                gBassNodeId   = vibecore::kInvalidNodeId;

static vibecore::VibeCoreAudioEngine& engine() {
    if (!gEngine) gEngine = std::make_unique<vibecore::VibeCoreAudioEngine>();
    return *gEngine;
}

static void ensureGroove() {
    if (gGroove) return;
    auto node = std::make_unique<vibecore::GrooveNode>(1);
    vibecore::GrooveNode* nodePtr = node.get();
    gGrooveNodeId = engine().graph().addNode(std::move(node));
    gGroove = std::make_unique<vibecore::GrooveEngine>(*nodePtr);
}

static vibecore::GrooveEngine& groove() {
    ensureGroove();
    return *gGroove;
}

static void ensureBass() {
    if (gBass) return;
    auto node = std::make_unique<vibecore::BassNode>(2);
    vibecore::BassNode* nodePtr = node.get();
    gBassNodeId = engine().graph().addNode(std::move(node));
    gBass = std::make_unique<vibecore::BassEngine>(*nodePtr);
}

static vibecore::BassEngine& bass() {
    ensureBass();
    return *gBass;
}

static void markUIThread() {
    if (vibecore::currentThreadId == vibecore::ThreadId::Unknown)
        vibecore::currentThreadId = vibecore::ThreadId::UI;
}

extern "C" {

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1 + 2 — Engine Lifecycle, Transport, Tempo, Loop, Playhead
// ═══════════════════════════════════════════════════════════════════════════════

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_startEngine(JNIEnv*, jobject) {
    markUIThread(); ensureGroove();
    return static_cast<jboolean>(engine().start());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_stopEngine(JNIEnv*, jobject) {
    markUIThread(); engine().stop();
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_isEngineRunning(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(engine().isRunning());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setMasterGain(JNIEnv*, jobject, jfloat gain) {
    markUIThread(); engine().setMasterGain(static_cast<float>(gain));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_transportPlay(JNIEnv*, jobject) {
    markUIThread(); engine().transportPlay();
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_transportStop(JNIEnv*, jobject) {
    markUIThread(); engine().transportStop();
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_transportIsPlaying(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(engine().transportIsPlaying());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setTempo(JNIEnv*, jobject, jdouble bpm) {
    markUIThread(); engine().setTempo(static_cast<double>(bpm));
}
JNIEXPORT jdouble JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getTempo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jdouble>(engine().currentBpm());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setTimeSignature(JNIEnv*, jobject, jint n, jint d) {
    markUIThread(); engine().setTimeSignature(n, d);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setLoopEnabled(JNIEnv*, jobject, jboolean e) {
    markUIThread(); engine().setLoopEnabled(static_cast<bool>(e));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setLoopPoints(JNIEnv*, jobject, jlong s, jlong e2) {
    markUIThread(); engine().setLoopPoints(s, e2);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setPosition(JNIEnv*, jobject, jlong tick) {
    markUIThread(); engine().setPosition(tick);
}
JNIEXPORT jlong JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getCurrentTick(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jlong>(engine().currentTick());
}
JNIEXPORT jstring JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getPositionString(JNIEnv* env, jobject) {
    markUIThread();
    const auto pos = engine().currentPosition();
    char buf[64];
    snprintf(buf, sizeof(buf), "%lld:%d:%d",
             static_cast<long long>(pos.bar), pos.beat, pos.tick);
    return env->NewStringUTF(buf);
}
JNIEXPORT jdouble JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getLatencyMs(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jdouble>(engine().estimatedLatencyMs());
}
JNIEXPORT jstring JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getDiagnosticStatus(JNIEnv* env, jobject) {
    markUIThread(); return env->NewStringUTF(engine().diagnosticStatusLine().c_str());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onDeviceChange(JNIEnv*, jobject) {
    markUIThread(); engine().onDeviceChange();
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onAudioFocusGained(JNIEnv*, jobject) {
    markUIThread(); engine().onAudioFocusGained();
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onAudioFocusLost(JNIEnv*, jobject, jboolean t) {
    markUIThread(); engine().onAudioFocusLost(static_cast<bool>(t));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3 — Groove Engine
// ═══════════════════════════════════════════════════════════════════════════════

// ── Step editing ──────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStep(
        JNIEnv*, jobject, jint track, jint step, jboolean active, jint vel, jint note) {
    markUIThread();
    groove().setStep(track, step, active,
                     static_cast<uint8_t>(vel), static_cast<uint8_t>(note));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepVelocity(
        JNIEnv*, jobject, jint t, jint s, jint vel) {
    markUIThread(); groove().setStepVelocity(t, s, static_cast<uint8_t>(vel));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepNote(
        JNIEnv*, jobject, jint t, jint s, jint note) {
    markUIThread(); groove().setStepNote(t, s, static_cast<uint8_t>(note));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepProbability(
        JNIEnv*, jobject, jint t, jint s, jint prob) {
    markUIThread(); groove().setStepProbability(t, s, static_cast<uint8_t>(prob));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepMuted(
        JNIEnv*, jobject, jint t, jint s, jboolean m) {
    markUIThread(); groove().setStepMuted(t, s, static_cast<bool>(m));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepAccent(
        JNIEnv*, jobject, jint t, jint s, jboolean a) {
    markUIThread(); groove().setStepAccent(t, s, static_cast<bool>(a));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepRoll(
        JNIEnv*, jobject, jint t, jint s, jint count) {
    markUIThread(); groove().setStepRoll(t, s, static_cast<uint8_t>(count));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepFlam(
        JNIEnv*, jobject, jint t, jint s, jboolean f) {
    markUIThread(); groove().setStepFlam(t, s, static_cast<bool>(f));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetStepMicroTiming(
        JNIEnv*, jobject, jint t, jint s, jint ticks) {
    markUIThread(); groove().setStepMicroTiming(t, s, static_cast<int16_t>(ticks));
}

// ── Pattern ───────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetPatternLength(
        JNIEnv*, jobject, jint t, jint len) {
    markUIThread(); groove().setPatternLength(t, len);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetSwing(
        JNIEnv*, jobject, jint t, jint swing) {
    markUIThread(); groove().setSwing(t, static_cast<uint8_t>(swing));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetHumanize(
        JNIEnv*, jobject, jint t, jint h) {
    markUIThread(); groove().setHumanize(t, static_cast<uint8_t>(h));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveClearPattern(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().clearPattern(t);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveCopyPattern(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().copyPattern(t);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_groovePastePattern(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().pastePattern(t);
}

// ── Undo / Redo ───────────────────────────────────────────────────────────────

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().undo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().redo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveCanUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().canUndo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveCanRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().canRedo());
}

// ── Track ─────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetTrackMute(
        JNIEnv*, jobject, jint t, jboolean m) {
    markUIThread(); groove().setTrackMute(t, m);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetTrackSolo(
        JNIEnv*, jobject, jint t, jboolean s) {
    markUIThread(); groove().setTrackSolo(t, s);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetTrackVolume(
        JNIEnv*, jobject, jint t, jint v) {
    markUIThread(); groove().setTrackVolume(t, static_cast<uint8_t>(v));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetTrackSample(
        JNIEnv*, jobject, jint t, jint id) {
    markUIThread(); groove().setTrackSample(t, id);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveSetTrackMode(
        JNIEnv*, jobject, jint t, jint mode) {
    markUIThread(); groove().setTrackMode(t, static_cast<vibecore::TrackMode>(mode));
}

// ── Scene ─────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveQueueSceneChange(
        JNIEnv*, jobject, jint scene) {
    markUIThread(); groove().queueSceneChange(scene);
}

// ── Piano Roll ────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveAddPianoRollNote(
        JNIEnv*, jobject, jint t, jlong startTick, jlong endTick, jint note, jint vel) {
    markUIThread();
    groove().addPianoRollNote(t, startTick, endTick,
                              static_cast<uint8_t>(note), static_cast<uint8_t>(vel));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveRemovePianoRollNote(
        JNIEnv*, jobject, jint t, jint idx) {
    markUIThread(); groove().removePianoRollNote(t, idx);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveClearPianoRoll(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().clearPianoRoll(t);
}

// ── Query ─────────────────────────────────────────────────────────────────────

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveActiveVoices(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jint>(groove().activeVoiceCount());
}
JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveCurrentStep(JNIEnv*, jobject, jint t) {
    markUIThread(); return static_cast<jint>(groove().currentStep(t));
}
JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveActiveScene(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jint>(groove().activeScene());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_grooveIsPlaying(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().isPlaying());
}

// ─── Phase 5: Bass (included here to share bass() helper) ─────────────────────
#include "jni_bass_bridge.cpp"

} // extern "C"
