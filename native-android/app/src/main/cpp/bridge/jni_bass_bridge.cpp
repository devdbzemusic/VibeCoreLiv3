/**
 * jni_bass_bridge.cpp — JNI marshalling for VibeCore 3D Bass (Phase 5).
 *
 * Included at the end of jni_bridge.cpp via #include, or compiled separately.
 * All functions follow the Java_com_vibecore_audio_NativeAudioBridge_nativeBass* pattern.
 *
 * Bridge contract (ADR-005): NO business logic. Marshalling only.
 * All calls go through bass() → BassEngine → BassNode command queue.
 */

// ─── NOTE: This file is #included from jni_bridge.cpp ────────────────────────
// It uses the bass() helper defined there. Do not compile independently.

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — BASS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Oscillator ─────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetWaveform(JNIEnv*, jobject, jint w) {
    markUIThread();
    bass().setWaveform(static_cast<vibecore::BassWaveform>(w));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetMorphPos(JNIEnv*, jobject, jfloat pos) {
    markUIThread(); bass().setMorphPos(pos);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetDetune(JNIEnv*, jobject, jfloat cents) {
    markUIThread(); bass().setDetune(cents);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetOctave(JNIEnv*, jobject, jfloat oct) {
    markUIThread(); bass().setOctave(oct);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetSemi(JNIEnv*, jobject, jfloat semi) {
    markUIThread(); bass().setSemi(semi);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetFine(JNIEnv*, jobject, jfloat cents) {
    markUIThread(); bass().setFine(cents);
}

// ── Voice ──────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetVoiceMode(JNIEnv*, jobject, jint mode) {
    markUIThread();
    bass().setVoiceMode(static_cast<vibecore::BassVoiceMode>(mode));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetGlideMs(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); bass().setGlideMs(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetVolume(JNIEnv*, jobject, jfloat vol) {
    markUIThread(); bass().setVolume(vol);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetPan(JNIEnv*, jobject, jfloat pan) {
    markUIThread(); bass().setPan(pan);
}

// ── Filter ────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetFilterType(JNIEnv*, jobject, jint type) {
    markUIThread();
    bass().setFilterType(static_cast<vibecore::BassFilterType>(type));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetCutoff(JNIEnv*, jobject, jfloat hz) {
    markUIThread(); bass().setCutoff(hz);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetResonance(JNIEnv*, jobject, jfloat q) {
    markUIThread(); bass().setResonance(q);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetFilterDrive(JNIEnv*, jobject, jfloat d) {
    markUIThread(); bass().setFilterDrive(d);
}

// ── Envelope 0 (Amp) ──────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv0Attack(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); bass().setEnv0Attack(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv0Decay(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); bass().setEnv0Decay(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv0Sustain(JNIEnv*, jobject, jfloat s) {
    markUIThread(); bass().setEnv0Sustain(s);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv0Release(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); bass().setEnv0Release(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv0VelAmt(JNIEnv*, jobject, jfloat a) {
    markUIThread(); bass().setEnv0VelAmt(a);
}

// ── Envelope 1 (Mod) ──────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv1Attack(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); bass().setEnv1Attack(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv1Decay(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); bass().setEnv1Decay(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv1Sustain(JNIEnv*, jobject, jfloat s) {
    markUIThread(); bass().setEnv1Sustain(s);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv1Release(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); bass().setEnv1Release(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetEnv1VelAmt(JNIEnv*, jobject, jfloat a) {
    markUIThread(); bass().setEnv1VelAmt(a);
}

// ── LFO 0 ─────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO0Shape(JNIEnv*, jobject, jint s) {
    markUIThread();
    bass().setLFO0Shape(static_cast<vibecore::BassLFOShape>(s));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO0Rate(JNIEnv*, jobject, jfloat hz) {
    markUIThread(); bass().setLFO0Rate(hz);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO0Depth(JNIEnv*, jobject, jfloat d) {
    markUIThread(); bass().setLFO0Depth(d);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO0Sync(JNIEnv*, jobject, jint sync) {
    markUIThread();
    bass().setLFO0Sync(static_cast<vibecore::BassLFOSync>(sync));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO0Retrig(JNIEnv*, jobject, jboolean r) {
    markUIThread(); bass().setLFO0Retrig(r);
}

// ── LFO 1 ─────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO1Shape(JNIEnv*, jobject, jint s) {
    markUIThread();
    bass().setLFO1Shape(static_cast<vibecore::BassLFOShape>(s));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO1Rate(JNIEnv*, jobject, jfloat hz) {
    markUIThread(); bass().setLFO1Rate(hz);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO1Depth(JNIEnv*, jobject, jfloat d) {
    markUIThread(); bass().setLFO1Depth(d);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO1Sync(JNIEnv*, jobject, jint sync) {
    markUIThread();
    bass().setLFO1Sync(static_cast<vibecore::BassLFOSync>(sync));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetLFO1Retrig(JNIEnv*, jobject, jboolean r) {
    markUIThread(); bass().setLFO1Retrig(r);
}

// ── Modulation matrix ─────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetModRoute(
        JNIEnv*, jobject, jint routeIdx,
        jint srcInt, jint dstInt, jfloat amount, jboolean active) {
    markUIThread();
    vibecore::BassModRoute route;
    route.source = static_cast<vibecore::BassModSource>(srcInt);
    route.dest   = static_cast<vibecore::BassModDest>(dstInt);
    route.amount = amount;
    route.active = active;
    bass().setModRoute(routeIdx, route);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassClearModRoutes(JNIEnv*, jobject) {
    markUIThread(); bass().clearModRoutes();
}

// ── 3D Stereo ─────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetStereoWidth(JNIEnv*, jobject, jfloat w) {
    markUIThread(); bass().setStereoWidth(w);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetStereoMidGain(JNIEnv*, jobject, jfloat g) {
    markUIThread(); bass().setStereoMidGain(g);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetStereoSideGain(JNIEnv*, jobject, jfloat g) {
    markUIThread(); bass().setStereoSideGain(g);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassSetStereoEnabled(JNIEnv*, jobject, jboolean en) {
    markUIThread(); bass().setStereoEnabled(en);
}

// ── Triggers ──────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassNoteOn(
        JNIEnv*, jobject, jint note, jint velocity) {
    markUIThread();
    bass().noteOn(static_cast<uint8_t>(note), static_cast<uint8_t>(velocity));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassNoteOff(JNIEnv*, jobject, jint note) {
    markUIThread();
    bass().noteOff(static_cast<uint8_t>(note));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassAllNotesOff(JNIEnv*, jobject) {
    markUIThread(); bass().allNotesOff();
}

// ── Preset / Undo ─────────────────────────────────────────────────────────────

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(bass().undo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(bass().redo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassCanUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(bass().canUndo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassCanRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(bass().canRedo());
}

// ── Query ─────────────────────────────────────────────────────────────────────

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassActiveVoices(JNIEnv*, jobject) {
    return static_cast<jint>(bass().activeVoiceCount());
}
JNIEXPORT jfloat JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassOutputLevel(JNIEnv*, jobject) {
    return static_cast<jfloat>(bass().outputLevel());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeBassIsPlaying(JNIEnv*, jobject) {
    return static_cast<jboolean>(bass().isPlaying());
}
