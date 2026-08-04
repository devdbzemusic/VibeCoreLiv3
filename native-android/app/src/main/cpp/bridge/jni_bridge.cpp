/**
 * jni_bridge.cpp — JNI marshalling for VibeCore Native Platform (Phase 2).
 *
 * Bridge contract (ADR-005): NO business logic. Marshalling only.
 *
 * Phase 2 additions: transport control, tempo, time signature,
 * loop points, playhead position, musical position query.
 */

#include <jni.h>
#include <memory>

#include "../platform/VibeCoreAudioEngine.h"
#include "../platform/VibeCoreLog.h"
#include "../threads/ThreadModel.h"

static std::unique_ptr<vibecore::VibeCoreAudioEngine> gEngine;

static vibecore::VibeCoreAudioEngine& engine() {
    if (!gEngine) gEngine = std::make_unique<vibecore::VibeCoreAudioEngine>();
    return *gEngine;
}

static void markUIThread() {
    if (vibecore::currentThreadId == vibecore::ThreadId::Unknown)
        vibecore::currentThreadId = vibecore::ThreadId::UI;
}

extern "C" {

// ── Engine lifecycle ──────────────────────────────────────────────────────────

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_startEngine(JNIEnv*, jobject) {
    markUIThread();
    return static_cast<jboolean>(engine().start());
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_stopEngine(JNIEnv*, jobject) {
    markUIThread();
    engine().stop();
}

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_isEngineRunning(JNIEnv*, jobject) {
    markUIThread();
    return static_cast<jboolean>(engine().isRunning());
}

// ── Master gain ───────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setMasterGain(JNIEnv*, jobject, jfloat gain) {
    markUIThread();
    engine().setMasterGain(static_cast<float>(gain));
}

// ── Transport ─────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_transportPlay(JNIEnv*, jobject) {
    markUIThread();
    engine().transportPlay();
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_transportStop(JNIEnv*, jobject) {
    markUIThread();
    engine().transportStop();
}

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_transportIsPlaying(JNIEnv*, jobject) {
    markUIThread();
    return static_cast<jboolean>(engine().transportIsPlaying());
}

// ── Tempo / Time Signature ────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setTempo(JNIEnv*, jobject, jdouble bpm) {
    markUIThread();
    engine().setTempo(static_cast<double>(bpm));
}

JNIEXPORT jdouble JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getTempo(JNIEnv*, jobject) {
    markUIThread();
    return static_cast<jdouble>(engine().currentBpm());
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setTimeSignature(JNIEnv*, jobject,
                                                             jint numerator,
                                                             jint denominator) {
    markUIThread();
    engine().setTimeSignature(static_cast<int32_t>(numerator),
                              static_cast<int32_t>(denominator));
}

// ── Loop ──────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setLoopEnabled(JNIEnv*, jobject, jboolean enabled) {
    markUIThread();
    engine().setLoopEnabled(static_cast<bool>(enabled));
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setLoopPoints(JNIEnv*, jobject,
                                                          jlong startTick,
                                                          jlong endTick) {
    markUIThread();
    engine().setLoopPoints(static_cast<int64_t>(startTick),
                           static_cast<int64_t>(endTick));
}

// ── Playhead ──────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setPosition(JNIEnv*, jobject, jlong absoluteTick) {
    markUIThread();
    engine().setPosition(static_cast<int64_t>(absoluteTick));
}

JNIEXPORT jlong JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getCurrentTick(JNIEnv*, jobject) {
    markUIThread();
    return static_cast<jlong>(engine().currentTick());
}

// Returns "bar:beat:tick" as a String, e.g. "4:2:960"
JNIEXPORT jstring JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getPositionString(JNIEnv* env, jobject) {
    markUIThread();
    const auto pos = engine().currentPosition();
    char buf[64];
    snprintf(buf, sizeof(buf), "%lld:%d:%d",
             static_cast<long long>(pos.bar),
             pos.beat,
             pos.tick);
    return env->NewStringUTF(buf);
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

JNIEXPORT jdouble JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getLatencyMs(JNIEnv*, jobject) {
    markUIThread();
    return static_cast<jdouble>(engine().estimatedLatencyMs());
}

JNIEXPORT jstring JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getDiagnosticStatus(JNIEnv* env, jobject) {
    markUIThread();
    return env->NewStringUTF(engine().diagnosticStatusLine().c_str());
}

// ── Device / focus ────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onDeviceChange(JNIEnv*, jobject) {
    markUIThread(); engine().onDeviceChange();
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onAudioFocusGained(JNIEnv*, jobject) {
    markUIThread(); engine().onAudioFocusGained();
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onAudioFocusLost(JNIEnv*, jobject, jboolean transient) {
    markUIThread(); engine().onAudioFocusLost(static_cast<bool>(transient));
}

} // extern "C"
