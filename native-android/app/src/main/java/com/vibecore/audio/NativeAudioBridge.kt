package com.vibecore.audio

import android.webkit.JavascriptInterface
import android.util.Log

/**
 * Brücke zwischen dem Base44-WebView (JavaScript) und der nativen Oboe-Engine (C++).
 *
 * Im Host-WebView registrieren:
 *   webView.addJavascriptInterface(NativeAudioBridge(), "VibeCoreNative")
 *
 * JS ruft dann: window.VibeCoreNative.start(), .trigger(...) usw.
 *
 * Oboe läuft AAudio/OpenSL ES — ausschließlich auf echtem Android-Gerät,
 * niemals im Browser. Im Browser nutzt die Web-App Web Audio als Fallback.
 */
class NativeAudioBridge {

    companion object {
        private const val TAG = "VibeCore"

        init {
            try {
                System.loadLibrary("vibecore-native")
                Log.i(TAG, "vibecore-native geladen")
            } catch (e: UnsatisfiedLinkError) {
                Log.e(TAG, "Native lib nicht gefunden: ${e.message}")
            }
        }
    }

    // ── Native Methoden (JNI, jni_bridge.cpp) ───────────────────────────────
    private external fun nativeStart(): Int
    private external fun nativeStop()
    private external fun nativeSetTempo(bpm: Double)
    private external fun nativeSetMasterGain(gain: Float)
    private external fun nativeLoadSample(
        slot: Int, data: FloatArray, frames: Int, channels: Int, sampleRate: Int
    ): Int
    private external fun nativeTrigger(slot: Int, semitones: Float, velocity: Float, loop: Boolean)
    private external fun nativeGetLatency(): Int
    private external fun nativeConfigure(framesPerBurst: Int, bigCpuIndex: Int, enableAdpf: Boolean): Int

    // ── JavaScript-Schnittstelle (vom WebView aus erreichbar) ───────────────
    @JavascriptInterface
    fun start(): Int = try { nativeStart() } catch (e: Throwable) { Log.e(TAG, "start: ${e.message}"); -1 }

    @JavascriptInterface
    fun stop() { try { nativeStop() } catch (e: Throwable) { Log.e(TAG, "stop: ${e.message}") } }

    @JavascriptInterface
    fun setTempo(bpm: Double) { try { nativeSetTempo(bpm) } catch (e: Throwable) {} }

    @JavascriptInterface
    fun setMasterGain(gain: Float) { try { nativeSetMasterGain(gain) } catch (e: Throwable) {} }

    @JavascriptInterface
    fun loadSample(slot: Int, data: FloatArray, frames: Int, channels: Int, sampleRate: Int): Int =
        try { nativeLoadSample(slot, data, frames, channels, sampleRate) }
        catch (e: Throwable) { Log.e(TAG, "loadSample: ${e.message}"); -1 }

    @JavascriptInterface
    fun trigger(slot: Int, semitones: Float, velocity: Float, loop: Boolean) {
        try { nativeTrigger(slot, semitones, velocity, loop) }
        catch (e: Throwable) { Log.e(TAG, "trigger: ${e.message}") }
    }

    @JavascriptInterface
    fun getLatencyMs(): Int = try { nativeGetLatency() } catch (e: Throwable) { -1 }

    @JavascriptInterface
    fun configure(framesPerBurst: Int, bigCpuIndex: Int, enableAdpf: Boolean): Int =
        try { nativeConfigure(framesPerBurst, bigCpuIndex, enableAdpf) }
        catch (e: Throwable) { Log.e(TAG, "configure: ${e.message}"); -1 }

    /** Wird von JS beim Start gepollt, um Verfügbarkeit zu prüfen. */
    @JavascriptInterface
    fun isAvailable(): Boolean = true
}