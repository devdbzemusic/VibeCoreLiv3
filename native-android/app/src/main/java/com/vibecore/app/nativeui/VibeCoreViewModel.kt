package com.vibecore.app.nativeui

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class VibeCoreViewModel(application: Application) : AndroidViewModel(application) {
    private val logTag = "VibeCoreNativeUi"
    private val app = application
    private val runtime = NativeRuntime(application)
    private val repository = NativeProjectRepository(application)
    private val decoder = AndroidAudioDecoder(application)

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
        runtime.prepareBassInstrument()
        runtime.prepareVoiceInstrument()
        restorePersistedSamples()
        startUiPolling()
    }

    fun selectScreen(screen: NativeScreen) {
        if (_state.value.screen == NativeScreen.BASS && screen != NativeScreen.BASS) {
            runtime.bassAllNotesOff()
            _state.update { it.copy(activePerformanceNote = null) }
        }
        if (_state.value.screen == NativeScreen.VOICE && screen != NativeScreen.VOICE) {
            runtime.voiceAllNotesOff()
            _state.update { it.copy(activePerformanceNote = null) }
        }
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
        if (_state.value.sampleBusy) {
            _state.update { it.copy(sampleStatus = "Sample assets are still loading — Play is held until cold-load completes.") }
            return
        }
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

    fun setMasterGain(value: Float) {
        val next = value.coerceIn(0f, 1f)
        runtime.setMasterGain(next)
        _state.update {
            it.copy(
                masterGain = next,
                settingsStatus = "Master gain ${(next * 100f).toInt()}% -> Native Oboe engine.",
            )
        }
        persist()
    }

    fun setBassVolume(value: Float) {
        val next = value.coerceIn(0f, 1.5f)
        runtime.setBassVolume(next)
        _state.update { it.copy(bassVolume = next, performanceStatus = "Bass volume ${(next * 100f).toInt()}% -> Native Bass.") }
        persist()
    }

    fun setBassCutoff(value: Float) {
        val next = value.coerceIn(40f, 12000f)
        runtime.setBassCutoff(next)
        _state.update { it.copy(bassCutoffHz = next, performanceStatus = "Bass cutoff ${next.toInt()} Hz -> Native Bass filter.") }
        persist()
    }

    fun setBassResonance(value: Float) {
        val next = value.coerceIn(0f, 1f)
        runtime.setBassResonance(next)
        _state.update { it.copy(bassResonance = next, performanceStatus = "Bass resonance ${(next * 100f).toInt()}% -> Native Bass filter.") }
        persist()
    }

    fun setBassGlide(value: Float) {
        val next = value.coerceIn(0f, 500f)
        runtime.setBassGlideMs(next)
        _state.update { it.copy(bassGlideMs = next, performanceStatus = "Bass glide ${next.toInt()} ms -> Native Bass.") }
        persist()
    }

    fun setBassWaveform(value: Int) {
        val next = value.coerceIn(0, 5)
        runtime.setBassWaveform(next)
        _state.update { it.copy(bassWaveform = next, performanceStatus = "Bass waveform ${next + 1} -> Native Bass oscillator.") }
        persist()
    }

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

    fun beginSamplePick(): Boolean {
        val track = _state.value.tracks.getOrNull(_state.value.selectedTrack) ?: return false
        if (track.kind != TrackKind.DRUM && track.kind != TrackKind.SAMPLE) {
            _state.update { it.copy(sampleStatus = "${track.name} is ${track.kind}; audio-file assignment is only valid for Drum/Sample tracks.") }
            return false
        }
        if (_state.value.sampleBusy) {
            _state.update { it.copy(sampleStatus = "Sample assets are still loading; wait for the current load to finish.") }
            return false
        }
        _state.update { it.copy(sampleStatus = "Waiting for Android file picker for ${track.name}...") }
        return true
    }

    fun cancelSamplePick() {
        if (_state.value.sampleBusy) return
        _state.update { it.copy(sampleStatus = "Audio selection cancelled. No sample was changed.") }
    }

    fun loadSampleForSelected(uri: Uri) {
        val trackIndex = _state.value.selectedTrack
        val track = _state.value.tracks.getOrNull(trackIndex) ?: return
        if (track.kind != TrackKind.DRUM && track.kind != TrackKind.SAMPLE) {
            _state.update { it.copy(sampleStatus = "${track.name} is ${track.kind}; audio-file assignment is only valid for Drum/Sample tracks.") }
            return
        }
        if (_state.value.sampleBusy) return

        try {
            app.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: SecurityException) {
            // Some providers grant session access only; decode can still succeed now.
        }

        viewModelScope.launch {
            _state.update { it.copy(sampleBusy = true, sampleStatus = "Decoding ${track.name}…") }
            try {
                val decoded = withContext(Dispatchers.IO) { decoder.decode(uri) }

                // Native Groove sample replacement is deliberately cold-load only.
                runtime.stopEngine()
                runtime.setTrackMode(track.id, track.kind)
                val loaded = runtime.loadSample(track.id, decoded.mono, decoded.sampleRate)
                check(loaded) { "Native Groove rejected decoded PCM" }
                runtime.setTrackSample(track.id, track.id)

                _state.update { state ->
                    state.copy(
                        sampleBusy = false,
                        sampleStatus = "${decoded.displayName} → ${track.name} • ${decoded.sampleRate} Hz • ${decoded.sourceChannels} ch",
                        tracks = state.tracks.mapIndexed { index, value ->
                            if (index == trackIndex) value.copy(
                                sampleName = decoded.displayName,
                                sampleUri = uri.toString(),
                            ) else value
                        },
                    )
                }
                persist()
            } catch (error: Exception) {
                Log.e(logTag, "Sample load failed for ${track.name}", error)
                _state.update {
                    it.copy(
                        sampleBusy = false,
                        sampleStatus = "Sample load failed: ${error.message ?: error::class.java.simpleName}",
                    )
                }
            }
        }
    }

    fun performanceNoteOn(note: Int, source: NativeScreen) {
        when (source) {
            NativeScreen.BASS -> {
                val ok = runtime.bassNoteOn(note)
                _state.update {
                    it.copy(
                        performanceStatus = if (ok) "Bass note $note -> Native Bass / Oboe" else "Bass note failed: native engine unavailable.",
                        activePerformanceNote = if (ok) note else null,
                    )
                }
            }
            NativeScreen.SYNTH -> _state.update {
                it.copy(
                    performanceStatus = "Synth keyboard UI ready; native Synth3D renderer is still an open sprint.",
                    activePerformanceNote = note,
                )
            }
            NativeScreen.VOICE -> _state.update {
                val ok = runtime.voiceNoteOn(note)
                it.copy(
                    voiceStatus = if (ok) "Voice note $note -> Native Voice / Oboe" else "Voice note failed: native engine unavailable.",
                    activePerformanceNote = if (ok) note else null,
                )
            }
            else -> Unit
        }
    }

    fun performanceNoteOff(note: Int, source: NativeScreen) {
        if (source == NativeScreen.BASS) {
            runtime.bassNoteOff(note)
        }
        if (source == NativeScreen.VOICE) {
            runtime.voiceNoteOff(note)
        }
        _state.update {
            it.copy(
                performanceStatus = when (source) {
                    NativeScreen.SYNTH -> "Synth keyboard UI ready; native Synth3D renderer is still an open sprint."
                    NativeScreen.BASS -> "Bass note $note released."
                    NativeScreen.VOICE -> it.performanceStatus
                    else -> it.performanceStatus
                },
                voiceStatus = if (source == NativeScreen.VOICE) "Voice note $note released; sample/live-input content still needs parity work." else it.voiceStatus,
                activePerformanceNote = null,
            )
        }
    }

    fun allPerformanceNotesOff() {
        runtime.bassAllNotesOff()
        runtime.voiceAllNotesOff()
        _state.update { it.copy(activePerformanceNote = null, performanceStatus = "All performance notes released.", voiceStatus = "All voice notes released.") }
    }

    fun queueScene(scene: Int) {
        val target = scene.coerceIn(0, 7)
        val ok = runtime.queueSceneChange(target)
        _state.update {
            it.copy(
                pendingScene = if (ok) target else it.pendingScene,
                sceneStatus = if (ok) {
                    "Scene ${target + 1} queued through Native Groove."
                } else {
                    "Scene queue failed: native engine unavailable."
                },
            )
        }
    }

    fun addPianoRollNote(note: Int) {
        val state = _state.value
        val track = state.tracks.getOrNull(state.selectedTrack) ?: return
        if (track.kind != TrackKind.BASS && track.kind != TrackKind.SYNTH && track.kind != TrackKind.VOICE) {
            _state.update { it.copy(pianoRollStatus = "${track.name} is ${track.kind}; piano-roll notes belong to Bass/Synth/Voice tracks.") }
            return
        }
        val nextIndex = state.pianoRollNotesAdded
        val ok = runtime.addPianoRollNote(track.id, nextIndex, note)
        _state.update {
            it.copy(
                pianoRollNotesAdded = if (ok) nextIndex + 1 else nextIndex,
                pianoRollStatus = if (ok) {
                    "Added note $note to ${track.name} at native tick ${(nextIndex % 16) * 480}."
                } else {
                    "Piano-roll add failed: native engine unavailable."
                },
            )
        }
    }

    fun clearPianoRoll() {
        val state = _state.value
        val track = state.tracks.getOrNull(state.selectedTrack) ?: return
        val ok = runtime.clearPianoRoll(track.id)
        _state.update {
            it.copy(
                pianoRollNotesAdded = if (ok) 0 else it.pianoRollNotesAdded,
                pianoRollStatus = if (ok) "Cleared native piano roll for ${track.name}." else "Piano-roll clear failed: native engine unavailable.",
            )
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

    private fun hydrateProjectToNative(state: VibeCoreUiState) {
        runtime.setTempo(state.bpm)
        runtime.setMasterGain(state.masterGain)
        runtime.setBassVolume(state.bassVolume)
        runtime.setBassCutoff(state.bassCutoffHz)
        runtime.setBassResonance(state.bassResonance)
        runtime.setBassGlideMs(state.bassGlideMs)
        runtime.setBassWaveform(state.bassWaveform)
        state.tracks.forEach { track ->
            runtime.setTrackMode(track.id, track.kind)
            runtime.setPatternLength(track.id, track.steps.size)
            runtime.setTrackMute(track.id, track.muted)
            runtime.setTrackSolo(track.id, track.soloed)
            runtime.setTrackVolume(track.id, track.volume)
            track.steps.forEachIndexed { stepIndex, step ->
                runtime.setStep(track.id, stepIndex, step.active, step.velocity, step.note)
            }
        }
    }

    private fun restorePersistedSamples() {
        val assets = initialState.tracks.mapIndexedNotNull { index, track ->
            val uri = track.sampleUri?.let(Uri::parse) ?: return@mapIndexedNotNull null
            if (track.kind != TrackKind.DRUM && track.kind != TrackKind.SAMPLE) return@mapIndexedNotNull null
            Triple(index, track, uri)
        }
        if (assets.isEmpty()) return

        viewModelScope.launch {
            _state.update { it.copy(sampleBusy = true, sampleStatus = "Restoring ${assets.size} native sample asset(s)…") }
            runtime.stopEngine()
            var restored = 0
            assets.forEach { (_, track, uri) ->
                try {
                    val decoded = withContext(Dispatchers.IO) { decoder.decode(uri) }
                    runtime.setTrackMode(track.id, track.kind)
                    if (runtime.loadSample(track.id, decoded.mono, decoded.sampleRate)) {
                        runtime.setTrackSample(track.id, track.id)
                        restored += 1
                    }
                } catch (error: Exception) {
                    Log.w(logTag, "Persisted sample restore failed for ${track.name}", error)
                    // Missing/revoked assets remain visible by sampleName and can be reselected.
                }
            }
            _state.update {
                it.copy(
                    sampleBusy = false,
                    sampleStatus = if (restored == assets.size) {
                        "Restored $restored/${assets.size} persisted native sample asset(s)."
                    } else {
                        "Restored $restored/${assets.size} persisted native sample asset(s); reselect missing files."
                    },
                )
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
                bassActiveVoices = runtime.bassActiveVoices(),
                bassOutputLevel = runtime.bassOutputLevel(),
                activeScene = runtime.activeScene(),
                voiceActiveUnits = runtime.voiceActiveUnits(),
                voiceOutputLevel = runtime.voiceOutputLevel(),
                voiceInputLevel = runtime.voiceInputLevel(),
                voiceLiveInput = runtime.voiceLiveInputEnabled(),
            )
        }
    }

    override fun onCleared() {
        meterJob?.cancel()
        runtime.bassAllNotesOff()
        runtime.voiceAllNotesOff()
        persist()
        runtime.shutdown()
        super.onCleared()
    }
}
