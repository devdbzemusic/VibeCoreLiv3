package com.vibecore.app.nativeui

import android.content.Context
import com.vibecore.audio.NativeAudioBridge
import com.vibecore.audio.NativeGrooveAssetBridge

/**
 * Pure Android runtime boundary.
 *
 * Compose/ViewModels call this adapter directly. There is deliberately no
 * WebView, JavascriptInterface dispatch, WebAudio or browser scheduler in the
 * active Pure-Android path.
 */
class NativeRuntime(context: Context) {
    private val bridge = NativeAudioBridge(context.applicationContext)
    private val grooveAssets = NativeGrooveAssetBridge()

    fun isAvailable(): Boolean = bridge.isAvailable()
    fun isEngineRunning(): Boolean = bridge.isEngineRunning()
    fun isPlaying(): Boolean = bridge.isPlaying()
    fun tempo(): Double = bridge.getTempo()
    fun latencyMs(): Double = bridge.getLatencyMs()
    fun diagnostic(): String = bridge.getDiagnosticStatus()

    fun ensureStarted(): Boolean {
        if (!bridge.isAvailable()) return false
        if (bridge.isEngineRunning()) return true
        return bridge.startEngine()
    }

    fun play(): Boolean {
        if (!ensureStarted()) return false
        bridge.play()
        return bridge.isPlaying()
    }

    fun stop() {
        bridge.stop()
    }

    /** Stop transport + Oboe stream. Required before cold asset replacement. */
    fun stopEngine() {
        bridge.stop()
        bridge.stopEngine()
    }

    fun shutdown() = stopEngine()

    fun setTempo(bpm: Double) {
        bridge.setTempo(bpm)
    }

    fun setMasterGain(value01: Float) {
        bridge.setMasterGain(value01)
    }

    fun setStep(track: Int, step: Int, active: Boolean, velocity: Int = 100, note: Int = 60) {
        bridge.grooveSetStep(track, step, active, velocity, note)
    }

    fun clearPattern(track: Int) {
        bridge.grooveClearPattern(track)
    }

    fun setPatternLength(track: Int, steps: Int) {
        bridge.grooveSetPatternLength(track, steps)
    }

    fun setTrackMute(track: Int, muted: Boolean) {
        bridge.grooveSetTrackMute(track, muted)
    }

    fun setTrackSolo(track: Int, soloed: Boolean) {
        bridge.grooveSetTrackSolo(track, soloed)
    }

    fun setTrackVolume(track: Int, value: Int) {
        bridge.grooveSetTrackVolume(track, value)
    }

    fun setTrackMode(track: Int, kind: TrackKind) {
        bridge.grooveSetTrackMode(track, kind.nativeMode)
    }

    fun setTrackSample(track: Int, sampleId: Int) {
        bridge.grooveSetTrackSample(track, sampleId)
    }

    fun canColdLoadSample(): Boolean = grooveAssets.canLoad()

    fun loadSample(sampleId: Int, monoPcm: FloatArray, sampleRate: Int): Boolean {
        if (sampleId !in 0 until 128 || monoPcm.isEmpty() || sampleRate <= 0) return false
        if (!grooveAssets.canLoad()) return false
        if (!grooveAssets.loadSample(sampleId, monoPcm, sampleRate)) return false
        return grooveAssets.sampleLoaded(sampleId)
    }

    fun clearSample(sampleId: Int): Boolean {
        if (sampleId !in 0 until 128 || !grooveAssets.canLoad()) return false
        return grooveAssets.clearSample(sampleId)
    }

    fun currentStep(track: Int): Int = bridge.grooveCurrentStep(track)
    fun activeVoices(): Int = bridge.grooveActiveVoices()

    fun onAudioFocusGained() = bridge.onAudioFocusGained()
    fun onAudioFocusLost(transient: Boolean) = bridge.onAudioFocusLost(transient)
}
