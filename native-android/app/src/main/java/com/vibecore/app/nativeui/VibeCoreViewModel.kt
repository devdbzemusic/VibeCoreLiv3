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
    private val _state = MutableStateFlow(
        VibeCoreUiState(
            nativeAvailable = runtime.isAvailable(),
            engineRunning = runtime.isEngineRunning(),
            playing = runtime.isPlaying(),
            bpm = runtime.tempo(),
            latencyMs = runtime.latencyMs(),
            diagnostic = runtime.diagnostic(),
        )
    )
    val state: StateFlow<VibeCoreUiState> = _state.asStateFlow()

    private var meterJob: Job? = null

    init {
        startUiPolling()
    }

    fun selectTrack(track: Int) {
        _state.update { it.copy(selectedTrack = track.coerceIn(0, it.tracks.lastIndex)) }
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
    }

    fun nudgeTempo(delta: Double) = setTempo(_state.value.bpm + delta)

    fun toggleMute() {
        val selected = _state.value.selectedTrack
        val next = !_state.value.tracks[selected].muted
        runtime.setTrackMute(selected, next)
        _state.update { state ->
            state.copy(tracks = state.tracks.mapIndexed { index, track ->
                if (index == selected) track.copy(muted = next) else track
            })
        }
    }

    fun toggleSolo() {
        val selected = _state.value.selectedTrack
        val next = !_state.value.tracks[selected].soloed
        runtime.setTrackSolo(selected, next)
        _state.update { state ->
            state.copy(tracks = state.tracks.mapIndexed { index, track ->
                if (index == selected) track.copy(soloed = next) else track
            })
        }
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
        runtime.shutdown()
        super.onCleared()
    }
}
