package com.vibecore.app.nativeui

enum class NativeScreen { PATTERN, MIXER, SAMPLE, SYNTH, VOICE }
enum class TrackKind(val nativeMode: Int) { DRUM(0), BASS(1), SYNTH(2), SAMPLE(3), VOICE(4) }

data class StepState(
    val active: Boolean = false,
    val velocity: Int = 100,
    val note: Int = 60,
)

data class TrackState(
    val id: Int,
    val name: String,
    val kind: TrackKind,
    val steps: List<StepState> = List(16) { StepState() },
    val muted: Boolean = false,
    val soloed: Boolean = false,
    val volume: Int = 100,
    val sampleName: String? = null,
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
    val screen: NativeScreen = NativeScreen.PATTERN,
    val tracks: List<TrackState> = defaultTracks(),
)

fun defaultTracks(): List<TrackState> = listOf(
    TrackState(0, "KICK", TrackKind.DRUM),
    TrackState(1, "SNARE", TrackKind.DRUM),
    TrackState(2, "PERC", TrackKind.DRUM),
    TrackState(3, "HAT", TrackKind.DRUM),
    TrackState(4, "BASS", TrackKind.BASS),
    TrackState(5, "SYNTH", TrackKind.SYNTH),
    TrackState(6, "SAMPLE 1", TrackKind.SAMPLE),
    TrackState(7, "SAMPLE 2", TrackKind.SAMPLE),
    TrackState(8, "SAMPLE 3", TrackKind.SAMPLE),
    TrackState(9, "SAMPLE 4", TrackKind.SAMPLE),
    TrackState(10, "SAMPLE 5", TrackKind.SAMPLE),
    TrackState(11, "SAMPLE 6", TrackKind.SAMPLE),
    TrackState(12, "SAMPLE 7", TrackKind.SAMPLE),
    TrackState(13, "SAMPLE 8", TrackKind.SAMPLE),
    TrackState(14, "SAMPLE 9", TrackKind.SAMPLE),
    TrackState(15, "SAMPLE 10", TrackKind.SAMPLE),
)
