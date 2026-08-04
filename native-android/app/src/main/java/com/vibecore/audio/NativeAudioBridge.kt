package com.vibecore.audio

import android.content.Context
import android.webkit.JavascriptInterface
import android.util.Log

/**
 * NativeAudioBridge — WebView @JavascriptInterface bridge to VibeCoreAudioEngine + GrooveEngine.
 *
 * Phase 1: engine lifecycle, master gain, diagnostics
 * Phase 2: transport, tempo, time signature, loop, playhead
 * Phase 3: groove — steps, patterns, tracks, scenes, piano roll, undo/redo
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

    @JavascriptInterface fun isAvailable(): Boolean = isLoaded

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
        try { nativeStopEngine() } catch (e: Exception) { Log.e(tag, "stopEngine: ${e.message}") }
    }

    @JavascriptInterface
    fun isEngineRunning(): Boolean {
        if (!isLoaded) return false
        return try { nativeIsEngineRunning() } catch (e: Exception) { false }
    }

    @JavascriptInterface
    fun setMasterGain(gain: Float) {
        if (!isLoaded) return
        try { nativeSetMasterGain(gain.coerceIn(0f, 1f)) }
        catch (e: Exception) { Log.e(tag, "setMasterGain: ${e.message}") }
    }

    // ── Transport ─────────────────────────────────────────────────────────────

    @JavascriptInterface fun play()  { if (isLoaded) try { nativeTransportPlay()  } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun stop()  { if (isLoaded) try { nativeTransportStop()  } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun isPlaying(): Boolean { if (!isLoaded) return false; return try { nativeTransportIsPlaying() } catch (e: Exception) { false } }

    // ── Tempo / Time Signature ────────────────────────────────────────────────

    @JavascriptInterface
    fun setTempo(bpm: Double) {
        if (!isLoaded) return
        try { nativeSetTempo(bpm.coerceIn(20.0, 300.0)) }
        catch (e: Exception) { Log.e(tag, "setTempo: ${e.message}") }
    }

    @JavascriptInterface
    fun getTempo(): Double { if (!isLoaded) return 120.0; return try { nativeGetTempo() } catch (e: Exception) { 120.0 } }

    @JavascriptInterface
    fun setTimeSignature(numerator: Int, denominator: Int) {
        if (!isLoaded) return
        try { nativeSetTimeSignature(numerator, denominator) }
        catch (e: Exception) { Log.e(tag, "setTimeSignature: ${e.message}") }
    }

    // ── Loop ──────────────────────────────────────────────────────────────────

    @JavascriptInterface fun setLoopEnabled(enabled: Boolean) { if (isLoaded) try { nativeSetLoopEnabled(enabled) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun setLoopPoints(startTick: Long, endTick: Long) { if (isLoaded) try { nativeSetLoopPoints(startTick, endTick) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Playhead ──────────────────────────────────────────────────────────────

    @JavascriptInterface fun setPosition(absoluteTick: Long) { if (isLoaded) try { nativeSetPosition(absoluteTick) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun getCurrentTick(): Long { if (!isLoaded) return 0L; return try { nativeGetCurrentTick() } catch (e: Exception) { 0L } }
    @JavascriptInterface fun getPositionString(): String { if (!isLoaded) return "0:0:0"; return try { nativeGetPositionString() } catch (e: Exception) { "0:0:0" } }

    // ── Diagnostics ───────────────────────────────────────────────────────────

    @JavascriptInterface fun getLatencyMs(): Double { if (!isLoaded) return -1.0; return try { nativeGetLatencyMs() } catch (e: Exception) { -1.0 } }
    @JavascriptInterface fun getDiagnosticStatus(): String { if (!isLoaded) return "native:unavailable"; return try { nativeGetDiagnosticStatus() } catch (e: Exception) { "native:error" } }

    // ── Android system events ─────────────────────────────────────────────────

    fun onDeviceChange()                 { if (isLoaded) try { nativeOnDeviceChange() } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    fun onAudioFocusGained()             { if (isLoaded) try { nativeOnAudioFocusGained() } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    fun onAudioFocusLost(t: Boolean)     { if (isLoaded) try { nativeOnAudioFocusLost(t) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Phase 3: Groove — Step editing ───────────────────────────────────────

    @JavascriptInterface
    fun grooveSetStep(track: Int, step: Int, active: Boolean, vel: Int = 100, note: Int = 60) {
        if (!isLoaded) return
        try { nativeGrooveSetStep(track, step, active, vel.coerceIn(0,127), note.coerceIn(0,127)) }
        catch (e: Exception) { Log.e(tag, "grooveSetStep: ${e.message}") }
    }

    @JavascriptInterface fun grooveSetStepVelocity   (t: Int, s: Int, vel: Int)    { if (isLoaded) try { nativeGrooveSetStepVelocity(t, s, vel.coerceIn(0,127)) }    catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetStepNote        (t: Int, s: Int, note: Int)   { if (isLoaded) try { nativeGrooveSetStepNote(t, s, note.coerceIn(0,127)) }       catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetStepProbability (t: Int, s: Int, prob: Int)   { if (isLoaded) try { nativeGrooveSetStepProbability(t, s, prob.coerceIn(0,100)) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetStepMuted       (t: Int, s: Int, m: Boolean)  { if (isLoaded) try { nativeGrooveSetStepMuted(t, s, m) }                         catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetStepAccent      (t: Int, s: Int, a: Boolean)  { if (isLoaded) try { nativeGrooveSetStepAccent(t, s, a) }                        catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetStepRoll        (t: Int, s: Int, count: Int)  { if (isLoaded) try { nativeGrooveSetStepRoll(t, s, count.coerceIn(0,8)) }        catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetStepFlam        (t: Int, s: Int, f: Boolean)  { if (isLoaded) try { nativeGrooveSetStepFlam(t, s, f) }                          catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetStepMicroTiming (t: Int, s: Int, ticks: Int)  { if (isLoaded) try { nativeGrooveSetStepMicroTiming(t, s, ticks) }               catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Phase 3: Groove — Pattern ─────────────────────────────────────────────

    @JavascriptInterface fun grooveSetPatternLength (t: Int, len: Int)    { if (isLoaded) try { nativeGrooveSetPatternLength(t, len.coerceIn(1,64)) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetSwing         (t: Int, s: Int)      { if (isLoaded) try { nativeGrooveSetSwing(t, s.coerceIn(0,100)) }          catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetHumanize      (t: Int, h: Int)      { if (isLoaded) try { nativeGrooveSetHumanize(t, h.coerceIn(0,100)) }       catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveClearPattern     (t: Int)              { if (isLoaded) try { nativeGrooveClearPattern(t) }                         catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveCopyPattern      (t: Int)              { if (isLoaded) try { nativeGrooveCopyPattern(t) }                          catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun groovePastePattern     (t: Int)              { if (isLoaded) try { nativeGroovePastePattern(t) }                         catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Phase 3: Groove — Undo / Redo ────────────────────────────────────────

    @JavascriptInterface fun grooveUndo(): Boolean    { if (!isLoaded) return false; return try { nativeGrooveUndo() }    catch (e: Exception) { false } }
    @JavascriptInterface fun grooveRedo(): Boolean    { if (!isLoaded) return false; return try { nativeGrooveRedo() }    catch (e: Exception) { false } }
    @JavascriptInterface fun grooveCanUndo(): Boolean { if (!isLoaded) return false; return try { nativeGrooveCanUndo() } catch (e: Exception) { false } }
    @JavascriptInterface fun grooveCanRedo(): Boolean { if (!isLoaded) return false; return try { nativeGrooveCanRedo() } catch (e: Exception) { false } }

    // ── Phase 3: Groove — Track ───────────────────────────────────────────────

    @JavascriptInterface fun grooveSetTrackMute   (t: Int, m: Boolean) { if (isLoaded) try { nativeGrooveSetTrackMute(t, m) }                        catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetTrackSolo   (t: Int, s: Boolean) { if (isLoaded) try { nativeGrooveSetTrackSolo(t, s) }                        catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetTrackVolume (t: Int, v: Int)     { if (isLoaded) try { nativeGrooveSetTrackVolume(t, v.coerceIn(0,127)) }       catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetTrackSample (t: Int, id: Int)    { if (isLoaded) try { nativeGrooveSetTrackSample(t, id) }                      catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveSetTrackMode   (t: Int, mode: Int)  { if (isLoaded) try { nativeGrooveSetTrackMode(t, mode) }                      catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Phase 3: Groove — Scene ───────────────────────────────────────────────

    @JavascriptInterface fun grooveQueueSceneChange(scene: Int) { if (isLoaded) try { nativeGrooveQueueSceneChange(scene) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Phase 3: Groove — Piano Roll ──────────────────────────────────────────

    @JavascriptInterface
    fun grooveAddPianoRollNote(track: Int, startTick: Long, endTick: Long, note: Int, vel: Int) {
        if (!isLoaded) return
        try { nativeGrooveAddPianoRollNote(track, startTick, endTick, note.coerceIn(0,127), vel.coerceIn(0,127)) }
        catch (e: Exception) { Log.e(tag, "grooveAddPianoRollNote: ${e.message}") }
    }

    @JavascriptInterface fun grooveRemovePianoRollNote(t: Int, idx: Int) { if (isLoaded) try { nativeGrooveRemovePianoRollNote(t, idx) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun grooveClearPianoRoll     (t: Int)           { if (isLoaded) try { nativeGrooveClearPianoRoll(t) }           catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Phase 3: Groove — Query ───────────────────────────────────────────────

    @JavascriptInterface fun grooveActiveVoices(): Int     { if (!isLoaded) return 0;     return try { nativeGrooveActiveVoices() } catch (e: Exception) { 0 } }
    @JavascriptInterface fun grooveCurrentStep(t: Int): Int { if (!isLoaded) return 0;   return try { nativeGrooveCurrentStep(t) }  catch (e: Exception) { 0 } }
    @JavascriptInterface fun grooveActiveScene(): Int      { if (!isLoaded) return 0;     return try { nativeGrooveActiveScene() }  catch (e: Exception) { 0 } }
    @JavascriptInterface fun grooveIsPlaying(): Boolean    { if (!isLoaded) return false; return try { nativeGrooveIsPlaying() }    catch (e: Exception) { false } }

    // ═══════════════════════════════════════════════════════════════════════════
    // JNI declarations — Phase 1 + 2
    // ═══════════════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════════════
    // JNI declarations — Phase 3: Groove
    // ═══════════════════════════════════════════════════════════════════════════

    private external fun nativeGrooveSetStep(t: Int, s: Int, a: Boolean, vel: Int, note: Int)
    private external fun nativeGrooveSetStepVelocity(t: Int, s: Int, vel: Int)
    private external fun nativeGrooveSetStepNote(t: Int, s: Int, note: Int)
    private external fun nativeGrooveSetStepProbability(t: Int, s: Int, prob: Int)
    private external fun nativeGrooveSetStepMuted(t: Int, s: Int, m: Boolean)
    private external fun nativeGrooveSetStepAccent(t: Int, s: Int, a: Boolean)
    private external fun nativeGrooveSetStepRoll(t: Int, s: Int, count: Int)
    private external fun nativeGrooveSetStepFlam(t: Int, s: Int, f: Boolean)
    private external fun nativeGrooveSetStepMicroTiming(t: Int, s: Int, ticks: Int)
    private external fun nativeGrooveSetPatternLength(t: Int, len: Int)
    private external fun nativeGrooveSetSwing(t: Int, swing: Int)
    private external fun nativeGrooveSetHumanize(t: Int, h: Int)
    private external fun nativeGrooveClearPattern(t: Int)
    private external fun nativeGrooveCopyPattern(t: Int)
    private external fun nativeGroovePastePattern(t: Int)
    private external fun nativeGrooveUndo(): Boolean
    private external fun nativeGrooveRedo(): Boolean
    private external fun nativeGrooveCanUndo(): Boolean
    private external fun nativeGrooveCanRedo(): Boolean
    private external fun nativeGrooveSetTrackMute(t: Int, m: Boolean)
    private external fun nativeGrooveSetTrackSolo(t: Int, s: Boolean)
    private external fun nativeGrooveSetTrackVolume(t: Int, v: Int)
    private external fun nativeGrooveSetTrackSample(t: Int, id: Int)
    private external fun nativeGrooveSetTrackMode(t: Int, mode: Int)
    private external fun nativeGrooveQueueSceneChange(scene: Int)
    private external fun nativeGrooveAddPianoRollNote(t: Int, start: Long, end: Long, note: Int, vel: Int)
    private external fun nativeGrooveRemovePianoRollNote(t: Int, idx: Int)
    private external fun nativeGrooveClearPianoRoll(t: Int)
    private external fun nativeGrooveActiveVoices(): Int
    private external fun nativeGrooveCurrentStep(t: Int): Int
    private external fun nativeGrooveActiveScene(): Int
    private external fun nativeGrooveIsPlaying(): Boolean
}
