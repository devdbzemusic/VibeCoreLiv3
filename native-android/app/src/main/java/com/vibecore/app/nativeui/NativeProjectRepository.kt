package com.vibecore.app.nativeui

import android.content.Context

/**
 * Small native persistence layer for the first Compose parity slice.
 *
 * It stores only state that is already represented by the current Pure-Android
 * UI. This avoids inventing a second incomplete project schema while the full
 * v13 project model is ported screen-by-screen.
 */
class NativeProjectRepository(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(default: VibeCoreUiState): VibeCoreUiState {
        val tracks = default.tracks.map { track ->
            val mask = prefs.getInt("track_${track.id}_steps", 0)
            track.copy(
                steps = track.steps.mapIndexed { index, step ->
                    step.copy(active = (mask and (1 shl index)) != 0)
                },
                muted = prefs.getBoolean("track_${track.id}_mute", track.muted),
                soloed = prefs.getBoolean("track_${track.id}_solo", track.soloed),
                volume = prefs.getInt("track_${track.id}_volume", track.volume).coerceIn(0, 127),
            )
        }
        return default.copy(
            bpm = prefs.getFloat("bpm", default.bpm.toFloat()).toDouble().coerceIn(20.0, 300.0),
            selectedTrack = prefs.getInt("selected_track", default.selectedTrack).coerceIn(0, tracks.lastIndex),
            tracks = tracks,
        )
    }

    fun save(state: VibeCoreUiState) {
        val editor = prefs.edit()
            .putInt("schema", SCHEMA_VERSION)
            .putFloat("bpm", state.bpm.toFloat())
            .putInt("selected_track", state.selectedTrack)

        state.tracks.forEach { track ->
            var mask = 0
            track.steps.forEachIndexed { index, step ->
                if (step.active) mask = mask or (1 shl index)
            }
            editor
                .putInt("track_${track.id}_steps", mask)
                .putBoolean("track_${track.id}_mute", track.muted)
                .putBoolean("track_${track.id}_solo", track.soloed)
                .putInt("track_${track.id}_volume", track.volume)
        }
        editor.apply()
    }

    companion object {
        private const val PREFS_NAME = "vibecore_native_project_v1"
        private const val SCHEMA_VERSION = 1
    }
}
