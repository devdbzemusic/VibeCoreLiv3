// VibeCore — JNI-Brücke zwischen Kotlin (@JavascriptInterface) und C++-Engine.
#include "vibecore_engine.h"

#include <jni.h>
#include <android/log.h>

#define TAG "VibeCore"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

using vibecore::AudioEngine;

namespace {
AudioEngine& engine() {
    static AudioEngine e;
    return e;
}
}

extern "C" {

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeStart(JNIEnv*, jobject) {
    return (jint)engine().start();
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeStop(JNIEnv*, jobject) {
    engine().stop();
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetTempo(JNIEnv*, jobject, jdouble bpm) {
    engine().setTempo(bpm);
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeSetMasterGain(JNIEnv*, jobject, jfloat g) {
    engine().setMasterGain(g);
}

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeLoadSample(JNIEnv* env, jobject,
        jint slot, jfloatArray jdata, jint frames, jint channels, jint sampleRate) {
    if (!jdata) return -1;
    jsize len = env->GetArrayLength(jdata);
    if (len <= 0) return -1;
    jfloat* data = env->GetFloatArrayElements(jdata, nullptr);
    if (!data) return -1;
    int r = engine().loadSample(slot, data, frames, channels, sampleRate);
    env->ReleaseFloatArrayElements(jdata, data, JNI_ABORT);
    return (jint)r;
}

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeTrigger(JNIEnv*, jobject,
        jint slot, jfloat semitones, jfloat velocity, jboolean loop) {
    engine().trigger(slot, semitones, velocity, loop == JNI_TRUE);
}

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeGetLatency(JNIEnv*, jobject) {
    return (jint)engine().getOutputLatencyMs();
}

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeConfigure(JNIEnv*, jobject,
        jint framesPerBurst, jint bigCpuIndex, jboolean enableAdpf) {
    return (jint)engine().configure(framesPerBurst, bigCpuIndex, enableAdpf == JNI_TRUE);
}

} // extern "C"