package com.vibecore.audio

/**
 * NativeAudioBridgeBass.kt — Bass extension functions for NativeAudioBridge.
 *
 * These are declared as extension functions on NativeAudioBridge so they share
 * the same @JavascriptInterface context and can be called from WebView JS as:
 *   AudioBridge.bassNoteOn(60, 100)
 *   AudioBridge.bassSetCutoff(2000.0)
 *   etc.
 *
 * All methods follow the same guard pattern as the base bridge:
 *   - Check isLoaded before calling native
 *   - Wrap in try/catch for JNI safety
 *
 * Waveform int mapping (matches BassWaveform enum):
 *   0=Sine, 1=Triangle, 2=Saw, 3=ReverseSaw, 4=Square, 5=Pulse25, 6=Custom0, 7=Custom1
 *
 * VoiceMode int mapping (matches BassVoiceMode enum):
 *   0=Mono, 1=Legato, 2=Poly4, 3=Poly8
 *
 * FilterType int mapping (matches BassFilterType enum):
 *   0=Lowpass, 1=Highpass, 2=Bandpass, 3=Notch
 *
 * LFOShape int mapping (matches BassLFOShape enum):
 *   0=Sine, 1=Triangle, 2=Saw, 3=Square, 4=SampleHold
 *
 * LFOSync int mapping (matches BassLFOSync enum):
 *   0=Free, 1=Beat, 2=Bar
 *
 * ModSource int mapping (matches BassModSource enum):
 *   0=Env1, 1=Env2, 2=LFO1, 3=LFO2, 4=Velocity, 5=KeyTracking, 6=ModWheel, 7=Aftertouch, 255=None
 *
 * ModDest int mapping (matches BassModDest enum):
 *   0=Pitch, 1=Cutoff, 2=Resonance, 3=WavePos, 4=Volume, 5=StereoWidth, 6=Glide, 7=FilterDrive, 255=None
 *
 * Phase 5 — VibeCore 3D Bass
 */

import android.webkit.JavascriptInterface

// ─── Oscillator ────────────────────────────────────────────────────────────────

@JavascriptInterface
fun NativeAudioBridge.bassSetWaveform(waveform: Int) {
    if (!isLoaded) return
    try { nativeBassSetWaveform(waveform) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetMorphPos(pos: Float) {
    if (!isLoaded) return
    try { nativeBassSetMorphPos(pos) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetDetune(cents: Float) {
    if (!isLoaded) return
    try { nativeBassSetDetune(cents) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetOctave(octave: Float) {
    if (!isLoaded) return
    try { nativeBassSetOctave(octave) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetSemi(semi: Float) {
    if (!isLoaded) return
    try { nativeBassSetSemi(semi) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetFine(cents: Float) {
    if (!isLoaded) return
    try { nativeBassSetFine(cents) } catch (_: Exception) {}
}

// ─── Voice ────────────────────────────────────────────────────────────────────

@JavascriptInterface
fun NativeAudioBridge.bassSetVoiceMode(mode: Int) {
    if (!isLoaded) return
    try { nativeBassSetVoiceMode(mode) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetGlideMs(ms: Float) {
    if (!isLoaded) return
    try { nativeBassSetGlideMs(ms) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetVolume(vol: Float) {
    if (!isLoaded) return
    try { nativeBassSetVolume(vol) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetPan(pan: Float) {
    if (!isLoaded) return
    try { nativeBassSetPan(pan) } catch (_: Exception) {}
}

// ─── Filter ───────────────────────────────────────────────────────────────────

@JavascriptInterface
fun NativeAudioBridge.bassSetFilterType(type: Int) {
    if (!isLoaded) return
    try { nativeBassSetFilterType(type) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetCutoff(hz: Float) {
    if (!isLoaded) return
    try { nativeBassSetCutoff(hz) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetResonance(q: Float) {
    if (!isLoaded) return
    try { nativeBassSetResonance(q) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassSetFilterDrive(drive: Float) {
    if (!isLoaded) return
    try { nativeBassSetFilterDrive(drive) } catch (_: Exception) {}
}

// ─── Envelope 0 (Amp) ────────────────────────────────────────────────────────

@JavascriptInterface fun NativeAudioBridge.bassSetEnv0Attack (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv0Attack(ms)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv0Decay  (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv0Decay(ms)   } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv0Sustain(s:  Float) { if (!isLoaded) return; try { nativeBassSetEnv0Sustain(s)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv0Release(ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv0Release(ms) } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv0VelAmt (a:  Float) { if (!isLoaded) return; try { nativeBassSetEnv0VelAmt(a)   } catch (_: Exception) {} }

// ─── Envelope 1 (Mod) ────────────────────────────────────────────────────────

@JavascriptInterface fun NativeAudioBridge.bassSetEnv1Attack (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv1Attack(ms)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv1Decay  (ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv1Decay(ms)   } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv1Sustain(s:  Float) { if (!isLoaded) return; try { nativeBassSetEnv1Sustain(s)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv1Release(ms: Float) { if (!isLoaded) return; try { nativeBassSetEnv1Release(ms) } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetEnv1VelAmt (a:  Float) { if (!isLoaded) return; try { nativeBassSetEnv1VelAmt(a)   } catch (_: Exception) {} }

// ─── LFO 0 ───────────────────────────────────────────────────────────────────

@JavascriptInterface fun NativeAudioBridge.bassSetLFO0Shape (s:    Int)     { if (!isLoaded) return; try { nativeBassSetLFO0Shape(s)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO0Rate  (hz:   Float)   { if (!isLoaded) return; try { nativeBassSetLFO0Rate(hz)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO0Depth (d:    Float)   { if (!isLoaded) return; try { nativeBassSetLFO0Depth(d)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO0Sync  (sync: Int)     { if (!isLoaded) return; try { nativeBassSetLFO0Sync(sync)} catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO0Retrig(r:    Boolean) { if (!isLoaded) return; try { nativeBassSetLFO0Retrig(r) } catch (_: Exception) {} }

// ─── LFO 1 ───────────────────────────────────────────────────────────────────

@JavascriptInterface fun NativeAudioBridge.bassSetLFO1Shape (s:    Int)     { if (!isLoaded) return; try { nativeBassSetLFO1Shape(s)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO1Rate  (hz:   Float)   { if (!isLoaded) return; try { nativeBassSetLFO1Rate(hz)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO1Depth (d:    Float)   { if (!isLoaded) return; try { nativeBassSetLFO1Depth(d)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO1Sync  (sync: Int)     { if (!isLoaded) return; try { nativeBassSetLFO1Sync(sync)} catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetLFO1Retrig(r:    Boolean) { if (!isLoaded) return; try { nativeBassSetLFO1Retrig(r) } catch (_: Exception) {} }

// ─── Modulation matrix ────────────────────────────────────────────────────────

@JavascriptInterface
fun NativeAudioBridge.bassSetModRoute(routeIdx: Int, src: Int, dst: Int,
                                       amount: Float, active: Boolean) {
    if (!isLoaded) return
    try { nativeBassSetModRoute(routeIdx, src, dst, amount, active) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassClearModRoutes() {
    if (!isLoaded) return
    try { nativeBassClearModRoutes() } catch (_: Exception) {}
}

// ─── 3D Stereo ────────────────────────────────────────────────────────────────

@JavascriptInterface fun NativeAudioBridge.bassSetStereoWidth   (w: Float)   { if (!isLoaded) return; try { nativeBassSetStereoWidth(w)    } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetStereoMidGain (g: Float)   { if (!isLoaded) return; try { nativeBassSetStereoMidGain(g)  } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetStereoSideGain(g: Float)   { if (!isLoaded) return; try { nativeBassSetStereoSideGain(g) } catch (_: Exception) {} }
@JavascriptInterface fun NativeAudioBridge.bassSetStereoEnabled (en: Boolean){ if (!isLoaded) return; try { nativeBassSetStereoEnabled(en)  } catch (_: Exception) {} }

// ─── Triggers ─────────────────────────────────────────────────────────────────

@JavascriptInterface
fun NativeAudioBridge.bassNoteOn(note: Int, velocity: Int) {
    if (!isLoaded) return
    try { nativeBassNoteOn(note, velocity) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassNoteOff(note: Int) {
    if (!isLoaded) return
    try { nativeBassNoteOff(note) } catch (_: Exception) {}
}

@JavascriptInterface
fun NativeAudioBridge.bassAllNotesOff() {
    if (!isLoaded) return
    try { nativeBassAllNotesOff() } catch (_: Exception) {}
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

@JavascriptInterface fun NativeAudioBridge.bassUndo():    Boolean { if (!isLoaded) return false; return try { nativeBassUndo()    } catch (_: Exception) { false } }
@JavascriptInterface fun NativeAudioBridge.bassRedo():    Boolean { if (!isLoaded) return false; return try { nativeBassRedo()    } catch (_: Exception) { false } }
@JavascriptInterface fun NativeAudioBridge.bassCanUndo(): Boolean { if (!isLoaded) return false; return try { nativeBassCanUndo() } catch (_: Exception) { false } }
@JavascriptInterface fun NativeAudioBridge.bassCanRedo(): Boolean { if (!isLoaded) return false; return try { nativeBassCanRedo() } catch (_: Exception) { false } }

// ─── Query ────────────────────────────────────────────────────────────────────

@JavascriptInterface fun NativeAudioBridge.bassActiveVoices(): Int   { if (!isLoaded) return 0;    return try { nativeBassActiveVoices() } catch (_: Exception) { 0 } }
@JavascriptInterface fun NativeAudioBridge.bassOutputLevel():  Float { if (!isLoaded) return 0f;   return try { nativeBassOutputLevel()  } catch (_: Exception) { 0f } }
@JavascriptInterface fun NativeAudioBridge.bassIsPlaying():  Boolean { if (!isLoaded) return false; return try { nativeBassIsPlaying()   } catch (_: Exception) { false } }

// ─── JNI declarations — Phase 5: Bass ────────────────────────────────────────

private external fun NativeAudioBridge.nativeBassSetWaveform(w: Int)
private external fun NativeAudioBridge.nativeBassSetMorphPos(pos: Float)
private external fun NativeAudioBridge.nativeBassSetDetune(cents: Float)
private external fun NativeAudioBridge.nativeBassSetOctave(oct: Float)
private external fun NativeAudioBridge.nativeBassSetSemi(semi: Float)
private external fun NativeAudioBridge.nativeBassSetFine(cents: Float)
private external fun NativeAudioBridge.nativeBassSetVoiceMode(mode: Int)
private external fun NativeAudioBridge.nativeBassSetGlideMs(ms: Float)
private external fun NativeAudioBridge.nativeBassSetVolume(vol: Float)
private external fun NativeAudioBridge.nativeBassSetPan(pan: Float)
private external fun NativeAudioBridge.nativeBassSetFilterType(type: Int)
private external fun NativeAudioBridge.nativeBassSetCutoff(hz: Float)
private external fun NativeAudioBridge.nativeBassSetResonance(q: Float)
private external fun NativeAudioBridge.nativeBassSetFilterDrive(d: Float)
private external fun NativeAudioBridge.nativeBassSetEnv0Attack(ms: Float)
private external fun NativeAudioBridge.nativeBassSetEnv0Decay(ms: Float)
private external fun NativeAudioBridge.nativeBassSetEnv0Sustain(s: Float)
private external fun NativeAudioBridge.nativeBassSetEnv0Release(ms: Float)
private external fun NativeAudioBridge.nativeBassSetEnv0VelAmt(a: Float)
private external fun NativeAudioBridge.nativeBassSetEnv1Attack(ms: Float)
private external fun NativeAudioBridge.nativeBassSetEnv1Decay(ms: Float)
private external fun NativeAudioBridge.nativeBassSetEnv1Sustain(s: Float)
private external fun NativeAudioBridge.nativeBassSetEnv1Release(ms: Float)
private external fun NativeAudioBridge.nativeBassSetEnv1VelAmt(a: Float)
private external fun NativeAudioBridge.nativeBassSetLFO0Shape(s: Int)
private external fun NativeAudioBridge.nativeBassSetLFO0Rate(hz: Float)
private external fun NativeAudioBridge.nativeBassSetLFO0Depth(d: Float)
private external fun NativeAudioBridge.nativeBassSetLFO0Sync(sync: Int)
private external fun NativeAudioBridge.nativeBassSetLFO0Retrig(r: Boolean)
private external fun NativeAudioBridge.nativeBassSetLFO1Shape(s: Int)
private external fun NativeAudioBridge.nativeBassSetLFO1Rate(hz: Float)
private external fun NativeAudioBridge.nativeBassSetLFO1Depth(d: Float)
private external fun NativeAudioBridge.nativeBassSetLFO1Sync(sync: Int)
private external fun NativeAudioBridge.nativeBassSetLFO1Retrig(r: Boolean)
private external fun NativeAudioBridge.nativeBassSetModRoute(idx: Int, src: Int, dst: Int, amount: Float, active: Boolean)
private external fun NativeAudioBridge.nativeBassClearModRoutes()
private external fun NativeAudioBridge.nativeBassSetStereoWidth(w: Float)
private external fun NativeAudioBridge.nativeBassSetStereoMidGain(g: Float)
private external fun NativeAudioBridge.nativeBassSetStereoSideGain(g: Float)
private external fun NativeAudioBridge.nativeBassSetStereoEnabled(en: Boolean)
private external fun NativeAudioBridge.nativeBassNoteOn(note: Int, velocity: Int)
private external fun NativeAudioBridge.nativeBassNoteOff(note: Int)
private external fun NativeAudioBridge.nativeBassAllNotesOff()
private external fun NativeAudioBridge.nativeBassUndo(): Boolean
private external fun NativeAudioBridge.nativeBassRedo(): Boolean
private external fun NativeAudioBridge.nativeBassCanUndo(): Boolean
private external fun NativeAudioBridge.nativeBassCanRedo(): Boolean
private external fun NativeAudioBridge.nativeBassActiveVoices(): Int
private external fun NativeAudioBridge.nativeBassOutputLevel(): Float
private external fun NativeAudioBridge.nativeBassIsPlaying(): Boolean
