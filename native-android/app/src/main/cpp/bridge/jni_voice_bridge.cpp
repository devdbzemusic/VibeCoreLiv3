/**
 * jni_voice_bridge.cpp — JNI marshalling for VibeCore Voice (Phase 6).
 *
 * Included at the end of jni_bridge.cpp via #include.
 * All functions follow the Java_com_vibecore_audio_NativeAudioBridge_nativeVoice* pattern.
 *
 * Bridge contract (ADR-005): NO business logic. Marshalling only.
 * All calls go through voice() → VoiceEngine → VoiceNode command queue.
 */

// ─── NOTE: This file is #included from jni_bridge.cpp ────────────────────────
// It uses the voice() helper defined there. Do not compile independently.

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — VOICE
// ═══════════════════════════════════════════════════════════════════════════════

// ── Mode ──────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetGlobalMode(JNIEnv*, jobject, jint m) {
    markUIThread(); voice().setGlobalMode(static_cast<vibecore::VoiceGlobalMode>(m));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetPolyMode(JNIEnv*, jobject, jint m) {
    markUIThread(); voice().setPolyMode(static_cast<vibecore::VoicePolyMode>(m));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetPlayMode(JNIEnv*, jobject, jint m) {
    markUIThread(); voice().setPlayMode(static_cast<vibecore::VoicePlayMode>(m));
}

// ── Master ────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetVolume(JNIEnv*, jobject, jfloat v) {
    markUIThread(); voice().setVolume(v);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetDryWet(JNIEnv*, jobject, jfloat v) {
    markUIThread(); voice().setDryWet(v);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetMonitor(JNIEnv*, jobject, jfloat v) {
    markUIThread(); voice().setMonitor(v);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetGlideMs(JNIEnv*, jobject, jfloat ms) {
    markUIThread(); voice().setGlideMs(ms);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetActiveSlot(JNIEnv*, jobject, jint slot) {
    markUIThread(); voice().setActiveSlot(slot);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetRootNote(JNIEnv*, jobject, jint note) {
    markUIThread(); voice().setRootNote(note);
}

// ── Pitch / Formant ───────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetPitchSemitones(JNIEnv*, jobject, jfloat st) {
    markUIThread(); voice().setPitchSemitones(st);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetPitchEnabled(JNIEnv*, jobject, jboolean e) {
    markUIThread(); voice().setPitchEnabled(e);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetFormantSemitones(JNIEnv*, jobject, jfloat st) {
    markUIThread(); voice().setFormantSemitones(st);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetFormantEnabled(JNIEnv*, jobject, jboolean e) {
    markUIThread(); voice().setFormantEnabled(e);
}

// ── Harmonizer / Doubler ──────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetHarmonyVoice(
        JNIEnv*, jobject, jint index, jfloat semitones, jfloat level, jfloat pan) {
    markUIThread(); voice().setHarmonyVoice(index, semitones, level, pan);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetHarmonyMaster(JNIEnv*, jobject, jfloat lvl) {
    markUIThread(); voice().setHarmonyMaster(lvl);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetHarmonyEnabled(JNIEnv*, jobject, jboolean e) {
    markUIThread(); voice().setHarmonyEnabled(e);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetDoubler(
        JNIEnv*, jobject, jfloat detuneCents, jfloat level, jfloat width, jboolean e) {
    markUIThread(); voice().setDoubler(detuneCents, level, width, e);
}

// ── Dynamics ──────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetGate(
        JNIEnv*, jobject, jfloat thDb, jfloat atkMs, jfloat relMs, jboolean e) {
    markUIThread(); voice().setGate(thDb, atkMs, relMs, e);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetDeEsser(
        JNIEnv*, jobject, jfloat freqHz, jfloat thDb, jfloat amount, jboolean e) {
    markUIThread(); voice().setDeEsser(freqHz, thDb, amount, e);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetCompressor(
        JNIEnv*, jobject, jfloat thDb, jfloat ratio, jfloat atkMs,
        jfloat relMs, jfloat makeupDb, jboolean e) {
    markUIThread(); voice().setCompressor(thDb, ratio, atkMs, relMs, makeupDb, e);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetEQ(
        JNIEnv*, jobject, jfloat lowHz, jfloat lowDb, jfloat midHz, jfloat midDb,
        jfloat midQ, jfloat highHz, jfloat highDb, jboolean e) {
    markUIThread(); voice().setEQ(lowHz, lowDb, midHz, midDb, midQ, highHz, highDb, e);
}

// ── Breath ────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetBreath(
        JNIEnv*, jobject, jfloat level, jfloat colorHz, jfloat widthQ,
        jboolean followEnv, jboolean e) {
    markUIThread(); voice().setBreath(level, colorHz, widthQ, followEnv, e);
}

// ── Texture ───────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetTextureCutoff(JNIEnv*, jobject, jfloat hz) {
    markUIThread(); voice().setTextureCutoff(hz);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetTextureResonance(JNIEnv*, jobject, jfloat q) {
    markUIThread(); voice().setTextureResonance(q);
}

// ── Envelopes ─────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetEnv0(
        JNIEnv*, jobject, jfloat atk, jfloat dec, jfloat sus, jfloat rel, jfloat vel) {
    markUIThread(); voice().setEnv0(atk, dec, sus, rel, vel);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetEnv1(
        JNIEnv*, jobject, jfloat atk, jfloat dec, jfloat sus, jfloat rel, jfloat vel) {
    markUIThread(); voice().setEnv1(atk, dec, sus, rel, vel);
}

// ── LFOs ──────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetLFO0(
        JNIEnv*, jobject, jint shape, jint sync, jfloat rateHz,
        jfloat depth, jfloat phase, jboolean retrig) {
    markUIThread();
    voice().setLFO0(static_cast<vibecore::VoiceLFOShape>(shape),
                    static_cast<vibecore::VoiceLFOSync>(sync),
                    rateHz, depth, phase, retrig);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetLFO1(
        JNIEnv*, jobject, jint shape, jint sync, jfloat rateHz,
        jfloat depth, jfloat phase, jboolean retrig) {
    markUIThread();
    voice().setLFO1(static_cast<vibecore::VoiceLFOShape>(shape),
                    static_cast<vibecore::VoiceLFOSync>(sync),
                    rateHz, depth, phase, retrig);
}

// ── Macros ────────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetMacro1(JNIEnv*, jobject, jfloat v) {
    markUIThread(); voice().setMacro1(v);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetMacro2(JNIEnv*, jobject, jfloat v) {
    markUIThread(); voice().setMacro2(v);
}

// ── Modulation matrix ─────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetModRoute(
        JNIEnv*, jobject, jint route, jint src, jint dest, jfloat amount, jboolean active) {
    markUIThread();
    voice().setModRoute(route,
                        static_cast<vibecore::VoiceModSource>(src),
                        static_cast<vibecore::VoiceModDest>(dest),
                        amount, active);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceClearModRoutes(JNIEnv*, jobject) {
    markUIThread(); voice().clearModRoutes();
}

// ── 3D Stereo ─────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetStereoWidth(JNIEnv*, jobject, jfloat w) {
    markUIThread(); voice().setStereoWidth(w);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetStereoMidGain(JNIEnv*, jobject, jfloat g) {
    markUIThread(); voice().setStereoMidGain(g);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetStereoSideGain(JNIEnv*, jobject, jfloat g) {
    markUIThread(); voice().setStereoSideGain(g);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetStereoPan(JNIEnv*, jobject, jfloat p) {
    markUIThread(); voice().setStereoPan(p);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetStereoEnabled(JNIEnv*, jobject, jboolean e) {
    markUIThread(); voice().setStereoEnabled(e);
}

// ── Triggers ──────────────────────────────────────────────────────────────────

JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceNoteOn(
        JNIEnv*, jobject, jint note, jint velocity, jint slot, jint slice) {
    markUIThread();
    voice().noteOn(static_cast<uint8_t>(note), static_cast<uint8_t>(velocity),
                   slot, slice, 0);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceNoteOff(JNIEnv*, jobject, jint note) {
    markUIThread(); voice().noteOff(static_cast<uint8_t>(note));
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceAllNotesOff(JNIEnv*, jobject) {
    markUIThread(); voice().allNotesOff();
}

// ── Sample management ─────────────────────────────────────────────────────────

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceLoadSample(
        JNIEnv* env, jobject, jint slot, jfloatArray data,
        jint sampleRate, jint rootNote) {
    markUIThread();
    if (data == nullptr) return JNI_FALSE;
    const jsize len = env->GetArrayLength(data);
    if (len <= 0) return JNI_FALSE;
    jfloat* ptr = env->GetFloatArrayElements(data, nullptr);
    if (ptr == nullptr) return JNI_FALSE;
    const bool ok = voice().loadSample(slot, ptr, static_cast<int32_t>(len),
                                       sampleRate, rootNote);
    env->ReleaseFloatArrayElements(data, ptr, JNI_ABORT);
    return static_cast<jboolean>(ok);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceClearSample(JNIEnv*, jobject, jint slot) {
    markUIThread(); voice().clearSample(slot);
}
JNIEXPORT void JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetSliceMarkers(
        JNIEnv* env, jobject, jint slot, jintArray starts) {
    markUIThread();
    if (starts == nullptr) return;
    const jsize len = env->GetArrayLength(starts);
    if (len <= 0) return;
    jint* ptr = env->GetIntArrayElements(starts, nullptr);
    if (ptr == nullptr) return;
    voice().setSliceMarkers(slot, reinterpret_cast<const int32_t*>(ptr),
                            static_cast<int>(len));
    env->ReleaseIntArrayElements(starts, ptr, JNI_ABORT);
}

// ── Live input ────────────────────────────────────────────────────────────────

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceSetLiveInputEnabled(
        JNIEnv*, jobject, jboolean enabled) {
    markUIThread(); return static_cast<jboolean>(voice().setLiveInputEnabled(enabled));
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceLiveInputEnabled(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(voice().liveInputEnabled());
}

// ── Undo / Redo ───────────────────────────────────────────────────────────────

JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(voice().undo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(voice().redo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceCanUndo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(voice().canUndo());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceCanRedo(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(voice().canRedo());
}

// ── Query ─────────────────────────────────────────────────────────────────────

JNIEXPORT jint JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceActiveUnits(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jint>(voice().activeUnitCount());
}
JNIEXPORT jfloat JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceOutputLevel(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jfloat>(voice().outputLevel());
}
JNIEXPORT jfloat JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceInputLevel(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jfloat>(voice().inputLevel());
}
JNIEXPORT jboolean JNICALL
Java_com_vibecore_audio_NativeAudioBridge_nativeVoiceIsPlaying(JNIEnv*, jobject) {
    markUIThread(); return static_cast<jboolean>(voice().isPlaying());
}
