/**
 * jni_bridge.cpp — JNI entry points for VibeCore Native Platform.
 *
 * Bridge layer contract:
 *   - NO business logic here. Only marshalling between Java types and C++ types.
 *   - Every function marks the calling thread as UI thread.
 *   - The engine singleton is process-scoped (one per app process).
 *
 * Current bridge mechanism: Android WebView @JavascriptInterface → JNI
 * Future path: JSI / TurboModule (tracked in ADR-005)
 *
 * API surface (matches NativeAudioBridge.kt):
 *   startEngine()          → bool
 *   stopEngine()           → void
 *   setMasterGain(float)   → void
 *   setTempo(float)        → void
 *   getLatencyMs()         → double
 *   getDiagnosticStatus()  → String
 *   isAvailable()          → bool
 *   onDeviceChange()       → void
 *   onAudioFocusGained()   → void
 *   onAudioFocusLost(bool) → void
 */

#include <jni.h>
#include <memory>

#include "../platform/VibeCoreAudioEngine.h"
#include "../platform/VibeCoreLog.h"
#include "../threads/ThreadModel.h"

// ─── Engine singleton ─────────────────────────────────────────────────────────

static std::unique_ptr<vibecore::VibeCoreAudioEngine> gEngine;

static vibecore::VibeCoreAudioEngine& engine() {
    if (!gEngine) {
        gEngine = std::make_unique<vibecore::VibeCoreAudioEngine>();
    }
    return *gEngine;
}

// ─── JNI helpers ─────────────────────────────────────────────────────────────

// Mark the calling thread as UI thread on first JNI call
static void markUIThread() {
    if (vibecore::currentThreadId == vibecore::ThreadId::Unknown) {
        vibecore::currentThreadId = vibecore::ThreadId::UI;
    }
}

// ─── JNI exports ─────────────────────────────────────────────────────────────

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_startEngine(JNIEnv* /*env*/, jobject /*thiz*/) {
    markUIThread();
    const bool ok = engine().start();
    VLOG_I("startEngine() → %s", ok ? "ok" : "failed");
    return static_cast<jboolean>(ok);
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_stopEngine(JNIEnv* /*env*/, jobject /*thiz*/) {
    markUIThread();
    engine().stop();
    VLOG_I("stopEngine()");
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setMasterGain(JNIEnv* /*env*/, jobject /*thiz*/,
                                                          jfloat gain) {
    markUIThread();
    engine().setMasterGain(static_cast<float>(gain));
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_setTempo(JNIEnv* /*env*/, jobject /*thiz*/,
                                                     jfloat bpm) {
    markUIThread();
    engine().setTempo(static_cast<float>(bpm));
}

JNIEXPORT jdouble JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getLatencyMs(JNIEnv* /*env*/, jobject /*thiz*/) {
    markUIThread();
    return static_cast<jdouble>(engine().estimatedLatencyMs());
}

JNIEXPORT jstring JNICALL
Java_com_vibecore_audio_NativeAudioBridge_getDiagnosticStatus(JNIEnv* env, jobject /*thiz*/) {
    markUIThread();
    const std::string status = engine().diagnosticStatusLine();
    return env->NewStringUTF(status.c_str());
}

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_isEngineRunning(JNIEnv* /*env*/, jobject /*thiz*/) {
    markUIThread();
    return static_cast<jboolean>(engine().isRunning());
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onDeviceChange(JNIEnv* /*env*/, jobject /*thiz*/) {
    markUIThread();
    engine().onDeviceChange();
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onAudioFocusGained(JNIEnv* /*env*/, jobject /*thiz*/) {
    markUIThread();
    engine().onAudioFocusGained();
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_onAudioFocusLost(JNIEnv* /*env*/, jobject /*thiz*/,
                                                             jboolean transient) {
    markUIThread();
    engine().onAudioFocusLost(static_cast<bool>(transient));
}

} // extern "C"
