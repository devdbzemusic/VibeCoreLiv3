package com.vibecore.app.nativeui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class VibeCoreViewModel(application: Application) : AndroidViewModel(application) {
    private val runtime = NativeRuntime(application)
    private val repository = NativeProjectRepository(application)

    private val initialState = repository.load(
        VibeCoreUiState(
            nativeAvailable = runtime.isAvailable(),
            engineRunning = runtime.isEngineRunning(),
            playing = runtime.isPlaying(),
            bpm = runtime.tempo(),
            latencyMs = runtime.latencyMs(),
            diagnostic = runtime.diagnostic(),
        )
    )

    private val _state = MutableStateFlow(initialState)
    val state: StateFlow<VibeCoreUiState> = _state.asStateFlow()

    private var meterJob: Job? = null

    init {
        hydrateProjectToNative(initialState)
        startUiPolling()
    }

    fun selectScreen(screen: NativeScreen) {
        _state.update { it.copy(screen = screen) }
    }

    fun selectTrack(track: Int) {
        _state.update { it.copy(selectedTrack = track.coerceIn(0, it.tracks.lastIndex)) }
        persist()
    }

    fun toggleStep(step: Int) {
        val snapshot = _state.value
        val trackIndex = snapshot.selectedTrack
        val track = snapshot.tracks[trackIndex]
        if (step !in track.steps.indices) return
        val nextActive = !track.steps[step].active
        runtime.setStep(track.id, step, nextActive, track.steps[step].velocity, track.steps[step].note)
        _state.update { state ->
            state.copy(
                tracks = state.tracks.mapIndexed { index, item ->
                    if (index != trackIndex) item
                    else item.copy(
                        steps = item.steps.mapIndexed { stepIndex, value ->
                            if (stepIndex == step) value.copy(active = nextActive) else value
                        }
                    )
                }
            )
        }
        persist()
    }

    fun togglePlay() {
        val currentlyPlaying = runtime.isPlaying()
        if (currentlyPlaying) {
            runtime.stop()
        } else {
            runtime.setTempo(_state.value.bpm)
            runtime.play()
        }
        refreshRuntimeState()
    }

    fun setTempo(bpm: Double) {
        val next = bpm.coerceIn(20.0, 300.0)
        runtime.setTempo(next)
        _state.update { it.copy(bpm = next) }
        persist()
    }

    fun nudgeTempo(delta: Double) = setTempo(_state.value.bpm + delta)

    fun toggleMute(trackIndex: Int = _state.value.selectedTrack) {
        val state = _state.value
        if (trackIndex !in state.tracks.indices) return
        val next = !state.tracks[trackIndex].muted
        runtime.setTrackMute(state.tracks[trackIndex].id, next)
        _state.update { current ->
            current.copy(tracks = current.tracks.mapIndexed { index, track ->
                if (index == trackIndex) track.copy(muted = next) else track
            })
        }
        persist()
    }

    fun toggleSolo(trackIndex: Int = _state.value.selectedTrack) {
        val state = _state.value
        if (trackIndex !in state.tracks.indices) return
        val next = !state.tracks[trackIndex].soloed
        runtime.setTrackSolo(state.tracks[trackIndex].id, next)
        _state.update { current ->
            current.copy(tracks = current.tracks.mapIndexed { index, track ->
                if (index == trackIndex) track.copy(soloed = next) else track
            })
        }
        persist()
    }

    fun setTrackVolume(trackIndex: Int, volume: Int) {
        val state = _state.value
        if (trackIndex !in state.tracks.indices) return
        val next = volume.coerceIn(0, 127)
        runtime.setTrackVolume(state.tracks[trackIndex].id, next)
        _state.update { current ->
            current.copy(tracks = current.tracks.mapIndexed { index, track ->
                if (index == trackIndex) track.copy(volume = next) else track
            })
        }
        persist()
    }

    fun onAudioFocusGained() {
        runtime.onAudioFocusGained()
        refreshRuntimeState()
    }

    fun onAudioFocusLost(transient: Boolean) {
        runtime.onAudioFocusLost(transient)
        runtime.stop()
        refreshRuntimeState()
    }

    private fun hydrateProjectToNative(state: VibeCoreUiState) {
        runtime.setTempo(state.bpm)
        state.tracks.forEach { track ->
            runtime.setPatternLength(track.id, track.steps.size)
            runtime.setTrackMute(track.id, track.muted)
            runtime.setTrackSolo(track.id, track.soloed)
            runtime.setTrackVolume(track.id, track.volume)
            track.steps.forEachIndexed { stepIndex, step ->
                runtime.setStep(track.id, stepIndex, step.active, step.velocity, step.note)
            }
        }
    }

    private fun persist() {
        repository.save(_state.value)
    }

    private fun startUiPolling() {
        meterJob?.cancel()
        meterJob = viewModelScope.launch {
            while (isActive) {
                refreshRuntimeState()
                delay(33L) // UI playhead/diagnostics only; C++ owns musical time.
            }
        }
    }

    private fun refreshRuntimeState() {
        val current = _state.value
        val selectedTrackId = current.tracks.getOrNull(current.selectedTrack)?.id ?: 0
        _state.update {
            it.copy(
                nativeAvailable = runtime.isAvailable(),
                engineRunning = runtime.isEngineRunning(),
                playing = runtime.isPlaying(),
                currentStep = runtime.currentStep(selectedTrackId).coerceAtLeast(0),
                latencyMs = runtime.latencyMs(),
                diagnostic = runtime.diagnostic(),
            )
        }
    }

    override fun onCleared() {
        meterJob?.cancel()
        persist()
        runtime.shutdown()
        super.onCleared()
    }
}
