package com.vibecore.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibecore.app.nativeui.NativeScreen
import com.vibecore.app.nativeui.TrackKind
import com.vibecore.app.nativeui.TrackState
import com.vibecore.app.nativeui.VibeCoreViewModel

private val PanelShape = RoundedCornerShape(16.dp)
private val StepShape = RoundedCornerShape(9.dp)

@Composable
fun VibeCoreApp(viewModel: VibeCoreViewModel) {
    val state by viewModel.state.collectAsState()
    val samplePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.loadSampleForSelected(uri) else viewModel.cancelSamplePick()
    }

    VibeCoreTheme {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(listOf(VibeCoreColors.Surface2, VibeCoreColors.Background)))
                .padding(10.dp),
        ) {
            val compactLandscape = maxWidth > maxHeight
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(if (compactLandscape) 6.dp else 8.dp),
            ) {
                TransportPanel(
                    bpm = state.bpm,
                    playing = state.playing,
                    nativeAvailable = state.nativeAvailable,
                    engineRunning = state.engineRunning,
                    latencyMs = state.latencyMs,
                    compact = compactLandscape,
                    onPlay = viewModel::togglePlay,
                    onTempoDown = { viewModel.nudgeTempo(-1.0) },
                    onTempoUp = { viewModel.nudgeTempo(1.0) },
                )

                when (state.screen) {
                    NativeScreen.PATTERN -> {
                        TrackStrip(state.tracks, state.selectedTrack, compactLandscape, viewModel::selectTrack)
                        PatternPanel(
                            track = state.tracks[state.selectedTrack],
                            currentStep = state.currentStep,
                            compact = compactLandscape,
                            onToggleStep = viewModel::toggleStep,
                            onMute = { viewModel.toggleMute() },
                            onSolo = { viewModel.toggleSolo() },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    NativeScreen.SCENE -> ScenePanel(
                        activeScene = state.activeScene,
                        pendingScene = state.pendingScene,
                        status = state.sceneStatus,
                        compact = compactLandscape,
                        onScene = viewModel::queueScene,
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.MIXER -> MixerPanel(
                        tracks = state.tracks,
                        selectedTrack = state.selectedTrack,
                        compact = compactLandscape,
                        onSelect = viewModel::selectTrack,
                        onVolume = viewModel::setTrackVolume,
                        onMute = viewModel::toggleMute,
                        onSolo = viewModel::toggleSolo,
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.SAMPLE -> SampleForgePanel(
                        tracks = state.tracks,
                        selectedTrack = state.selectedTrack,
                        busy = state.sampleBusy,
                        status = state.sampleStatus,
                        compact = compactLandscape,
                        onSelect = viewModel::selectTrack,
                        onChooseAudio = {
                            if (viewModel.beginSamplePick()) {
                                samplePicker.launch(arrayOf("audio/*"))
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.BASS -> PerformanceKeyboardPanel(
                        title = "3D BASS",
                        detail = "Native Bass keyboard -> BassEngine noteOn/noteOff -> Oboe",
                        status = state.performanceStatus,
                        activeNote = state.activePerformanceNote,
                        activeVoices = state.bassActiveVoices,
                        outputLevel = state.bassOutputLevel,
                        compact = compactLandscape,
                        enabled = true,
                        screen = NativeScreen.BASS,
                        onNoteOn = viewModel::performanceNoteOn,
                        onNoteOff = viewModel::performanceNoteOff,
                        onAllNotesOff = viewModel::allPerformanceNotesOff,
                        extraControls = {
                            BassMacroControls(
                                volume = state.bassVolume,
                                cutoffHz = state.bassCutoffHz,
                                resonance = state.bassResonance,
                                glideMs = state.bassGlideMs,
                                waveform = state.bassWaveform,
                                compact = compactLandscape,
                                onVolume = viewModel::setBassVolume,
                                onCutoff = viewModel::setBassCutoff,
                                onResonance = viewModel::setBassResonance,
                                onGlide = viewModel::setBassGlide,
                                onWaveform = viewModel::setBassWaveform,
                            )
                        },
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.SYNTH -> PerformanceKeyboardPanel(
                        title = "SYNTH 3D",
                        detail = "Keyboard UI is present; native Synth3D renderer is still the next audio-core sprint.",
                        status = state.performanceStatus,
                        activeNote = state.activePerformanceNote,
                        activeVoices = 0,
                        outputLevel = 0f,
                        compact = compactLandscape,
                        enabled = false,
                        screen = NativeScreen.SYNTH,
                        onNoteOn = viewModel::performanceNoteOn,
                        onNoteOff = viewModel::performanceNoteOff,
                        onAllNotesOff = viewModel::allPerformanceNotesOff,
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.ROLL -> PianoRollPanel(
                        tracks = state.tracks,
                        selectedTrack = state.selectedTrack,
                        notesAdded = state.pianoRollNotesAdded,
                        status = state.pianoRollStatus,
                        compact = compactLandscape,
                        onSelect = viewModel::selectTrack,
                        onAddNote = viewModel::addPianoRollNote,
                        onClear = viewModel::clearPianoRoll,
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.VOICE -> PerformanceKeyboardPanel(
                        title = "VOICE",
                        detail = "Native Voice keyboard -> VoiceEngine noteOn/noteOff -> Oboe",
                        status = state.voiceStatus,
                        activeNote = state.activePerformanceNote,
                        activeVoices = state.voiceActiveUnits,
                        outputLevel = state.voiceOutputLevel,
                        compact = compactLandscape,
                        enabled = true,
                        screen = NativeScreen.VOICE,
                        onNoteOn = viewModel::performanceNoteOn,
                        onNoteOff = viewModel::performanceNoteOff,
                        onAllNotesOff = viewModel::allPerformanceNotesOff,
                        extraControls = {
                            VoiceMacroControls(
                                volume = state.voiceVolume,
                                dryWet = state.voiceDryWet,
                                pitchSemitones = state.voicePitchSemitones,
                                formantSemitones = state.voiceFormantSemitones,
                                glideMs = state.voiceGlideMs,
                                compact = compactLandscape,
                                onVolume = viewModel::setVoiceVolume,
                                onDryWet = viewModel::setVoiceDryWet,
                                onPitch = viewModel::setVoicePitch,
                                onFormant = viewModel::setVoiceFormant,
                                onGlide = viewModel::setVoiceGlide,
                            )
                        },
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.SETTINGS -> SettingsDiagnosticsPanel(
                        masterGain = state.masterGain,
                        bpm = state.bpm,
                        engineRunning = state.engineRunning,
                        playing = state.playing,
                        latencyMs = state.latencyMs,
                        diagnostic = state.diagnostic,
                        status = state.settingsStatus,
                        compact = compactLandscape,
                        onMasterGain = viewModel::setMasterGain,
                        modifier = Modifier.weight(1f),
                    )
                }

                BottomModeBar(state.screen, viewModel::selectScreen)
                DiagnosticBar(state.diagnostic, state.engineRunning)
            }
        }
    }
}

@Composable
private fun TransportPanel(
    bpm: Double,
    playing: Boolean,
    nativeAvailable: Boolean,
    engineRunning: Boolean,
    latencyMs: Double,
    compact: Boolean,
    onPlay: () -> Unit,
    onTempoDown: () -> Unit,
    onTempoUp: () -> Unit,
) {
    val runtimeLabel = when {
        playing -> "TRANSPORT PLAYING"
        engineRunning -> "ENGINE READY"
        else -> "ENGINE IDLE"
    }
    val runtimeColor = when {
        playing -> VibeCoreColors.Lime
        engineRunning -> VibeCoreColors.Primary
        else -> VibeCoreColors.Muted
    }

    Panel {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(if (compact) 9.dp else 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("VIBECORE LIVE", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp, fontSize = if (compact) 15.sp else 17.sp)
                    Text(
                        if (nativeAvailable) "PURE ANDROID • OBOE" else "NATIVE CORE OFFLINE",
                        color = if (nativeAvailable) VibeCoreColors.Lime else VibeCoreColors.Crimson,
                        fontFamily = FontFamily.Monospace,
                        fontSize = if (compact) 9.sp else 10.sp,
                    )
                }
                NeonMiniButton("−", compact, onTempoDown)
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(String.format("%.0f", bpm), color = VibeCoreColors.Foreground, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, fontSize = if (compact) 18.sp else 22.sp)
                    Text("BPM", color = VibeCoreColors.Muted, fontSize = 9.sp)
                }
                NeonMiniButton("+", compact, onTempoUp)
                Button(
                    onClick = onPlay,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (playing) VibeCoreColors.Magenta else VibeCoreColors.Primary,
                        contentColor = VibeCoreColors.Background,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.height(if (compact) 42.dp else 48.dp),
                ) { Text(if (playing) "STOP" else "PLAY", fontWeight = FontWeight.Black) }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = if (compact) 3.dp else 5.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    runtimeLabel,
                    color = runtimeColor,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                )
                Text(
                    if (latencyMs >= 0) "${String.format("%.2f", latencyMs)} ms" else "LATENCY --",
                    color = VibeCoreColors.Muted,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }
    }
}

@Composable
private fun TrackStrip(tracks: List<TrackState>, selected: Int, compact: Boolean, onSelect: (Int) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        tracks.forEachIndexed { index, track ->
            val chosen = index == selected
            Surface(
                color = if (chosen) VibeCoreColors.Primary.copy(alpha = 0.18f) else VibeCoreColors.Surface1,
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, if (chosen) VibeCoreColors.Primary else VibeCoreColors.Border),
                modifier = Modifier.width(if (compact) 98.dp else 84.dp).height(if (compact) 38.dp else 44.dp).clickable { onSelect(index) },
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(track.name, color = if (chosen) VibeCoreColors.PrimaryGlow else VibeCoreColors.Foreground, fontWeight = FontWeight.Bold, fontSize = 10.sp, maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun PatternPanel(
    track: TrackState,
    currentStep: Int,
    compact: Boolean,
    onToggleStep: (Int) -> Unit,
    onMute: () -> Unit,
    onSolo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Panel(modifier) {
        if (compact) {
            Row(
                modifier = Modifier.fillMaxSize().padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.width(180.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(track.name, color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 17.sp)
                    Text("PATTERN 01 • 16 STEPS", color = VibeCoreColors.Muted, fontSize = 9.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ToggleChip("M", track.muted, VibeCoreColors.Crimson, onMute)
                        ToggleChip("S", track.soloed, VibeCoreColors.Amber, onSolo)
                    }
                }
                Column(modifier = Modifier.fillMaxHeight().weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(2) { row ->
                        Row(modifier = Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            repeat(8) { col ->
                                val step = row * 8 + col
                                StepCell(
                                    number = step + 1,
                                    active = track.steps[step].active,
                                    playing = currentStep == step,
                                    onClick = { onToggleStep(step) },
                                    modifier = Modifier.weight(1f).fillMaxHeight(),
                                    compact = true,
                                )
                            }
                        }
                    }
                }
            }
        } else {
            Column(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(track.name, color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 19.sp)
                        Text("PATTERN 01 • 16 STEPS", color = VibeCoreColors.Muted, fontSize = 10.sp)
                    }
                    ToggleChip("M", track.muted, VibeCoreColors.Crimson, onMute)
                    Spacer(Modifier.width(6.dp))
                    ToggleChip("S", track.soloed, VibeCoreColors.Amber, onSolo)
                }
                Column(modifier = Modifier.fillMaxWidth().weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically)) {
                    repeat(4) { row ->
                        Row(modifier = Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            repeat(4) { col ->
                                val step = row * 4 + col
                                StepCell(
                                    number = step + 1,
                                    active = track.steps[step].active,
                                    playing = currentStep == step,
                                    onClick = { onToggleStep(step) },
                                    modifier = Modifier.weight(1f).fillMaxHeight(),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsDiagnosticsPanel(
    masterGain: Float,
    bpm: Double,
    engineRunning: Boolean,
    playing: Boolean,
    latencyMs: Double,
    diagnostic: String,
    status: String,
    compact: Boolean,
    onMasterGain: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    Panel(modifier) {
        if (compact) {
            Row(
                modifier = Modifier.fillMaxSize().padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.width(540.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("SETTINGS", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text("NATIVE ENGINE CONTROL + DIAGNOSTICS", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp)
                    Text("MASTER ${(masterGain * 100f).toInt()}%", color = VibeCoreColors.Foreground, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = 12.sp)
                    Slider(
                        value = masterGain,
                        onValueChange = onMasterGain,
                        valueRange = 0f..1f,
                        colors = SliderDefaults.colors(
                            thumbColor = VibeCoreColors.Primary,
                            activeTrackColor = VibeCoreColors.Primary,
                            inactiveTrackColor = VibeCoreColors.SurfaceElevated,
                        ),
                    )
                    Text(status, color = VibeCoreColors.Lime, fontFamily = FontFamily.Monospace, fontSize = 8.sp, maxLines = 2)
                }
                Column(modifier = Modifier.fillMaxHeight().weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PerformanceMeter("BPM", String.format("%.0f", bpm), true, Modifier.weight(1f))
                        PerformanceMeter("ENGINE", if (engineRunning) "ON" else "IDLE", true, Modifier.weight(1f))
                        PerformanceMeter("PLAY", if (playing) "RUN" else "STOP", true, Modifier.weight(1f))
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PerformanceMeter("LATENCY", if (latencyMs >= 0) "${String.format("%.1f", latencyMs)}ms" else "--", true, Modifier.weight(1f))
                        PerformanceMeter("PATH", "OBOE", true, Modifier.weight(1f))
                    }
                    Surface(
                        color = VibeCoreColors.Surface0,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, VibeCoreColors.Border),
                        modifier = Modifier.fillMaxWidth().weight(1f),
                    ) {
                        Box(modifier = Modifier.fillMaxSize().padding(10.dp), contentAlignment = Alignment.CenterStart) {
                            Text(diagnostic, color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 9.sp, maxLines = 3)
                        }
                    }
                }
            }
        } else {
            Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("SETTINGS", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("NATIVE ENGINE CONTROL + DIAGNOSTICS", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                Text("MASTER ${(masterGain * 100f).toInt()}%", color = VibeCoreColors.Foreground, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = 14.sp)
                Slider(
                    value = masterGain,
                    onValueChange = onMasterGain,
                    valueRange = 0f..1f,
                    colors = SliderDefaults.colors(
                        thumbColor = VibeCoreColors.Primary,
                        activeTrackColor = VibeCoreColors.Primary,
                        inactiveTrackColor = VibeCoreColors.SurfaceElevated,
                    ),
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PerformanceMeter("BPM", String.format("%.0f", bpm), false, Modifier.weight(1f))
                    PerformanceMeter("ENGINE", if (engineRunning) "ON" else "IDLE", false, Modifier.weight(1f))
                    PerformanceMeter("PLAY", if (playing) "RUN" else "STOP", false, Modifier.weight(1f))
                }
                Text(status, color = VibeCoreColors.Lime, fontFamily = FontFamily.Monospace, fontSize = 10.sp, maxLines = 1)
                Text(diagnostic, color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp, maxLines = 3)
            }
        }
    }
}

@Composable
private fun BassMacroControls(
    volume: Float,
    cutoffHz: Float,
    resonance: Float,
    glideMs: Float,
    waveform: Int,
    compact: Boolean,
    onVolume: (Float) -> Unit,
    onCutoff: (Float) -> Unit,
    onResonance: (Float) -> Unit,
    onGlide: (Float) -> Unit,
    onWaveform: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(if (compact) 5.dp else 7.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            BassWaveButton("SAW", selected = waveform == 0, compact = compact, onClick = { onWaveform(0) }, modifier = Modifier.weight(1f))
            BassWaveButton("SQR", selected = waveform == 1, compact = compact, onClick = { onWaveform(1) }, modifier = Modifier.weight(1f))
            BassWaveButton("SUB", selected = waveform == 2, compact = compact, onClick = { onWaveform(2) }, modifier = Modifier.weight(1f))
            BassWaveButton("FM", selected = waveform == 3, compact = compact, onClick = { onWaveform(3) }, modifier = Modifier.weight(1f))
        }
        BassSlider("VOL", "${(volume * 100f).toInt()}%", volume, 0f..1.5f, compact, onVolume)
        BassSlider("CUT", "${cutoffHz.toInt()}Hz", cutoffHz, 40f..12000f, compact, onCutoff)
        BassSlider("RES", "${(resonance * 100f).toInt()}%", resonance, 0f..1f, compact, onResonance)
        BassSlider("GLD", "${glideMs.toInt()}ms", glideMs, 0f..500f, compact, onGlide)
    }
}

@Composable
private fun BassSlider(
    label: String,
    valueLabel: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    compact: Boolean,
    onValueChange: (Float) -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = if (compact) 8.sp else 9.sp, modifier = Modifier.width(28.dp))
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange,
            colors = SliderDefaults.colors(
                thumbColor = VibeCoreColors.Primary,
                activeTrackColor = VibeCoreColors.Primary,
                inactiveTrackColor = VibeCoreColors.SurfaceElevated,
            ),
            modifier = Modifier.weight(1f).height(if (compact) 28.dp else 34.dp),
        )
        Text(valueLabel, color = VibeCoreColors.Foreground, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = if (compact) 8.sp else 9.sp, textAlign = TextAlign.End, modifier = Modifier.width(if (compact) 58.dp else 70.dp))
    }
}

@Composable
private fun BassWaveButton(text: String, selected: Boolean, compact: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        color = if (selected) VibeCoreColors.Primary else VibeCoreColors.Surface3,
        contentColor = if (selected) Color.Black else VibeCoreColors.Foreground,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, if (selected) VibeCoreColors.Primary else VibeCoreColors.Border),
        modifier = modifier.height(if (compact) 28.dp else 32.dp),
    ) {
        Box(modifier = Modifier.fillMaxSize().clickable(onClick = onClick), contentAlignment = Alignment.Center) {
            Text(text, fontWeight = FontWeight.Black, fontSize = if (compact) 8.sp else 9.sp)
        }
    }
}

@Composable
private fun VoiceMacroControls(
    volume: Float,
    dryWet: Float,
    pitchSemitones: Float,
    formantSemitones: Float,
    glideMs: Float,
    compact: Boolean,
    onVolume: (Float) -> Unit,
    onDryWet: (Float) -> Unit,
    onPitch: (Float) -> Unit,
    onFormant: (Float) -> Unit,
    onGlide: (Float) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(if (compact) 5.dp else 7.dp)) {
        Text("NATIVE VOICE MACROS", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = if (compact) 8.sp else 9.sp)
        BassSlider("VOL", "${(volume * 100f).toInt()}%", volume, 0f..1.5f, compact, onVolume)
        BassSlider("DRY", "${(dryWet * 100f).toInt()}%", dryWet, 0f..1f, compact, onDryWet)
        BassSlider("PIT", String.format("%.1fst", pitchSemitones), pitchSemitones, -24f..24f, compact, onPitch)
        BassSlider("FMT", String.format("%.1fst", formantSemitones), formantSemitones, -24f..24f, compact, onFormant)
        BassSlider("GLD", "${glideMs.toInt()}ms", glideMs, 0f..500f, compact, onGlide)
    }
}

@Composable
private fun ScenePanel(
    activeScene: Int,
    pendingScene: Int?,
    status: String,
    compact: Boolean,
    onScene: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Panel(modifier) {
        if (compact) {
            Row(
                modifier = Modifier.fillMaxSize().padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.width(420.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("SCENES", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Text("BAR-SYNCED NATIVE GROOVE QUEUE", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        PerformanceMeter("ACTIVE", (activeScene + 1).toString(), true, Modifier.weight(1f))
                        PerformanceMeter("PENDING", pendingScene?.plus(1)?.toString() ?: "--", true, Modifier.weight(1f))
                    }
                    Text(status, color = VibeCoreColors.Lime, fontFamily = FontFamily.Monospace, fontSize = 8.sp, maxLines = 2)
                }
                SceneGrid(activeScene, pendingScene, compact = true, onScene = onScene, modifier = Modifier.weight(1f).fillMaxHeight())
            }
        } else {
            Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("SCENES", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("BAR-SYNCED NATIVE GROOVE QUEUE", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PerformanceMeter("ACTIVE", (activeScene + 1).toString(), false, Modifier.weight(1f))
                    PerformanceMeter("PENDING", pendingScene?.plus(1)?.toString() ?: "--", false, Modifier.weight(1f))
                }
                Text(status, color = VibeCoreColors.Lime, fontFamily = FontFamily.Monospace, fontSize = 10.sp, maxLines = 1)
                SceneGrid(activeScene, pendingScene, compact = false, onScene = onScene, modifier = Modifier.fillMaxWidth().weight(1f))
            }
        }
    }
}

@Composable
private fun SceneGrid(
    activeScene: Int,
    pendingScene: Int?,
    compact: Boolean,
    onScene: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(2) { row ->
            Row(modifier = Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(4) { col ->
                    val scene = row * 4 + col
                    val active = activeScene == scene
                    val pending = pendingScene == scene && !active
                    Surface(
                        color = when {
                            active -> VibeCoreColors.Primary.copy(alpha = 0.28f)
                            pending -> VibeCoreColors.Amber.copy(alpha = 0.18f)
                            else -> VibeCoreColors.Surface2
                        },
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, when {
                            active -> VibeCoreColors.Primary
                            pending -> VibeCoreColors.Amber
                            else -> VibeCoreColors.Border
                        }),
                        modifier = Modifier.weight(1f).fillMaxHeight().clickable { onScene(scene) },
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Text("SCENE", color = VibeCoreColors.Muted, fontSize = if (compact) 8.sp else 9.sp)
                            Text((scene + 1).toString().padStart(2, '0'), color = VibeCoreColors.Foreground, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = if (compact) 18.sp else 22.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MixerPanel(
    tracks: List<TrackState>,
    selectedTrack: Int,
    compact: Boolean,
    onSelect: (Int) -> Unit,
    onVolume: (Int, Int) -> Unit,
    onMute: (Int) -> Unit,
    onSolo: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Panel(modifier) {
        Column(modifier = Modifier.fillMaxSize().padding(if (compact) 8.dp else 10.dp), verticalArrangement = Arrangement.spacedBy(if (compact) 5.dp else 8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                Text("MIXER", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = if (compact) 17.sp else 19.sp)
                Spacer(Modifier.width(10.dp))
                Text("16 PARTS • NATIVE GROOVE LEVELS", color = VibeCoreColors.Muted, fontSize = if (compact) 9.sp else 10.sp)
            }
            Column(modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 6.dp)) {
                tracks.forEachIndexed { index, track ->
                    MixerRow(
                        track = track,
                        selected = index == selectedTrack,
                        compact = compact,
                        onSelect = { onSelect(index) },
                        onVolume = { onVolume(index, it) },
                        onMute = { onMute(index) },
                        onSolo = { onSolo(index) },
                    )
                }
            }
        }
    }
}

@Composable
private fun MixerRow(
    track: TrackState,
    selected: Boolean,
    compact: Boolean,
    onSelect: () -> Unit,
    onVolume: (Int) -> Unit,
    onMute: () -> Unit,
    onSolo: () -> Unit,
) {
    Surface(
        color = if (selected) VibeCoreColors.Primary.copy(alpha = 0.08f) else VibeCoreColors.Surface2,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (selected) VibeCoreColors.Primary else VibeCoreColors.Border),
        modifier = Modifier
            .fillMaxWidth()
            .height(if (compact) 48.dp else 58.dp)
            .clickable(onClick = onSelect),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = if (compact) 3.dp else 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text(
                text = track.name,
                modifier = Modifier.width(if (compact) 86.dp else 72.dp),
                color = if (selected) VibeCoreColors.PrimaryGlow else VibeCoreColors.Foreground,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
            )
            Slider(
                value = track.volume.toFloat(),
                onValueChange = { onVolume(it.toInt()) },
                valueRange = 0f..127f,
                modifier = Modifier.weight(1f),
                colors = SliderDefaults.colors(
                    thumbColor = VibeCoreColors.Primary,
                    activeTrackColor = VibeCoreColors.Primary,
                    inactiveTrackColor = VibeCoreColors.SurfaceElevated,
                ),
            )
            Text(track.volume.toString(), color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 9.sp, modifier = Modifier.width(24.dp), textAlign = TextAlign.End)
            ToggleChip("M", track.muted, VibeCoreColors.Crimson, onMute)
            ToggleChip("S", track.soloed, VibeCoreColors.Amber, onSolo)
        }
    }
}

@Composable
private fun SampleForgePanel(
    tracks: List<TrackState>,
    selectedTrack: Int,
    busy: Boolean,
    status: String,
    compact: Boolean,
    onSelect: (Int) -> Unit,
    onChooseAudio: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val eligible = tracks.mapIndexedNotNull { index, track ->
        if (track.kind == TrackKind.DRUM || track.kind == TrackKind.SAMPLE) index to track else null
    }
    val selected = tracks[selectedTrack]
    Panel(modifier) {
        if (compact) {
            Row(
                modifier = Modifier.fillMaxSize().padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.width(520.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("SAMPLE FORGE", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 17.sp)
                    Text("ANDROID SAF -> MEDIACODEC -> MONO PCM -> NATIVE GROOVE", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp)
                    Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        eligible.forEach { (index, track) ->
                            val active = index == selectedTrack
                            Surface(
                                color = if (active) VibeCoreColors.Magenta.copy(alpha = 0.14f) else VibeCoreColors.Surface2,
                                shape = RoundedCornerShape(11.dp),
                                border = BorderStroke(1.dp, if (active) VibeCoreColors.Magenta else VibeCoreColors.Border),
                                modifier = Modifier.width(94.dp).height(38.dp).clickable { onSelect(index) },
                            ) { Box(contentAlignment = Alignment.Center) { Text(track.name, color = if (active) VibeCoreColors.Magenta else VibeCoreColors.Foreground, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1) } }
                        }
                    }
                }
                SampleAssetCard(
                    selected = selected,
                    status = status,
                    busy = busy,
                    onChooseAudio = onChooseAudio,
                    compact = true,
                    modifier = Modifier.fillMaxHeight().weight(1f),
                )
            }
        } else {
            Column(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("SAMPLE FORGE", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 19.sp)
                Text("ANDROID SAF → MEDIACODEC → MONO PCM → NATIVE GROOVE", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 9.sp)

                Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    eligible.forEach { (index, track) ->
                        val active = index == selectedTrack
                        Surface(
                            color = if (active) VibeCoreColors.Magenta.copy(alpha = 0.14f) else VibeCoreColors.Surface2,
                            shape = RoundedCornerShape(11.dp),
                            border = BorderStroke(1.dp, if (active) VibeCoreColors.Magenta else VibeCoreColors.Border),
                            modifier = Modifier.width(92.dp).height(44.dp).clickable { onSelect(index) },
                        ) { Box(contentAlignment = Alignment.Center) { Text(track.name, color = if (active) VibeCoreColors.Magenta else VibeCoreColors.Foreground, fontSize = 10.sp, fontWeight = FontWeight.Bold) } }
                    }
                }

                SampleAssetCard(
                    selected = selected,
                    status = status,
                    busy = busy,
                    onChooseAudio = onChooseAudio,
                    compact = false,
                    modifier = Modifier.fillMaxWidth().weight(1f),
                )
            }
        }
    }
}

@Composable
private fun SampleAssetCard(
    selected: TrackState,
    status: String,
    busy: Boolean,
    onChooseAudio: () -> Unit,
    compact: Boolean,
    modifier: Modifier = Modifier,
) {
    Surface(
        color = VibeCoreColors.Surface0,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, VibeCoreColors.Border),
        modifier = modifier,
    ) {
        Box(modifier = Modifier.fillMaxSize().padding(if (compact) 10.dp else 16.dp), contentAlignment = Alignment.Center) {
            if (compact) {
                val statusLine = if (selected.kind == TrackKind.DRUM || selected.kind == TrackKind.SAMPLE) {
                    status
                } else {
                    "Select a Drum/Sample track."
                }
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            selected.name,
                            color = VibeCoreColors.Foreground,
                            fontWeight = FontWeight.Black,
                            fontSize = 17.sp,
                            maxLines = 1,
                            modifier = Modifier.weight(1f),
                        )
                        Button(
                            onClick = onChooseAudio,
                            enabled = !busy && (selected.kind == TrackKind.DRUM || selected.kind == TrackKind.SAMPLE),
                            colors = ButtonDefaults.buttonColors(containerColor = VibeCoreColors.Magenta, contentColor = VibeCoreColors.Background),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.width(178.dp).height(38.dp),
                        ) { Text(if (busy) "LOADING..." else "CHOOSE AUDIO", fontWeight = FontWeight.Black, fontSize = 11.sp) }
                    }
                    Text(selected.sampleName ?: "NO SAMPLE ASSIGNED", color = if (selected.sampleName != null) VibeCoreColors.Lime else VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp, maxLines = 1)
                    Text(statusLine, color = VibeCoreColors.Muted, fontSize = 8.sp, maxLines = 1)
                }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(selected.name, color = VibeCoreColors.Foreground, fontWeight = FontWeight.Black, fontSize = 20.sp)
                    Text(selected.sampleName ?: "NO SAMPLE ASSIGNED", color = if (selected.sampleName != null) VibeCoreColors.Lime else VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                    Text(status, color = VibeCoreColors.Muted, textAlign = TextAlign.Center, fontSize = 10.sp)
                    Button(
                        onClick = onChooseAudio,
                        enabled = !busy && (selected.kind == TrackKind.DRUM || selected.kind == TrackKind.SAMPLE),
                        colors = ButtonDefaults.buttonColors(containerColor = VibeCoreColors.Magenta, contentColor = VibeCoreColors.Background),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.height(44.dp),
                    ) { Text(if (busy) "LOADING..." else "CHOOSE AUDIO", fontWeight = FontWeight.Black) }
                }
            }
        }
    }
}

@Composable
private fun PianoRollPanel(
    tracks: List<TrackState>,
    selectedTrack: Int,
    notesAdded: Int,
    status: String,
    compact: Boolean,
    onSelect: (Int) -> Unit,
    onAddNote: (Int) -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val eligible = tracks.mapIndexedNotNull { index, track ->
        if (track.kind == TrackKind.BASS || track.kind == TrackKind.SYNTH || track.kind == TrackKind.VOICE) index to track else null
    }
    val selected = tracks[selectedTrack]
    val notes = listOf(48 to "C2", 50 to "D2", 52 to "E2", 55 to "G2", 57 to "A2", 60 to "C3", 64 to "E3", 67 to "G3")

    Panel(modifier) {
        if (compact) {
            Row(
                modifier = Modifier.fillMaxSize().padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.width(520.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("PIANO ROLL", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                            Text("COMPOSE -> NATIVE GROOVE PIANO-ROLL NOTES", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp, maxLines = 1)
                        }
                        Button(
                            onClick = onClear,
                            colors = ButtonDefaults.buttonColors(containerColor = VibeCoreColors.Surface3, contentColor = VibeCoreColors.Foreground),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.height(34.dp),
                        ) { Text("CLEAR", fontWeight = FontWeight.Black, fontSize = 9.sp) }
                    }
                    Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        eligible.forEach { (index, track) ->
                            val active = index == selectedTrack
                            Surface(
                                color = if (active) VibeCoreColors.Violet.copy(alpha = 0.16f) else VibeCoreColors.Surface2,
                                shape = RoundedCornerShape(11.dp),
                                border = BorderStroke(1.dp, if (active) VibeCoreColors.Violet else VibeCoreColors.Border),
                                modifier = Modifier.width(106.dp).height(38.dp).clickable { onSelect(index) },
                            ) { Box(contentAlignment = Alignment.Center) { Text(track.name, color = if (active) VibeCoreColors.Violet else VibeCoreColors.Foreground, fontSize = 9.sp, fontWeight = FontWeight.Bold, maxLines = 1) } }
                        }
                    }
                    Text(
                        "$status | notes $notesAdded",
                        color = VibeCoreColors.Lime,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 2,
                    )
                }
                NoteGrid(notes, compact = true, onAddNote = onAddNote, modifier = Modifier.weight(1f).fillMaxHeight())
            }
        } else {
            Column(modifier = Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("PIANO ROLL", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("COMPOSE -> NATIVE GROOVE PIANO-ROLL NOTES", color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    eligible.forEach { (index, track) ->
                        val active = index == selectedTrack
                        Surface(
                            color = if (active) VibeCoreColors.Violet.copy(alpha = 0.16f) else VibeCoreColors.Surface2,
                            shape = RoundedCornerShape(11.dp),
                            border = BorderStroke(1.dp, if (active) VibeCoreColors.Violet else VibeCoreColors.Border),
                            modifier = Modifier.width(106.dp).height(42.dp).clickable { onSelect(index) },
                        ) { Box(contentAlignment = Alignment.Center) { Text(track.name, color = if (active) VibeCoreColors.Violet else VibeCoreColors.Foreground, fontSize = 10.sp, fontWeight = FontWeight.Bold) } }
                    }
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PerformanceMeter("TRACK", selected.name, false, Modifier.weight(1f))
                    PerformanceMeter("NOTES", notesAdded.toString(), false, Modifier.weight(1f))
                }
                Text(status, color = VibeCoreColors.Lime, fontFamily = FontFamily.Monospace, fontSize = 10.sp, maxLines = 1)
                Button(
                    onClick = onClear,
                    colors = ButtonDefaults.buttonColors(containerColor = VibeCoreColors.Surface3, contentColor = VibeCoreColors.Foreground),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.height(38.dp),
                ) { Text("CLEAR ROLL", fontWeight = FontWeight.Black, fontSize = 10.sp) }
                NoteGrid(notes, compact = false, onAddNote = onAddNote, modifier = Modifier.fillMaxWidth().weight(1f))
            }
        }
    }
}

@Composable
private fun NoteGrid(notes: List<Pair<Int, String>>, compact: Boolean, onAddNote: (Int) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(2) { row ->
            Row(modifier = Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                notes.drop(row * 4).take(4).forEach { (note, label) ->
                    Surface(
                        color = VibeCoreColors.Surface2,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, VibeCoreColors.Border),
                        modifier = Modifier.weight(1f).fillMaxHeight().clickable { onAddNote(note) },
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Text(label, color = VibeCoreColors.Foreground, fontWeight = FontWeight.Black, fontSize = if (compact) 15.sp else 18.sp)
                            Text(note.toString(), color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PerformanceKeyboardPanel(
    title: String,
    detail: String,
    status: String,
    activeNote: Int?,
    activeVoices: Int,
    outputLevel: Float,
    compact: Boolean,
    enabled: Boolean,
    screen: NativeScreen,
    onNoteOn: (Int, NativeScreen) -> Unit,
    onNoteOff: (Int, NativeScreen) -> Unit,
    onAllNotesOff: () -> Unit,
    extraControls: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val notes = listOf(
        48 to "C2",
        50 to "D2",
        52 to "E2",
        53 to "F2",
        55 to "G2",
        57 to "A2",
        59 to "B2",
        60 to "C3",
        62 to "D3",
        64 to "E3",
        65 to "F3",
        67 to "G3",
    )

    Panel(modifier) {
        if (compact) {
            Row(
                modifier = Modifier.fillMaxSize().padding(10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                val infoModifier = Modifier
                    .width(if (extraControls == null) 520.dp else 380.dp)
                    .then(if (extraControls == null) Modifier else Modifier.verticalScroll(rememberScrollState()))
                Column(modifier = infoModifier, verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(title, color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                            Text(detail, color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp, maxLines = 1)
                        }
                        Button(
                            onClick = onAllNotesOff,
                            colors = ButtonDefaults.buttonColors(containerColor = VibeCoreColors.Surface3, contentColor = VibeCoreColors.Foreground),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.height(34.dp),
                        ) { Text("ALL OFF", fontWeight = FontWeight.Black, fontSize = 9.sp) }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                        PerformanceMeter("VOICES", activeVoices.toString(), true, Modifier.weight(1f))
                        PerformanceMeter("LEVEL", "${(outputLevel * 100f).toInt().coerceIn(0, 100)}%", true, Modifier.weight(1f))
                        PerformanceMeter("ACTIVE", activeNote?.toString() ?: "--", true, Modifier.weight(1f))
                    }
                    Text(
                        status,
                        color = if (enabled) VibeCoreColors.Lime else VibeCoreColors.Amber,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 8.sp,
                        maxLines = 2,
                    )
                    extraControls?.invoke()
                }
                Column(modifier = Modifier.fillMaxHeight().weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(2) { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            notes.drop(row * 6).take(6).forEach { (note, label) ->
                                PerformanceKey(
                                    note = note,
                                    label = label,
                                    active = activeNote == note,
                                    enabled = enabled,
                                    compact = true,
                                    onNoteOn = { onNoteOn(note, screen) },
                                    onNoteOff = { onNoteOff(note, screen) },
                                    modifier = Modifier.weight(1f).fillMaxHeight(),
                                )
                            }
                        }
                    }
                }
            }
        } else {
            Column(
                modifier = Modifier.fillMaxSize().padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(title, color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 22.sp)
                        Text(detail, color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 10.sp, maxLines = 1)
                    }
                    Button(
                        onClick = onAllNotesOff,
                        colors = ButtonDefaults.buttonColors(containerColor = VibeCoreColors.Surface3, contentColor = VibeCoreColors.Foreground),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.height(42.dp),
                    ) { Text("ALL OFF", fontWeight = FontWeight.Black, fontSize = 10.sp) }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PerformanceMeter("VOICES", activeVoices.toString(), false, Modifier.weight(1f))
                    PerformanceMeter("LEVEL", "${(outputLevel * 100f).toInt().coerceIn(0, 100)}%", false, Modifier.weight(1f))
                    PerformanceMeter("ACTIVE", activeNote?.toString() ?: "--", false, Modifier.weight(1f))
                }

                Text(
                    status,
                    color = if (enabled) VibeCoreColors.Lime else VibeCoreColors.Amber,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    maxLines = 1,
                )

                extraControls?.invoke()

                Column(modifier = Modifier.fillMaxWidth().weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(2) { row ->
                        Row(
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            notes.drop(row * 6).take(6).forEach { (note, label) ->
                                PerformanceKey(
                                    note = note,
                                    label = label,
                                    active = activeNote == note,
                                    enabled = enabled,
                                    compact = false,
                                    onNoteOn = { onNoteOn(note, screen) },
                                    onNoteOff = { onNoteOff(note, screen) },
                                    modifier = Modifier.weight(1f).fillMaxHeight(),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PerformanceMeter(label: String, value: String, compact: Boolean, modifier: Modifier = Modifier) {
    Surface(
        color = VibeCoreColors.Surface0,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, VibeCoreColors.Border),
        modifier = modifier.height(if (compact) 42.dp else 50.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(value, color = VibeCoreColors.Foreground, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = if (compact) 12.sp else 14.sp)
            Text(label, color = VibeCoreColors.Muted, fontSize = 8.sp)
        }
    }
}

@Composable
private fun PerformanceKey(
    note: Int,
    label: String,
    active: Boolean,
    enabled: Boolean,
    compact: Boolean,
    onNoteOn: () -> Unit,
    onNoteOff: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val keyColor = when {
        active -> VibeCoreColors.Primary.copy(alpha = 0.32f)
        enabled -> VibeCoreColors.Surface2
        else -> VibeCoreColors.Surface0
    }
    Surface(
        color = keyColor,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (active) VibeCoreColors.Primary else VibeCoreColors.Border),
        modifier = modifier.pointerInput(note, enabled) {
            detectTapGestures(
                onPress = {
                    onNoteOn()
                    tryAwaitRelease()
                    onNoteOff()
                },
            )
        },
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(label, color = if (enabled) VibeCoreColors.Foreground else VibeCoreColors.Muted, fontWeight = FontWeight.Black, fontSize = if (compact) 14.sp else 16.sp)
            Text(note.toString(), color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp)
        }
    }
}

@Composable
private fun MigrationPlaceholder(title: String, detail: String, modifier: Modifier = Modifier) {
    Panel(modifier) {
        Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(title, color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 22.sp)
                Text("PURE ANDROID MIGRATION", color = VibeCoreColors.Magenta, fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                Text(detail, color = VibeCoreColors.Muted, textAlign = TextAlign.Center, fontSize = 12.sp)
                Text("Golden Master UI remains the parity reference.", color = VibeCoreColors.Foreground, fontSize = 11.sp)
            }
        }
    }
}

@Composable
private fun StepCell(number: Int, active: Boolean, playing: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    val border = when { playing -> VibeCoreColors.Magenta; active -> VibeCoreColors.Primary; else -> VibeCoreColors.Border }
    val fill = if (active) Brush.linearGradient(listOf(VibeCoreColors.Primary, Color(0xFF276CFF))) else Brush.linearGradient(listOf(VibeCoreColors.Surface3, VibeCoreColors.Surface2))
    Box(
        modifier = modifier.shadow(if (active) 8.dp else 1.dp, StepShape).background(fill, StepShape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Surface(color = Color.Transparent, shape = StepShape, border = BorderStroke(if (playing) 2.dp else 1.dp, border), modifier = Modifier.fillMaxSize()) {
            Box(contentAlignment = Alignment.Center) {
                Text(number.toString().padStart(2, '0'), color = if (active) VibeCoreColors.Background else VibeCoreColors.Foreground, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = if (compact) 12.sp else 14.sp)
            }
        }
    }
}

@Composable
private fun BottomModeBar(selected: NativeScreen, onSelect: (NativeScreen) -> Unit) {
    Panel {
        Row(modifier = Modifier.fillMaxWidth().padding(4.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            NativeScreen.entries.forEach { screen ->
                val active = selected == screen
                Text(
                    screen.name,
                    color = if (active) VibeCoreColors.Primary else VibeCoreColors.Muted,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    fontSize = 10.sp,
                    modifier = Modifier.clickable { onSelect(screen) }.padding(horizontal = 7.dp, vertical = 9.dp),
                )
            }
        }
    }
}

@Composable
private fun DiagnosticBar(text: String, engineRunning: Boolean) {
    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(7.dp).background(if (engineRunning) VibeCoreColors.Lime else VibeCoreColors.Muted, RoundedCornerShape(50)))
        Spacer(Modifier.width(6.dp))
        Text(text, color = VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 9.sp, maxLines = 1)
    }
}

@Composable
private fun Panel(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(color = VibeCoreColors.Surface1, shape = PanelShape, border = BorderStroke(1.dp, VibeCoreColors.Border), modifier = modifier.fillMaxWidth(), content = content)
}

@Composable
private fun NeonMiniButton(text: String, compact: Boolean = false, onClick: () -> Unit) {
    Surface(color = VibeCoreColors.Surface2, shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, VibeCoreColors.Border), modifier = Modifier.size(if (compact) 32.dp else 36.dp).clickable(onClick = onClick)) {
        Box(contentAlignment = Alignment.Center) { Text(text, color = VibeCoreColors.Primary, fontWeight = FontWeight.Bold, fontSize = if (compact) 16.sp else 18.sp) }
    }
}

@Composable
private fun ToggleChip(label: String, active: Boolean, accent: Color, onClick: () -> Unit) {
    Surface(
        color = if (active) accent.copy(alpha = 0.2f) else VibeCoreColors.Surface2,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, if (active) accent else VibeCoreColors.Border),
        modifier = Modifier.size(38.dp).clickable(onClick = onClick),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                label,
                color = if (active) accent else VibeCoreColors.Muted,
                fontWeight = FontWeight.Black,
                fontSize = 16.sp,
                lineHeight = 16.sp,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
        }
    }
}
