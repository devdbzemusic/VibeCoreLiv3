package com.vibecore.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
        if (uri != null) viewModel.loadSampleForSelected(uri)
    }

    VibeCoreTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(listOf(VibeCoreColors.Surface2, VibeCoreColors.Background)))
                .padding(10.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TransportPanel(
                    bpm = state.bpm,
                    playing = state.playing,
                    nativeAvailable = state.nativeAvailable,
                    engineRunning = state.engineRunning,
                    latencyMs = state.latencyMs,
                    onPlay = viewModel::togglePlay,
                    onTempoDown = { viewModel.nudgeTempo(-1.0) },
                    onTempoUp = { viewModel.nudgeTempo(1.0) },
                )

                when (state.screen) {
                    NativeScreen.PATTERN -> {
                        TrackStrip(state.tracks, state.selectedTrack, viewModel::selectTrack)
                        PatternPanel(
                            track = state.tracks[state.selectedTrack],
                            currentStep = state.currentStep,
                            onToggleStep = viewModel::toggleStep,
                            onMute = { viewModel.toggleMute() },
                            onSolo = { viewModel.toggleSolo() },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    NativeScreen.MIXER -> MixerPanel(
                        tracks = state.tracks,
                        selectedTrack = state.selectedTrack,
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
                        onSelect = viewModel::selectTrack,
                        onChooseAudio = { samplePicker.launch(arrayOf("audio/*")) },
                        modifier = Modifier.weight(1f),
                    )
                    NativeScreen.SYNTH -> MigrationPlaceholder(
                        "SYNTH 3D",
                        "Visual parity remains the target; a native Synth3D renderer is the next missing audio core.",
                        Modifier.weight(1f),
                    )
                    NativeScreen.VOICE -> MigrationPlaceholder(
                        "VOICE",
                        "Native Voice DSP already exists; Compose controls are not yet ported.",
                        Modifier.weight(1f),
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
    onPlay: () -> Unit,
    onTempoDown: () -> Unit,
    onTempoUp: () -> Unit,
) {
    Panel {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("VIBECORE LIVE", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp, fontSize = 17.sp)
                    Text(
                        if (nativeAvailable) "PURE ANDROID • OBOE" else "NATIVE CORE OFFLINE",
                        color = if (nativeAvailable) VibeCoreColors.Lime else VibeCoreColors.Crimson,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                    )
                }
                NeonMiniButton("−", onTempoDown)
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(String.format("%.0f", bpm), color = VibeCoreColors.Foreground, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, fontSize = 22.sp)
                    Text("BPM", color = VibeCoreColors.Muted, fontSize = 9.sp)
                }
                NeonMiniButton("+", onTempoUp)
                Button(
                    onClick = onPlay,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (playing) VibeCoreColors.Magenta else VibeCoreColors.Primary,
                        contentColor = VibeCoreColors.Background,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.height(48.dp),
                ) { Text(if (playing) "STOP" else "PLAY", fontWeight = FontWeight.Black) }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 5.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    if (engineRunning) "ENGINE RUNNING" else "ENGINE IDLE",
                    color = if (engineRunning) VibeCoreColors.Lime else VibeCoreColors.Muted,
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
private fun TrackStrip(tracks: List<TrackState>, selected: Int, onSelect: (Int) -> Unit) {
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
                modifier = Modifier.width(84.dp).height(44.dp).clickable { onSelect(index) },
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
    onToggleStep: (Int) -> Unit,
    onMute: () -> Unit,
    onSolo: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Panel(modifier) {
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

@Composable
private fun MixerPanel(
    tracks: List<TrackState>,
    selectedTrack: Int,
    onSelect: (Int) -> Unit,
    onVolume: (Int, Int) -> Unit,
    onMute: (Int) -> Unit,
    onSolo: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Panel(modifier) {
        Column(modifier = Modifier.fillMaxSize().padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("MIXER", color = VibeCoreColors.Primary, fontWeight = FontWeight.Black, fontSize = 19.sp)
            Text("16 PARTS • NATIVE GROOVE LEVELS", color = VibeCoreColors.Muted, fontSize = 10.sp)
            Column(modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                tracks.forEachIndexed { index, track ->
                    MixerRow(
                        track = track,
                        selected = index == selectedTrack,
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
    onSelect: () -> Unit,
    onVolume: (Int) -> Unit,
    onMute: () -> Unit,
    onSolo: () -> Unit,
) {
    Surface(
        color = if (selected) VibeCoreColors.Primary.copy(alpha = 0.08f) else VibeCoreColors.Surface2,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (selected) VibeCoreColors.Primary else VibeCoreColors.Border),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onSelect),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text(
                text = track.name,
                modifier = Modifier.width(72.dp),
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
    onSelect: (Int) -> Unit,
    onChooseAudio: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val eligible = tracks.mapIndexedNotNull { index, track ->
        if (track.kind == TrackKind.DRUM || track.kind == TrackKind.SAMPLE) index to track else null
    }
    val selected = tracks[selectedTrack]
    Panel(modifier) {
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

            Surface(
                color = VibeCoreColors.Surface0,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, VibeCoreColors.Border),
                modifier = Modifier.fillMaxWidth().weight(1f),
            ) {
                Box(modifier = Modifier.fillMaxSize().padding(20.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(selected.name, color = VibeCoreColors.Foreground, fontWeight = FontWeight.Black, fontSize = 22.sp)
                        Text(selected.sampleName ?: "NO SAMPLE ASSIGNED", color = if (selected.sampleName != null) VibeCoreColors.Lime else VibeCoreColors.Muted, fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                        Text(status, color = VibeCoreColors.Muted, textAlign = TextAlign.Center, fontSize = 11.sp)
                        Button(
                            onClick = onChooseAudio,
                            enabled = !busy && (selected.kind == TrackKind.DRUM || selected.kind == TrackKind.SAMPLE),
                            colors = ButtonDefaults.buttonColors(containerColor = VibeCoreColors.Magenta, contentColor = VibeCoreColors.Background),
                            shape = RoundedCornerShape(12.dp),
                        ) { Text(if (busy) "LOADING…" else "CHOOSE AUDIO", fontWeight = FontWeight.Black) }
                    }
                }
            }
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
private fun StepCell(number: Int, active: Boolean, playing: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val border = when { playing -> VibeCoreColors.Magenta; active -> VibeCoreColors.Primary; else -> VibeCoreColors.Border }
    val fill = if (active) Brush.linearGradient(listOf(VibeCoreColors.Primary, Color(0xFF276CFF))) else Brush.linearGradient(listOf(VibeCoreColors.Surface3, VibeCoreColors.Surface2))
    Box(
        modifier = modifier.shadow(if (active) 8.dp else 1.dp, StepShape).background(fill, StepShape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Surface(color = Color.Transparent, shape = StepShape, border = BorderStroke(if (playing) 2.dp else 1.dp, border), modifier = Modifier.fillMaxSize()) {
            Box(contentAlignment = Alignment.Center) {
                Text(number.toString().padStart(2, '0'), color = if (active) VibeCoreColors.Background else VibeCoreColors.Foreground, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black, fontSize = 14.sp)
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
private fun NeonMiniButton(text: String, onClick: () -> Unit) {
    Surface(color = VibeCoreColors.Surface2, shape = RoundedCornerShape(10.dp), border = BorderStroke(1.dp, VibeCoreColors.Border), modifier = Modifier.size(36.dp).clickable(onClick = onClick)) {
        Box(contentAlignment = Alignment.Center) { Text(text, color = VibeCoreColors.Primary, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
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
            Text(label, color = if (active) accent else VibeCoreColors.Muted, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
        }
    }
}
