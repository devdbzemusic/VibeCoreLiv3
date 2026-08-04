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
    // PHASE 5 — BASS
    // Waveform: 0=Sine 1=Triangle 2=Saw 3=ReverseSaw 4=Square 5=Pulse25
    // VoiceMode: 0=Mono 1=Legato 2=Poly4 3=Poly8
    // FilterType: 0=LP 1=HP 2=BP 3=Notch
    // LFOShape: 0=Sine 1=Tri 2=Saw 3=Square 4=S&H
    // LFOSync: 0=Free 1=Beat 2=Bar
    // ModSource: 0=Env1 1=Env2 2=LFO1 3=LFO2 4=Vel 5=Key 255=None
    // ModDest: 0=Pitch 1=Cutoff 2=Res 3=Morph 4=Vol 5=Width 6=Glide 7=Drive 255=None
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Oscillator ────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetWaveform(w: Int)      { if (!isLoaded) return; try { nativeBassSetWaveform(w) }    catch (e: Exception) {} }
    @JavascriptInterface fun bassSetMorphPos(pos: Float)  { if (!isLoaded) return; try { nativeBassSetMorphPos(pos) } catch (e: Exception) {} }
    @JavascriptInterface fun bassSetDetune(cents: Float)  { if (!isLoaded) return; try { nativeBassSetDetune(cents) } catch (e: Exception) {} }
    @JavascriptInterface fun bassSetOctave(oct: Float)    { if (!isLoaded) return; try { nativeBassSetOctave(oct) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetSemi(semi: Float)     { if (!isLoaded) return; try { nativeBassSetSemi(semi) }   catch (e: Exception) {} }
    @JavascriptInterface fun bassSetFine(cents: Float)    { if (!isLoaded) return; try { nativeBassSetFine(cents) }  catch (e: Exception) {} }

    // ── Voice ─────────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetVoiceMode(mode: Int)  { if (!isLoaded) return; try { nativeBassSetVoiceMode(mode) } catch (e: Exception) {} }
    @JavascriptInterface fun bassSetGlideMs(ms: Float)    { if (!isLoaded) return; try { nativeBassSetGlideMs(ms) }    catch (e: Exception) {} }
    @JavascriptInterface fun bassSetVolume(vol: Float)    { if (!isLoaded) return; try { nativeBassSetVolume(vol) }    catch (e: Exception) {} }
    @JavascriptInterface fun bassSetPan(pan: Float)       { if (!isLoaded) return; try { nativeBassSetPan(pan) }       catch (e: Exception) {} }

    // ── Filter ────────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetFilterType(t: Int)    { if (!isLoaded) return; try { nativeBassSetFilterType(t) }   catch (e: Exception) {} }
    @JavascriptInterface fun bassSetCutoff(hz: Float)     { if (!isLoaded) return; try { nativeBassSetCutoff(hz) }      catch (e: Exception) {} }
    @JavascriptInterface fun bassSetResonance(q: Float)   { if (!isLoaded) return; try { nativeBassSetResonance(q) }    catch (e: Exception) {} }
    @JavascriptInterface fun bassSetFilterDrive(d: Float) { if (!isLoaded) return; try { nativeBassSetFilterDrive(d) }  catch (e: Exception) {} }

    // ── Envelope 0 (Amp) ──────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetEnv0Attack (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv0Attack(ms) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv0Decay  (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv0Decay(ms) }   catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv0Sustain(s:  Float) { if (!isLoaded) return; try { nativeBassSetEnv0Sustain(s) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv0Release(ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv0Release(ms) } catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv0VelAmt (a:  Float) { if (!isLoaded) return; try { nativeBassSetEnv0VelAmt(a) }   catch (e: Exception) {} }

    // ── Envelope 1 (Mod) ──────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetEnv1Attack (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv1Attack(ms) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv1Decay  (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv1Decay(ms) }   catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv1Sustain(s:  Float) { if (!isLoaded) return; try { nativeBassSetEnv1Sustain(s) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv1Release(ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv1Release(ms) } catch (e: Exception) {} }
    @JavascriptInterface fun bassSetEnv1VelAmt (a:  Float) { if (!isLoaded) return; try { nativeBassSetEnv1VelAmt(a) }   catch (e: Exception) {} }

    // ── LFO 0 ─────────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetLFO0Shape (s: Int)     { if (!isLoaded) return; try { nativeBassSetLFO0Shape(s) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO0Rate  (hz: Float)  { if (!isLoaded) return; try { nativeBassSetLFO0Rate(hz) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO0Depth (d: Float)   { if (!isLoaded) return; try { nativeBassSetLFO0Depth(d) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO0Sync  (s: Int)     { if (!isLoaded) return; try { nativeBassSetLFO0Sync(s) }   catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO0Retrig(r: Boolean) { if (!isLoaded) return; try { nativeBassSetLFO0Retrig(r) } catch (e: Exception) {} }

    // ── LFO 1 ─────────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetLFO1Shape (s: Int)     { if (!isLoaded) return; try { nativeBassSetLFO1Shape(s) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO1Rate  (hz: Float)  { if (!isLoaded) return; try { nativeBassSetLFO1Rate(hz) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO1Depth (d: Float)   { if (!isLoaded) return; try { nativeBassSetLFO1Depth(d) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO1Sync  (s: Int)     { if (!isLoaded) return; try { nativeBassSetLFO1Sync(s) }   catch (e: Exception) {} }
    @JavascriptInterface fun bassSetLFO1Retrig(r: Boolean) { if (!isLoaded) return; try { nativeBassSetLFO1Retrig(r) } catch (e: Exception) {} }

    // ── Modulation matrix ─────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetModRoute(idx: Int, src: Int, dst: Int, amt: Float, active: Boolean) {
        if (!isLoaded) return; try { nativeBassSetModRoute(idx, src, dst, amt, active) } catch (e: Exception) {}
    }
    @JavascriptInterface fun bassClearModRoutes() { if (!isLoaded) return; try { nativeBassClearModRoutes() } catch (e: Exception) {} }

    // ── 3D Stereo ─────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassSetStereoWidth   (w: Float)    { if (!isLoaded) return; try { nativeBassSetStereoWidth(w) }    catch (e: Exception) {} }
    @JavascriptInterface fun bassSetStereoMidGain (g: Float)    { if (!isLoaded) return; try { nativeBassSetStereoMidGain(g) }  catch (e: Exception) {} }
    @JavascriptInterface fun bassSetStereoSideGain(g: Float)    { if (!isLoaded) return; try { nativeBassSetStereoSideGain(g) } catch (e: Exception) {} }
    @JavascriptInterface fun bassSetStereoEnabled (en: Boolean) { if (!isLoaded) return; try { nativeBassSetStereoEnabled(en) } catch (e: Exception) {} }

    // ── Triggers ──────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassNoteOn(note: Int, vel: Int) { if (!isLoaded) return; try { nativeBassNoteOn(note, vel) } catch (e: Exception) {} }
    @JavascriptInterface fun bassNoteOff(note: Int)          { if (!isLoaded) return; try { nativeBassNoteOff(note) }     catch (e: Exception) {} }
    @JavascriptInterface fun bassAllNotesOff()               { if (!isLoaded) return; try { nativeBassAllNotesOff() }     catch (e: Exception) {} }

    // ── Undo / Redo ───────────────────────────────────────────────────────────
    @JavascriptInterface fun bassUndo():    Boolean { if (!isLoaded) return false; return try { nativeBassUndo() }    catch (e: Exception) { false } }
    @JavascriptInterface fun bassRedo():    Boolean { if (!isLoaded) return false; return try { nativeBassRedo() }    catch (e: Exception) { false } }
    @JavascriptInterface fun bassCanUndo(): Boolean { if (!isLoaded) return false; return try { nativeBassCanUndo() } catch (e: Exception) { false } }
    @JavascriptInterface fun bassCanRedo(): Boolean { if (!isLoaded) return false; return try { nativeBassCanRedo() } catch (e: Exception) { false } }

    // ── Query ─────────────────────────────────────────────────────────────────
    @JavascriptInterface fun bassActiveVoices(): Int   { if (!isLoaded) return 0;     return try { nativeBassActiveVoices() } catch (e: Exception) { 0 } }
    @JavascriptInterface fun bassOutputLevel():  Float { if (!isLoaded) return 0f;    return try { nativeBassOutputLevel() }  catch (e: Exception) { 0f } }
    @JavascriptInterface fun bassIsPlaying():  Boolean { if (!isLoaded) return false; return try { nativeBassIsPlaying() }    catch (e: Exception) { false } }

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

    // ═══════════════════════════════════════════════════════════════════════════
    // JNI declarations — Phase 5: Bass
    // ═══════════════════════════════════════════════════════════════════════════

    private external fun nativeBassSetWaveform(w: Int)
    private external fun nativeBassSetMorphPos(pos: Float)
    private external fun nativeBassSetDetune(cents: Float)
    private external fun nativeBassSetOctave(oct: Float)
    private external fun nativeBassSetSemi(semi: Float)
    private external fun nativeBassSetFine(cents: Float)
    private external fun nativeBassSetVoiceMode(mode: Int)
    private external fun nativeBassSetGlideMs(ms: Float)
    private external fun nativeBassSetVolume(vol: Float)
    private external fun nativeBassSetPan(pan: Float)
    private external fun nativeBassSetFilterType(type: Int)
    private external fun nativeBassSetCutoff(hz: Float)
    private external fun nativeBassSetResonance(q: Float)
    private external fun nativeBassSetFilterDrive(d: Float)
    private external fun nativeBassSetEnv0Attack(ms: Float)
    private external fun nativeBassSetEnv0Decay(ms: Float)
    private external fun nativeBassSetEnv0Sustain(s: Float)
    private external fun nativeBassSetEnv0Release(ms: Float)
    private external fun nativeBassSetEnv0VelAmt(a: Float)
    private external fun nativeBassSetEnv1Attack(ms: Float)
    private external fun nativeBassSetEnv1Decay(ms: Float)
    private external fun nativeBassSetEnv1Sustain(s: Float)
    private external fun nativeBassSetEnv1Release(ms: Float)
    private external fun nativeBassSetEnv1VelAmt(a: Float)
    private external fun nativeBassSetLFO0Shape(s: Int)
    private external fun nativeBassSetLFO0Rate(hz: Float)
    private external fun nativeBassSetLFO0Depth(d: Float)
    private external fun nativeBassSetLFO0Sync(sync: Int)
    private external fun nativeBassSetLFO0Retrig(r: Boolean)
    private external fun nativeBassSetLFO1Shape(s: Int)
    private external fun nativeBassSetLFO1Rate(hz: Float)
    private external fun nativeBassSetLFO1Depth(d: Float)
    private external fun nativeBassSetLFO1Sync(sync: Int)
    private external fun nativeBassSetLFO1Retrig(r: Boolean)
    private external fun nativeBassSetModRoute(idx: Int, src: Int, dst: Int, amt: Float, active: Boolean)
    private external fun nativeBassClearModRoutes()
    private external fun nativeBassSetStereoWidth(w: Float)
    private external fun nativeBassSetStereoMidGain(g: Float)
    private external fun nativeBassSetStereoSideGain(g: Float)
    private external fun nativeBassSetStereoEnabled(en: Boolean)
    private external fun nativeBassNoteOn(note: Int, velocity: Int)
    private external fun nativeBassNoteOff(note: Int)
    private external fun nativeBassAllNotesOff()
    private external fun nativeBassUndo(): Boolean
    private external fun nativeBassRedo(): Boolean
    private external fun nativeBassCanUndo(): Boolean
    private external fun nativeBassCanRedo(): Boolean
    private external fun nativeBassActiveVoices(): Int
    private external fun nativeBassOutputLevel(): Float
    private external fun nativeBassIsPlaying(): Boolean

    // ═══════════════════════════════════════════════════════════════════════════
    // Phase 6 — Voice
    // ═══════════════════════════════════════════════════════════════════════════

    // ── Mode ──────────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetGlobalMode(m: Int) { if (isLoaded) try { nativeVoiceSetGlobalMode(m) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetPolyMode(m: Int) { if (isLoaded) try { nativeVoiceSetPolyMode(m) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetPlayMode(m: Int) { if (isLoaded) try { nativeVoiceSetPlayMode(m) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Master ────────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetVolume(v: Float) { if (isLoaded) try { nativeVoiceSetVolume(v) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetDryWet(v: Float) { if (isLoaded) try { nativeVoiceSetDryWet(v) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetMonitor(v: Float) { if (isLoaded) try { nativeVoiceSetMonitor(v) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetGlideMs(ms: Float) { if (isLoaded) try { nativeVoiceSetGlideMs(ms) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetActiveSlot(slot: Int) { if (isLoaded) try { nativeVoiceSetActiveSlot(slot) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetRootNote(note: Int) { if (isLoaded) try { nativeVoiceSetRootNote(note) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Pitch / Formant ───────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetPitchSemitones(st: Float) { if (isLoaded) try { nativeVoiceSetPitchSemitones(st) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetPitchEnabled(e2: Boolean) { if (isLoaded) try { nativeVoiceSetPitchEnabled(e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetFormantSemitones(st: Float) { if (isLoaded) try { nativeVoiceSetFormantSemitones(st) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetFormantEnabled(e2: Boolean) { if (isLoaded) try { nativeVoiceSetFormantEnabled(e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Harmonizer / Doubler ──────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetHarmonyVoice(index: Int, semitones: Float, level: Float, pan: Float) { if (isLoaded) try { nativeVoiceSetHarmonyVoice(index, semitones, level, pan) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetHarmonyMaster(level: Float) { if (isLoaded) try { nativeVoiceSetHarmonyMaster(level) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetHarmonyEnabled(e2: Boolean) { if (isLoaded) try { nativeVoiceSetHarmonyEnabled(e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetDoubler(detuneCents: Float, level: Float, width: Float, e2: Boolean) { if (isLoaded) try { nativeVoiceSetDoubler(detuneCents, level, width, e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Dynamics ──────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetGate(thDb: Float, atkMs: Float, relMs: Float, e2: Boolean) { if (isLoaded) try { nativeVoiceSetGate(thDb, atkMs, relMs, e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetDeEsser(freqHz: Float, thDb: Float, amount: Float, e2: Boolean) { if (isLoaded) try { nativeVoiceSetDeEsser(freqHz, thDb, amount, e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetCompressor(thDb: Float, ratio: Float, atkMs: Float, relMs: Float, makeupDb: Float, e2: Boolean) { if (isLoaded) try { nativeVoiceSetCompressor(thDb, ratio, atkMs, relMs, makeupDb, e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetEQ(lowHz: Float, lowDb: Float, midHz: Float, midDb: Float, midQ: Float, highHz: Float, highDb: Float, e2: Boolean) { if (isLoaded) try { nativeVoiceSetEQ(lowHz, lowDb, midHz, midDb, midQ, highHz, highDb, e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Breath ────────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetBreath(level: Float, colorHz: Float, widthQ: Float, followEnv: Boolean, e2: Boolean) { if (isLoaded) try { nativeVoiceSetBreath(level, colorHz, widthQ, followEnv, e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Texture ───────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetTextureCutoff(hz: Float) { if (isLoaded) try { nativeVoiceSetTextureCutoff(hz) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetTextureResonance(q: Float) { if (isLoaded) try { nativeVoiceSetTextureResonance(q) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Envelopes / LFOs ──────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetEnv0(atk: Float, dec: Float, sus: Float, rel: Float, vel: Float) { if (isLoaded) try { nativeVoiceSetEnv0(atk, dec, sus, rel, vel) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetEnv1(atk: Float, dec: Float, sus: Float, rel: Float, vel: Float) { if (isLoaded) try { nativeVoiceSetEnv1(atk, dec, sus, rel, vel) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetLFO0(shape: Int, sync: Int, rateHz: Float, depth: Float, phase: Float, retrig: Boolean) { if (isLoaded) try { nativeVoiceSetLFO0(shape, sync, rateHz, depth, phase, retrig) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetLFO1(shape: Int, sync: Int, rateHz: Float, depth: Float, phase: Float, retrig: Boolean) { if (isLoaded) try { nativeVoiceSetLFO1(shape, sync, rateHz, depth, phase, retrig) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Macros / Mod matrix ───────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetMacro1(v: Float) { if (isLoaded) try { nativeVoiceSetMacro1(v) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetMacro2(v: Float) { if (isLoaded) try { nativeVoiceSetMacro2(v) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetModRoute(route: Int, src: Int, dest: Int, amount: Float, active: Boolean) { if (isLoaded) try { nativeVoiceSetModRoute(route, src, dest, amount, active) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceClearModRoutes() { if (isLoaded) try { nativeVoiceClearModRoutes() } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── 3D Stereo ─────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetStereoWidth(w: Float) { if (isLoaded) try { nativeVoiceSetStereoWidth(w) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetStereoMidGain(g: Float) { if (isLoaded) try { nativeVoiceSetStereoMidGain(g) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetStereoSideGain(g: Float) { if (isLoaded) try { nativeVoiceSetStereoSideGain(g) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetStereoPan(p: Float) { if (isLoaded) try { nativeVoiceSetStereoPan(p) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetStereoEnabled(e2: Boolean) { if (isLoaded) try { nativeVoiceSetStereoEnabled(e2) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Triggers ──────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceNoteOn(note: Int, velocity: Int, slot: Int, slice: Int) { if (isLoaded) try { nativeVoiceNoteOn(note, velocity, slot, slice) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceNoteOff(note: Int) { if (isLoaded) try { nativeVoiceNoteOff(note) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceAllNotesOff() { if (isLoaded) try { nativeVoiceAllNotesOff() } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Sample management ─────────────────────────────────────────────────────
    @JavascriptInterface fun voiceLoadSample(slot: Int, data: FloatArray, sampleRate: Int, rootNote: Int): Boolean { if (!isLoaded) return false; return try { nativeVoiceLoadSample(slot, data, sampleRate, rootNote) } catch (e: Exception) { Log.e(tag, e.message ?: ""); false } }
    @JavascriptInterface fun voiceClearSample(slot: Int) { if (isLoaded) try { nativeVoiceClearSample(slot) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }
    @JavascriptInterface fun voiceSetSliceMarkers(slot: Int, starts: IntArray) { if (isLoaded) try { nativeVoiceSetSliceMarkers(slot, starts) } catch (e: Exception) { Log.e(tag, e.message ?: "") } }

    // ── Live input ────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceSetLiveInputEnabled(enabled: Boolean): Boolean { if (!isLoaded) return false; return try { nativeVoiceSetLiveInputEnabled(enabled) } catch (e: Exception) { false } }
    @JavascriptInterface fun voiceLiveInputEnabled(): Boolean { if (!isLoaded) return false; return try { nativeVoiceLiveInputEnabled() } catch (e: Exception) { false } }

    // ── Undo / Redo ───────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceUndo(): Boolean { if (!isLoaded) return false; return try { nativeVoiceUndo() } catch (e: Exception) { false } }
    @JavascriptInterface fun voiceRedo(): Boolean { if (!isLoaded) return false; return try { nativeVoiceRedo() } catch (e: Exception) { false } }
    @JavascriptInterface fun voiceCanUndo(): Boolean { if (!isLoaded) return false; return try { nativeVoiceCanUndo() } catch (e: Exception) { false } }
    @JavascriptInterface fun voiceCanRedo(): Boolean { if (!isLoaded) return false; return try { nativeVoiceCanRedo() } catch (e: Exception) { false } }

    // ── Query ─────────────────────────────────────────────────────────────────
    @JavascriptInterface fun voiceActiveUnits(): Int { if (!isLoaded) return 0; return try { nativeVoiceActiveUnits() } catch (e: Exception) { 0 } }
    @JavascriptInterface fun voiceOutputLevel(): Float { if (!isLoaded) return 0f; return try { nativeVoiceOutputLevel() } catch (e: Exception) { 0f } }
    @JavascriptInterface fun voiceInputLevel(): Float { if (!isLoaded) return 0f; return try { nativeVoiceInputLevel() } catch (e: Exception) { 0f } }
    @JavascriptInterface fun voiceIsPlaying(): Boolean { if (!isLoaded) return false; return try { nativeVoiceIsPlaying() } catch (e: Exception) { false } }

    // ═══════════════════════════════════════════════════════════════════════════
    // JNI declarations — Phase 6 Voice
    // ═══════════════════════════════════════════════════════════════════════════

    private external fun nativeVoiceSetGlobalMode(m: Int)
    private external fun nativeVoiceSetPolyMode(m: Int)
    private external fun nativeVoiceSetPlayMode(m: Int)
    private external fun nativeVoiceSetVolume(v: Float)
    private external fun nativeVoiceSetDryWet(v: Float)
    private external fun nativeVoiceSetMonitor(v: Float)
    private external fun nativeVoiceSetGlideMs(ms: Float)
    private external fun nativeVoiceSetActiveSlot(slot: Int)
    private external fun nativeVoiceSetRootNote(note: Int)
    private external fun nativeVoiceSetPitchSemitones(st: Float)
    private external fun nativeVoiceSetPitchEnabled(e: Boolean)
    private external fun nativeVoiceSetFormantSemitones(st: Float)
    private external fun nativeVoiceSetFormantEnabled(e: Boolean)
    private external fun nativeVoiceSetHarmonyVoice(index: Int, semitones: Float, level: Float, pan: Float)
    private external fun nativeVoiceSetHarmonyMaster(level: Float)
    private external fun nativeVoiceSetHarmonyEnabled(e: Boolean)
    private external fun nativeVoiceSetDoubler(detuneCents: Float, level: Float, width: Float, e: Boolean)
    private external fun nativeVoiceSetGate(thDb: Float, atkMs: Float, relMs: Float, e: Boolean)
    private external fun nativeVoiceSetDeEsser(freqHz: Float, thDb: Float, amount: Float, e: Boolean)
    private external fun nativeVoiceSetCompressor(thDb: Float, ratio: Float, atkMs: Float, relMs: Float, makeupDb: Float, e: Boolean)
    private external fun nativeVoiceSetEQ(lowHz: Float, lowDb: Float, midHz: Float, midDb: Float, midQ: Float, highHz: Float, highDb: Float, e: Boolean)
    private external fun nativeVoiceSetBreath(level: Float, colorHz: Float, widthQ: Float, followEnv: Boolean, e: Boolean)
    private external fun nativeVoiceSetTextureCutoff(hz: Float)
    private external fun nativeVoiceSetTextureResonance(q: Float)
    private external fun nativeVoiceSetEnv0(atk: Float, dec: Float, sus: Float, rel: Float, vel: Float)
    private external fun nativeVoiceSetEnv1(atk: Float, dec: Float, sus: Float, rel: Float, vel: Float)
    private external fun nativeVoiceSetLFO0(shape: Int, sync: Int, rateHz: Float, depth: Float, phase: Float, retrig: Boolean)
    private external fun nativeVoiceSetLFO1(shape: Int, sync: Int, rateHz: Float, depth: Float, phase: Float, retrig: Boolean)
    private external fun nativeVoiceSetMacro1(v: Float)
    private external fun nativeVoiceSetMacro2(v: Float)
    private external fun nativeVoiceSetModRoute(route: Int, src: Int, dest: Int, amount: Float, active: Boolean)
    private external fun nativeVoiceClearModRoutes()
    private external fun nativeVoiceSetStereoWidth(w: Float)
    private external fun nativeVoiceSetStereoMidGain(g: Float)
    private external fun nativeVoiceSetStereoSideGain(g: Float)
    private external fun nativeVoiceSetStereoPan(p: Float)
    private external fun nativeVoiceSetStereoEnabled(e: Boolean)
    private external fun nativeVoiceNoteOn(note: Int, velocity: Int, slot: Int, slice: Int)
    private external fun nativeVoiceNoteOff(note: Int)
    private external fun nativeVoiceAllNotesOff()
    private external fun nativeVoiceLoadSample(slot: Int, data: FloatArray, sampleRate: Int, rootNote: Int): Boolean
    private external fun nativeVoiceClearSample(slot: Int)
    private external fun nativeVoiceSetSliceMarkers(slot: Int, starts: IntArray)
    private external fun nativeVoiceSetLiveInputEnabled(enabled: Boolean): Boolean
    private external fun nativeVoiceLiveInputEnabled(): Boolean
    private external fun nativeVoiceUndo(): Boolean
    private external fun nativeVoiceRedo(): Boolean
    private external fun nativeVoiceCanUndo(): Boolean
    private external fun nativeVoiceCanRedo(): Boolean
    private external fun nativeVoiceActiveUnits(): Int
    private external fun nativeVoiceOutputLevel(): Float
    private external fun nativeVoiceInputLevel(): Float
    private external fun nativeVoiceIsPlaying(): Boolean
}
