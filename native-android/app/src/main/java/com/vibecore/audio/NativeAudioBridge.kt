package com.vibecore.audio

import android.content.Context
import android.webkit.JavascriptInterface
import android.util.Log

/**
 * NativeAudioBridge — WebView @JavascriptInterface bridge to VibeCoreAudioEngine.
 *
 * Bridge contract (from ADR-005):
 *   - NO business logic. Marshalling only.
 *   - Every call delegates directly to JNI.
 *   - isAvailable() returns the actual load state (not hardcoded true).
 *
 * JavaScript usage (injected as window.VibeCoreNative):
 *   window.VibeCoreNative.startEngine()
 *   window.VibeCoreNative.stopEngine()
 *   window.VibeCoreNative.setMasterGain(0.8)
 *   window.VibeCoreNative.setTempo(128.0)
 *   window.VibeCoreNative.getLatencyMs()       → Double
 *   window.VibeCoreNative.getDiagnosticStatus() → String
 *   window.VibeCoreNative.isAvailable()         → Boolean
 */
class NativeAudioBridge(private val context: Context) {

    private val tag = "VibeCoreAudio"
    private val isLoaded: Boolean

    init {
        isLoaded = try {
            System.loadLibrary("vibecore-native")
            true
        } catch (e: UnsatisfiedLinkError) {
            Log.e(tag, "Failed to load vibecore-native: ${e.message}")
            false
        }
    }

    // ── Availability ─────────────────────────────────────────────────────────

    @JavascriptInterface
    fun isAvailable(): Boolean = isLoaded

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun startEngine(): Boolean {
        if (!isLoaded) return false
        return try {
            nativeStartEngine()
        } catch (e: Exception) {
            Log.e(tag, "startEngine failed: ${e.message}")
            false
        }
    }

    @JavascriptInterface
    fun stopEngine() {
        if (!isLoaded) return
        try { nativeStopEngine() }
        catch (e: Exception) { Log.e(tag, "stopEngine failed: ${e.message}") }
    }

    // ── Parameters ────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun setMasterGain(gain: Float) {
        if (!isLoaded) return
        try { nativeSetMasterGain(gain.coerceIn(0f, 1f)) }
        catch (e: Exception) { Log.e(tag, "setMasterGain failed: ${e.message}") }
    }

    @JavascriptInterface
    fun setTempo(bpm: Float) {
        if (!isLoaded) return
        try { nativeSetTempo(bpm.coerceIn(20f, 300f)) }
        catch (e: Exception) { Log.e(tag, "setTempo failed: ${e.message}") }
    }

    // ── Diagnostics ───────────────────────────────────────────────────────────

    @JavascriptInterface
    fun getLatencyMs(): Double {
        if (!isLoaded) return -1.0
        return try { nativeGetLatencyMs() }
        catch (e: Exception) { -1.0 }
    }

    @JavascriptInterface
    fun getDiagnosticStatus(): String {
        if (!isLoaded) return "native:unavailable"
        return try { nativeGetDiagnosticStatus() }
        catch (e: Exception) { "native:error" }
    }

    @JavascriptInterface
    fun isEngineRunning(): Boolean {
        if (!isLoaded) return false
        return try { nativeIsEngineRunning() }
        catch (e: Exception) { false }
    }

    // ── Android system events (called from Activity) ──────────────────────────

    fun onDeviceChange() {
        if (!isLoaded) return
        try { nativeOnDeviceChange() }
        catch (e: Exception) { Log.e(tag, "onDeviceChange failed: ${e.message}") }
    }

    fun onAudioFocusGained() {
        if (!isLoaded) return
        try { nativeOnAudioFocusGained() }
        catch (e: Exception) { Log.e(tag, "onAudioFocusGained failed: ${e.message}") }
    }

    fun onAudioFocusLost(transient: Boolean) {
        if (!isLoaded) return
        try { nativeOnAudioFocusLost(transient) }
        catch (e: Exception) { Log.e(tag, "onAudioFocusLost failed: ${e.message}") }
    }

    // ── JNI declarations ─────────────────────────────────────────────────────

    private external fun nativeStartEngine(): Boolean
    private external fun nativeStopEngine()
    private external fun nativeSetMasterGain(gain: Float)
    private external fun nativeSetTempo(bpm: Float)
    private external fun nativeGetLatencyMs(): Double
    private external fun nativeGetDiagnosticStatus(): String
    private external fun nativeIsEngineRunning(): Boolean
    private external fun nativeOnDeviceChange()
    private external fun nativeOnAudioFocusGained()
    private external fun nativeOnAudioFocusLost(transient: Boolean)
}
