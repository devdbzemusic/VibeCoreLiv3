package com.vibecore.app.nativeui

data class StepState(
    val active: Boolean = false,
    val velocity: Int = 100,
    val note: Int = 60,
)

data class TrackState(
    val id: Int,
    val name: String,
    val steps: List<StepState> = List(16) { StepState() },
    val muted: Boolean = false,
    val soloed: Boolean = false,
    val volume: Int = 100,
)

data class VibeCoreUiState(
    val nativeAvailable: Boolean = false,
    val engineRunning: Boolean = false,
    val playing: Boolean = false,
    val bpm: Double = 120.0,
    val selectedTrack: Int = 0,
    val currentStep: Int = 0,
    val latencyMs: Double = -1.0,
    val diagnostic: String = "native:unknown",
    val tracks: List<TrackState> = defaultTracks(),
)

fun defaultTracks(): List<TrackState> = listOf(
    TrackState(0, "KICK"),
    TrackState(1, "SNARE"),
    TrackState(2, "PERC"),
    TrackState(3, "HAT"),
    TrackState(4, "BASS"),
    TrackState(5, "SYNTH"),
    TrackState(6, "SAMPLE 1"),
    TrackState(7, "SAMPLE 2"),
    TrackState(8, "SAMPLE 3"),
    TrackState(9, "SAMPLE 4"),
    TrackState(10, "SAMPLE 5"),
    TrackState(11, "SAMPLE 6"),
    TrackState(12, "SAMPLE 7"),
    TrackState(13, "SAMPLE 8"),
    TrackState(14, "SAMPLE 9"),
    TrackState(15, "SAMPLE 10"),
)
