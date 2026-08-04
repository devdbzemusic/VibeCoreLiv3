package com.vibecore.audio

import android.content.Context
import android.webkit.JavascriptInterface
import android.util.Log

/**
 * NativeAudioBridge — WebView @JavascriptInterface bridge to VibeCoreAudioEngine.
 *
 * Phase 2 additions: transport control, tempo, time signature,
 * loop points, playhead position, musical position query.
 *
 * Bridge contract (ADR-005): NO business logic. Marshalling + error handling only.
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

    // ── Availability ──────────────────────────────────────────────────────────

    @JavascriptInterface
    fun isAvailable(): Boolean = isLoaded

    // ── Engine lifecycle ──────────────────────────────────────────────────────

    @JavascriptInterface
    fun startEngine(): Boolean {
        if (!isLoaded) return false
        return try { nativeStartEngine() }
        catch (e: Exception) { Log.e(tag, "startEngine: ${e.message}"); false }
    }

    @JavascriptInterface
    fun stopEngine() {
        if (!isLoaded) return
        try { nativeStopEngine() }
        catch (e: Exception) { Log.e(tag, "stopEngine: ${e.message}") }
    }

    @JavascriptInterface
    fun isEngineRunning(): Boolean {
        if (!isLoaded) return false
        return try { nativeIsEngineRunning() } catch (e: Exception) { false }
    }

    // ── Master gain ───────────────────────────────────────────────────────────

    @JavascriptInterface
    fun setMasterGain(gain: Float) {
        if (!isLoaded) return
        try { nativeSetMasterGain(gain.coerceIn(0f, 1f)) }
        catch (e: Exception) { Log.e(tag, "setMasterGain: ${e.message}") }
    }

    // ── Transport ─────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun play() {
        if (!isLoaded) return
        try { nativeTransportPlay() }
        catch (e: Exception) { Log.e(tag, "play: ${e.message}") }
    }

    @JavascriptInterface
    fun stop() {
        if (!isLoaded) return
        try { nativeTransportStop() }
        catch (e: Exception) { Log.e(tag, "stop: ${e.message}") }
    }

    @JavascriptInterface
    fun isPlaying(): Boolean {
        if (!isLoaded) return false
        return try { nativeTransportIsPlaying() } catch (e: Exception) { false }
    }

    // ── Tempo / Time Signature ────────────────────────────────────────────────

    @JavascriptInterface
    fun setTempo(bpm: Double) {
        if (!isLoaded) return
        try { nativeSetTempo(bpm.coerceIn(20.0, 300.0)) }
        catch (e: Exception) { Log.e(tag, "setTempo: ${e.message}") }
    }

    @JavascriptInterface
    fun getTempo(): Double {
        if (!isLoaded) return 120.0
        return try { nativeGetTempo() } catch (e: Exception) { 120.0 }
    }

    @JavascriptInterface
    fun setTimeSignature(numerator: Int, denominator: Int) {
        if (!isLoaded) return
        try { nativeSetTimeSignature(numerator, denominator) }
        catch (e: Exception) { Log.e(tag, "setTimeSignature: ${e.message}") }
    }

    // ── Loop ──────────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun setLoopEnabled(enabled: Boolean) {
        if (!isLoaded) return
        try { nativeSetLoopEnabled(enabled) }
        catch (e: Exception) { Log.e(tag, "setLoopEnabled: ${e.message}") }
    }

    @JavascriptInterface
    fun setLoopPoints(startTick: Long, endTick: Long) {
        if (!isLoaded) return
        try { nativeSetLoopPoints(startTick, endTick) }
        catch (e: Exception) { Log.e(tag, "setLoopPoints: ${e.message}") }
    }

    // ── Playhead ──────────────────────────────────────────────────────────────

    @JavascriptInterface
    fun setPosition(absoluteTick: Long) {
        if (!isLoaded) return
        try { nativeSetPosition(absoluteTick) }
        catch (e: Exception) { Log.e(tag, "setPosition: ${e.message}") }
    }

    @JavascriptInterface
    fun getCurrentTick(): Long {
        if (!isLoaded) return 0L
        return try { nativeGetCurrentTick() } catch (e: Exception) { 0L }
    }

    /** Returns current position as "bar:beat:tick" string, e.g. "4:2:960" */
    @JavascriptInterface
    fun getPositionString(): String {
        if (!isLoaded) return "0:0:0"
        return try { nativeGetPositionString() } catch (e: Exception) { "0:0:0" }
    }

    // ── Diagnostics ───────────────────────────────────────────────────────────

    @JavascriptInterface
    fun getLatencyMs(): Double {
        if (!isLoaded) return -1.0
        return try { nativeGetLatencyMs() } catch (e: Exception) { -1.0 }
    }

    @JavascriptInterface
    fun getDiagnosticStatus(): String {
        if (!isLoaded) return "native:unavailable"
        return try { nativeGetDiagnosticStatus() } catch (e: Exception) { "native:error" }
    }

    // ── Android system events ─────────────────────────────────────────────────

    fun onDeviceChange() {
        if (!isLoaded) return
        try { nativeOnDeviceChange() } catch (e: Exception) { Log.e(tag, "onDeviceChange: ${e.message}") }
    }

    fun onAudioFocusGained() {
        if (!isLoaded) return
        try { nativeOnAudioFocusGained() } catch (e: Exception) { Log.e(tag, "onAudioFocusGained: ${e.message}") }
    }

    fun onAudioFocusLost(transient: Boolean) {
        if (!isLoaded) return
        try { nativeOnAudioFocusLost(transient) } catch (e: Exception) { Log.e(tag, "onAudioFocusLost: ${e.message}") }
    }

    // ── JNI declarations ──────────────────────────────────────────────────────

    private external fun nativeStartEngine(): Boolean
    private external fun nativeStopEngine()
    private external fun nativeIsEngineRunning(): Boolean
    private external fun nativeSetMasterGain(gain: Float)
    private external fun nativeTransportPlay()
    private external fun nativeTransportStop()
    private external fun nativeTransportIsPlaying(): Boolean
    private external fun nativeSetTempo(bpm: Double)
    private external fun nativeGetTempo(): Double
    private external fun nativeSetTimeSignature(numerator: Int, denominator: Int)
    private external fun nativeSetLoopEnabled(enabled: Boolean)
    private external fun nativeSetLoopPoints(startTick: Long, endTick: Long)
    private external fun nativeSetPosition(absoluteTick: Long)
    private external fun nativeGetCurrentTick(): Long
    private external fun nativeGetPositionString(): String
    private external fun nativeGetLatencyMs(): Double
    private external fun nativeGetDiagnosticStatus(): String
    private external fun nativeOnDeviceChange()
    private external fun nativeOnAudioFocusGained()
    private external fun nativeOnAudioFocusLost(transient: Boolean)
}
