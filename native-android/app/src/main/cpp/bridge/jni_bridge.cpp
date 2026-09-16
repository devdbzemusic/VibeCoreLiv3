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
#include "../voice/VoiceEngine.h"
#include "../voice/VoiceNode.h"

// ─── Engine + GrooveEngine + BassEngine + VoiceEngine singletons ─────────────

static std::unique_ptr<vibecore::VibeCoreAudioEngine> gEngine;
static std::unique_ptr<vibecore::GrooveEngine>        gGroove;
static std::unique_ptr<vibecore::BassEngine>          gBass;
static std::unique_ptr<vibecore::VoiceEngine>         gVoice;
static vibecore::NodeId                                gGrooveNodeId = vibecore::kInvalidNodeId;
static vibecore::NodeId                                gBassNodeId   = vibecore::kInvalidNodeId;
static vibecore::NodeId                                gVoiceNodeId  = vibecore::kInvalidNodeId;
static vibecore::GrooveNode*                           gGrooveNodePtr = nullptr;
static vibecore::BassNode*                             gBassNodePtr   = nullptr;
static vibecore::VoiceNode*                            gVoiceNodePtr  = nullptr;

static vibecore::VibeCoreAudioEngine& engine() {
    if (!gEngine) gEngine = std::make_unique<vibecore::VibeCoreAudioEngine>();
    return *gEngine;
}

static void ensureGroove() {
    if (gGroove) return;
    auto node = std::make_unique<vibecore::GrooveNode>(1);
    gGrooveNodePtr = node.get();
    gGrooveNodeId = engine().graph().addNode(std::move(node));
    gGroove = std::make_unique<vibecore::GrooveEngine>(*gGrooveNodePtr);
    // Re-wire instrument targets if instruments were created first
    if (gBassNodePtr)  gGrooveNodePtr->setBassTarget(gBassNodePtr);
    if (gVoiceNodePtr) gGrooveNodePtr->setVoiceTarget(gVoiceNodePtr);
}

static vibecore::GrooveEngine& groove() {
    ensureGroove();
    return *gGroove;
}

static void ensureBass() {
    if (gBass) return;
    ensureGroove();   // Groove must be inserted first → renders first (dispatch before instruments)
    auto node = std::make_unique<vibecore::BassNode>(2);
    gBassNodePtr = node.get();
    gBassNodeId = engine().graph().addNode(std::move(node));
    gBass = std::make_unique<vibecore::BassEngine>(*gBassNodePtr);
    if (gGrooveNodePtr) gGrooveNodePtr->setBassTarget(gBassNodePtr);
}

static vibecore::BassEngine& bass() {
    ensureBass();
    return *gBass;
}

static void ensureVoice() {
    if (gVoice) return;
    ensureGroove();   // Groove must be inserted first → renders first (dispatch before instruments)
    auto node = std::make_unique<vibecore::VoiceNode>(3);
    gVoiceNodePtr = node.get();
    gVoiceNodeId = engine().graph().addNode(std::move(node));
    gVoice = std::make_unique<vibecore::VoiceEngine>(*gVoiceNodePtr);
    if (gGrooveNodePtr) gGrooveNodePtr->setVoiceTarget(gVoiceNodePtr);
}

static vibecore::VoiceEngine& voice() {
    ensureVoice();
    return *gVoice;
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
Java_com_vibecore_audio_NativeAudioBridge_nativeStartEngine(JNIEnv*, jobject) {
    markUIThread(); ensureGroove();
    return static_cast<jboolean>(engine().start());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeStopEngine(JNIEnv*, jobject) {
    markUIThread(); engine().stop();
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeIsEngineRunning(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(engine().isRunning());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetMasterGain(JNIEnv*, jobject, jfloat gain) {
    markUIThread(); engine().setMasterGain(static_cast<float>(gain));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeTransportPlay(JNIEnv*, jobject) {
    markUIThread(); engine().transportPlay();
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeTransportStop(JNIEnv*, jobject) {
    markUIThread(); engine().transportStop();
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeTransportIsPlaying(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(engine().transportIsPlaying());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetTempo(JNIEnv*, jobject, jdouble bpm) {
    markUIThread(); engine().setTempo(static_cast<double>(bpm));
}
JNIEXPORT jdouble JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGetTempo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jdouble>(engine().currentBpm());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetTimeSignature(JNIEnv*, jobject, jint n, jint d) {
    markUIThread(); engine().setTimeSignature(n, d);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetLoopEnabled(JNIEnv*, jobject, jboolean e) {
    markUIThread(); engine().setLoopEnabled(static_cast<bool>(e));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetLoopPoints(JNIEnv*, jobject, jlong s, jlong e2) {
    markUIThread(); engine().setLoopPoints(s, e2);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetPosition(JNIEnv*, jobject, jlong tick) {
    markUIThread(); engine().setPosition(tick);
}
JNIEXPORT jlong JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGetCurrentTick(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jlong>(engine().currentTick());
}
JNIEXPORT jstring JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGetPositionString(JNIEnv* env, jobject) {
    markUIThread();
    const auto pos = engine().currentPosition();
    char buf[64];
    snprintf(buf, sizeof(buf), "%lld:%d:%d",
             static_cast<long long>(pos.bar), pos.beat, pos.tick);
    return env->NewStringUTF(buf);
}
JNIEXPORT jdouble JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGetLatencyMs(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jdouble>(engine().estimatedLatencyMs());
}
JNIEXPORT jstring JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGetDiagnosticStatus(JNIEnv* env, jobject) {
    markUIThread(); return env->NewStringUTF(engine().diagnosticStatusLine().c_str());
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeOnDeviceChange(JNIEnv*, jobject) {
    markUIThread(); engine().onDeviceChange();
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeOnAudioFocusGained(JNIEnv*, jobject) {
    markUIThread(); engine().onAudioFocusGained();
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeOnAudioFocusLost(JNIEnv*, jobject, jboolean t) {
    markUIThread(); engine().onAudioFocusLost(static_cast<bool>(t));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 3 — Groove Engine
// ═══════════════════════════════════════════════════════════════════════════════

// ── Step editing ──────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStep(
        JNIEnv*, jobject, jint track, jint step, jboolean active, jint vel, jint note) {
    markUIThread();
    groove().setStep(track, step, active,
                     static_cast<uint8_t>(vel), static_cast<uint8_t>(note));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepVelocity(
        JNIEnv*, jobject, jint t, jint s, jint vel) {
    markUIThread(); groove().setStepVelocity(t, s, static_cast<uint8_t>(vel));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepNote(
        JNIEnv*, jobject, jint t, jint s, jint note) {
    markUIThread(); groove().setStepNote(t, s, static_cast<uint8_t>(note));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepProbability(
        JNIEnv*, jobject, jint t, jint s, jint prob) {
    markUIThread(); groove().setStepProbability(t, s, static_cast<uint8_t>(prob));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepMuted(
        JNIEnv*, jobject, jint t, jint s, jboolean m) {
    markUIThread(); groove().setStepMuted(t, s, static_cast<bool>(m));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepAccent(
        JNIEnv*, jobject, jint t, jint s, jboolean a) {
    markUIThread(); groove().setStepAccent(t, s, static_cast<bool>(a));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepRoll(
        JNIEnv*, jobject, jint t, jint s, jint count) {
    markUIThread(); groove().setStepRoll(t, s, static_cast<uint8_t>(count));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepFlam(
        JNIEnv*, jobject, jint t, jint s, jboolean f) {
    markUIThread(); groove().setStepFlam(t, s, static_cast<bool>(f));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetStepMicroTiming(
        JNIEnv*, jobject, jint t, jint s, jint ticks) {
    markUIThread(); groove().setStepMicroTiming(t, s, static_cast<int16_t>(ticks));
}

// ── Pattern ───────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetPatternLength(
        JNIEnv*, jobject, jint t, jint len) {
    markUIThread(); groove().setPatternLength(t, len);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetSwing(
        JNIEnv*, jobject, jint t, jint swing) {
    markUIThread(); groove().setSwing(t, static_cast<uint8_t>(swing));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetHumanize(
        JNIEnv*, jobject, jint t, jint h) {
    markUIThread(); groove().setHumanize(t, static_cast<uint8_t>(h));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveClearPattern(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().clearPattern(t);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveCopyPattern(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().copyPattern(t);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGroovePastePattern(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().pastePattern(t);
}

// ── Undo / Redo ───────────────────────────────────────────────────────────────

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().undo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().redo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveCanUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().canUndo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveCanRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().canRedo());
}

// ── Track ─────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetTrackMute(
        JNIEnv*, jobject, jint t, jboolean m) {
    markUIThread(); groove().setTrackMute(t, m);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetTrackSolo(
        JNIEnv*, jobject, jint t, jboolean s) {
    markUIThread(); groove().setTrackSolo(t, s);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetTrackVolume(
        JNIEnv*, jobject, jint t, jint v) {
    markUIThread(); groove().setTrackVolume(t, static_cast<uint8_t>(v));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetTrackSample(
        JNIEnv*, jobject, jint t, jint id) {
    markUIThread(); groove().setTrackSample(t, id);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveSetTrackMode(
        JNIEnv*, jobject, jint t, jint mode) {
    markUIThread(); groove().setTrackMode(t, static_cast<vibecore::TrackMode>(mode));
}

// ── Scene ─────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveQueueSceneChange(
        JNIEnv*, jobject, jint scene) {
    markUIThread(); groove().queueSceneChange(scene);
}

// ── Piano Roll ────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveAddPianoRollNote(
        JNIEnv*, jobject, jint t, jlong startTick, jlong endTick, jint note, jint vel) {
    markUIThread();
    groove().addPianoRollNote(t, startTick, endTick,
                              static_cast<uint8_t>(note), static_cast<uint8_t>(vel));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveRemovePianoRollNote(
        JNIEnv*, jobject, jint t, jint idx) {
    markUIThread(); groove().removePianoRollNote(t, idx);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveClearPianoRoll(JNIEnv*, jobject, jint t) {
    markUIThread(); groove().clearPianoRoll(t);
}

// ── Query ─────────────────────────────────────────────────────────────────────

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveActiveVoices(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jint>(groove().activeVoiceCount());
}
JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveCurrentStep(JNIEnv*, jobject, jint t) {
    markUIThread(); return static_cast<jint>(groove().currentStep(t));
}
JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveActiveScene(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jint>(groove().activeScene());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGrooveIsPlaying(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(groove().isPlaying());
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audio Asset Service — Groove cold-load PCM (same engine()/groove() authority)
// ═══════════════════════════════════════════════════════════════════════════════

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeGrooveAssetBridge_nativeCanLoad(JNIEnv*, jobject) {
    markUIThread();
    return static_cast<jboolean>(!engine().isRunning());
}

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeGrooveAssetBridge_nativeLoadSample(
        JNIEnv* env, jobject, jint sampleId, jfloatArray pcm, jint sampleRate) {
    markUIThread();
    if (engine().isRunning() || pcm == nullptr || sampleRate <= 0) return JNI_FALSE;
    if (sampleId < 0 || sampleId >= vibecore::kMaxSamples) return JNI_FALSE;

    const jsize length = env->GetArrayLength(pcm);
    if (length <= 0) return JNI_FALSE;

    jboolean isCopy = JNI_FALSE;
    jfloat* data = env->GetFloatArrayElements(pcm, &isCopy);
    if (data == nullptr) return JNI_FALSE;

    const bool loaded = groove().loadSample(
        static_cast<int32_t>(sampleId),
        data,
        static_cast<int32_t>(length),
        static_cast<int32_t>(sampleRate));

    // GrooveEngine copied the incoming PCM into engine-owned storage.
    env->ReleaseFloatArrayElements(pcm, data, JNI_ABORT);
    return static_cast<jboolean>(loaded);
}

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeGrooveAssetBridge_nativeClearSample(
        JNIEnv*, jobject, jint sampleId) {
    markUIThread();
    if (engine().isRunning()) return JNI_FALSE;
    if (sampleId < 0 || sampleId >= vibecore::kMaxSamples) return JNI_FALSE;
    groove().clearSample(static_cast<int32_t>(sampleId));
    return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeGrooveAssetBridge_nativeSampleLoaded(
        JNIEnv*, jobject, jint sampleId) {
    markUIThread();
    if (sampleId < 0 || sampleId >= vibecore::kMaxSamples) return JNI_FALSE;
    return static_cast<jboolean>(groove().sampleLoaded(static_cast<int32_t>(sampleId)));
}

// ─── Phase 5: Bass (included here to share bass() helper) ─────────────────────
#include "jni_bass_bridge.cpp"

// ─── Phase 6: Voice (included here to share voice() helper) ───────────────────
#include "jni_voice_bridge.cpp"

} // extern "C"
