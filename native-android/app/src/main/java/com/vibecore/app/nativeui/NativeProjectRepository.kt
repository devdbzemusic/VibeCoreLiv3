package com.vibecore.app.nativeui

import android.content.Context

/**
 * Native persistence for the Pure-Android project slices.
 *
 * Schema 8 adds eight pattern banks per track. Bank 0 transparently migrates
 * the previous single-pattern keys so existing projects retain their groove.
 */
class NativeProjectRepository(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(default: VibeCoreUiState): VibeCoreUiState {
        val tracks = default.tracks.map { track ->
            track.copy(
                patternBanks = track.patternBanks.mapIndexed { bank, steps -> loadBank(track.id, bank, steps) },
                muted = prefs.getBoolean("track_${track.id}_mute", track.muted),
                soloed = prefs.getBoolean("track_${track.id}_solo", track.soloed),
                volume = prefs.getInt("track_${track.id}_volume", track.volume).coerceIn(0, 127),
                sampleName = prefs.getString("track_${track.id}_sample_name", track.sampleName),
                sampleUri = prefs.getString("track_${track.id}_sample_uri", track.sampleUri),
            )
        }
        return default.copy(
            bpm = prefs.getFloat("bpm", default.bpm.toFloat()).toDouble().coerceIn(20.0, 300.0),
            masterGain = prefs.getFloat("master_gain", default.masterGain).coerceIn(0f, 1f),
            bassVolume = prefs.getFloat("bass_volume", default.bassVolume).coerceIn(0f, 1.5f),
            bassCutoffHz = prefs.getFloat("bass_cutoff_hz", default.bassCutoffHz).coerceIn(40f, 12000f),
            bassResonance = prefs.getFloat("bass_resonance", default.bassResonance).coerceIn(0f, 1f),
            bassGlideMs = prefs.getFloat("bass_glide_ms", default.bassGlideMs).coerceIn(0f, 500f),
            bassWaveform = prefs.getInt("bass_waveform", default.bassWaveform).coerceIn(0, 5),
            voiceVolume = prefs.getFloat("voice_volume", default.voiceVolume).coerceIn(0f, 1.5f),
            voiceDryWet = prefs.getFloat("voice_dry_wet", default.voiceDryWet).coerceIn(0f, 1f),
            voicePitchSemitones = prefs.getFloat("voice_pitch_st", default.voicePitchSemitones).coerceIn(-24f, 24f),
            voiceFormantSemitones = prefs.getFloat("voice_formant_st", default.voiceFormantSemitones).coerceIn(-24f, 24f),
            voiceGlideMs = prefs.getFloat("voice_glide_ms", default.voiceGlideMs).coerceIn(0f, 500f),
            selectedTrack = prefs.getInt("selected_track", default.selectedTrack).coerceIn(0, tracks.lastIndex),
            selectedPatternBank = prefs.getInt("selected_pattern_bank", default.selectedPatternBank).coerceIn(0, PATTERN_BANK_COUNT - 1),
            tracks = tracks,
        )
    }

    fun save(state: VibeCoreUiState) {
        val editor = prefs.edit()
            .putInt("schema", SCHEMA_VERSION)
            .putFloat("bpm", state.bpm.toFloat())
            .putFloat("master_gain", state.masterGain.coerceIn(0f, 1f))
            .putFloat("bass_volume", state.bassVolume.coerceIn(0f, 1.5f))
            .putFloat("bass_cutoff_hz", state.bassCutoffHz.coerceIn(40f, 12000f))
            .putFloat("bass_resonance", state.bassResonance.coerceIn(0f, 1f))
            .putFloat("bass_glide_ms", state.bassGlideMs.coerceIn(0f, 500f))
            .putInt("bass_waveform", state.bassWaveform.coerceIn(0, 5))
            .putFloat("voice_volume", state.voiceVolume.coerceIn(0f, 1.5f))
            .putFloat("voice_dry_wet", state.voiceDryWet.coerceIn(0f, 1f))
            .putFloat("voice_pitch_st", state.voicePitchSemitones.coerceIn(-24f, 24f))
            .putFloat("voice_formant_st", state.voiceFormantSemitones.coerceIn(-24f, 24f))
            .putFloat("voice_glide_ms", state.voiceGlideMs.coerceIn(0f, 500f))
            .putInt("selected_track", state.selectedTrack)
            .putInt("selected_pattern_bank", state.selectedPatternBank)

        state.tracks.forEach { track ->
            track.patternBanks.forEachIndexed { bank, steps ->
                val prefix = "track_${track.id}_bank_${bank}"
                var mask = 0
                steps.forEachIndexed { index, step ->
                    if (step.active) mask = mask or (1 shl index)
                    val stepPrefix = "${prefix}_step_${index}"
                    editor
                        .putInt("${stepPrefix}_velocity", step.velocity.coerceIn(1, 127))
                        .putInt("${stepPrefix}_probability", step.probability.coerceIn(0, 100))
                        .putBoolean("${stepPrefix}_accent", step.accent)
                        .putInt("${stepPrefix}_roll", step.rollCount.coerceIn(0, 8))
                }
                editor.putInt("${prefix}_steps", mask)
            }
            editor
                .putBoolean("track_${track.id}_mute", track.muted)
                .putBoolean("track_${track.id}_solo", track.soloed)
                .putInt("track_${track.id}_volume", track.volume)

            if (track.sampleName == null) editor.remove("track_${track.id}_sample_name")
            else editor.putString("track_${track.id}_sample_name", track.sampleName)
            if (track.sampleUri == null) editor.remove("track_${track.id}_sample_uri")
            else editor.putString("track_${track.id}_sample_uri", track.sampleUri)
        }
        editor.apply()
    }

    private fun loadBank(trackId: Int, bank: Int, defaults: List<StepState>): List<StepState> {
        val prefix = "track_${trackId}_bank_${bank}"
        val legacyPrefix = "track_${trackId}"
        val maskKey = "${prefix}_steps"
        val mask = if (prefs.contains(maskKey)) prefs.getInt(maskKey, 0)
        else if (bank == 0) prefs.getInt("${legacyPrefix}_steps", 0) else 0
        return defaults.mapIndexed { index, step ->
            val stepPrefix = "${prefix}_step_${index}"
            val legacyStepPrefix = "${legacyPrefix}_step_${index}"
            step.copy(
                active = (mask and (1 shl index)) != 0,
                velocity = readInt("${stepPrefix}_velocity", "${legacyStepPrefix}_velocity", bank, step.velocity).coerceIn(1, 127),
                probability = readInt("${stepPrefix}_probability", "${legacyStepPrefix}_probability", bank, step.probability).coerceIn(0, 100),
                accent = readBoolean("${stepPrefix}_accent", "${legacyStepPrefix}_accent", bank, step.accent),
                rollCount = readInt("${stepPrefix}_roll", "${legacyStepPrefix}_roll", bank, step.rollCount).coerceIn(0, 8),
            )
        }
    }

    private fun readInt(key: String, legacyKey: String, bank: Int, fallback: Int): Int =
        if (prefs.contains(key)) prefs.getInt(key, fallback)
        else if (bank == 0) prefs.getInt(legacyKey, fallback) else fallback

    private fun readBoolean(key: String, legacyKey: String, bank: Int, fallback: Boolean): Boolean =
        if (prefs.contains(key)) prefs.getBoolean(key, fallback)
        else if (bank == 0) prefs.getBoolean(legacyKey, fallback) else fallback

    companion object {
        private const val PREFS_NAME = "vibecore_native_project_v1"
        private const val SCHEMA_VERSION = 8
    }
}
