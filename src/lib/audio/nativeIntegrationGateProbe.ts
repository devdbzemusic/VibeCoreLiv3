import { activateNativeAudio, getNativeAudioBackend, getNativeAudioStatus } from "./nativeAudioRuntime";

export interface NativeIntegrationGateProbeStep {
  name: string;
  pass: boolean;
  detail: string;
}

export interface NativeIntegrationGateProbeReport {
  gate: "ONE_ENGINE_WEB_NATIVE_P1";
  pass: boolean;
  startedAt: string;
  finishedAt: string;
  backendKind: "oboe-native" | "unavailable";
  latencyMs: number;
  diagnostic: string;
  steps: NativeIntegrationGateProbeStep[];
}

export interface NativeIntegrationGateProbeOptions {
  tempoBpm?: number;
  noteMs?: number;
}

const DEFAULT_TEMPO = 123;
const DEFAULT_NOTE_MS = 180;
const PROBE_SAMPLE_RATE = 48_000;
const PROBE_NOTE = 60;
const PROBE_SLOT = 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeProbeSample(): Float32Array {
  const frameCount = Math.round(PROBE_SAMPLE_RATE * 0.08);
  const data = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i += 1) {
    const env = 1 - i / frameCount;
    data[i] = Math.sin((2 * Math.PI * 440 * i) / PROBE_SAMPLE_RATE) * env * 0.18;
  }
  return data;
}

function pushStep(
  steps: NativeIntegrationGateProbeStep[],
  name: string,
  pass: boolean,
  detail: string
): void {
  steps.push({ name, pass, detail });
}

/**
 * WebView-only P1 probe for the One-Engine gate.
 *
 * The probe deliberately uses the TS adapter (`activateNativeAudio` +
 * `NativeOboeBackend`) instead of calling `window.VibeCoreNative` directly.
 * That makes the result suitable as evidence for the actual app path:
 * transport, tempo, diagnostics, sample load, note-on and note-off all cross
 * the same adapter contract used by the UI.
 */
export async function runNativeIntegrationGateProbe(
  options: NativeIntegrationGateProbeOptions = {}
): Promise<NativeIntegrationGateProbeReport> {
  const startedAt = new Date().toISOString();
  const steps: NativeIntegrationGateProbeStep[] = [];
  const tempo = options.tempoBpm ?? DEFAULT_TEMPO;
  const noteMs = options.noteMs ?? DEFAULT_NOTE_MS;

  try {
    const before = getNativeAudioStatus();
    pushStep(steps, "native bridge available", before.available, before.diagnostic);
    if (!before.available) {
      return {
        gate: "ONE_ENGINE_WEB_NATIVE_P1",
        pass: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        backendKind: "unavailable",
        latencyMs: before.latencyMs,
        diagnostic: before.diagnostic,
        steps,
      };
    }

    const activated = await activateNativeAudio();
    const backend = getNativeAudioBackend();
    pushStep(steps, "activate native backend", activated && backend?.kind === "oboe-native", backend?.kind ?? "missing backend");

    if (!activated || !backend) {
      const failed = getNativeAudioStatus();
      return {
        gate: "ONE_ENGINE_WEB_NATIVE_P1",
        pass: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        backendKind: "unavailable",
        latencyMs: failed.latencyMs,
        diagnostic: failed.error ?? failed.diagnostic,
        steps,
      };
    }

    backend.setTempo(tempo);
    pushStep(steps, "tempo roundtrip", Math.abs(backend.getTempo() - tempo) < 0.001, `tempo=${backend.getTempo()}`);

    backend.setMasterGain(0.65);
    backend.setPosition(0);
    backend.play();
    await wait(60);
    pushStep(steps, "transport play", backend.isPlaying(), `tick=${backend.getCurrentTick()}`);

    await backend.loadVoiceSample(PROBE_SLOT, makeProbeSample(), PROBE_SAMPLE_RATE, PROBE_NOTE);
    backend.noteOn(PROBE_NOTE, 104, PROBE_SLOT, -1);
    await wait(noteMs);
    backend.noteOff(PROBE_NOTE);
    backend.allNotesOff();
    pushStep(steps, "voice sample and note path", true, `slot=${PROBE_SLOT} note=${PROBE_NOTE}`);

    await backend.stop();
    pushStep(steps, "transport stop", !backend.isPlaying(), `tick=${backend.getCurrentTick()}`);

    const after = getNativeAudioStatus();
    pushStep(steps, "native diagnostics", after.engineRunning && after.latencyMs > 0, after.diagnostic);

    return {
      gate: "ONE_ENGINE_WEB_NATIVE_P1",
      pass: steps.every((step) => step.pass),
      startedAt,
      finishedAt: new Date().toISOString(),
      backendKind: "oboe-native",
      latencyMs: after.latencyMs,
      diagnostic: after.error ?? after.diagnostic,
      steps,
    };
  } catch (error) {
    const backend = getNativeAudioBackend();
    try {
      backend?.allNotesOff();
      await backend?.stop();
    } catch {
      // Best-effort safety cleanup; the original probe failure remains below.
    }
    pushStep(steps, "probe exception", false, error instanceof Error ? error.message : String(error));
    const status = getNativeAudioStatus();
    return {
      gate: "ONE_ENGINE_WEB_NATIVE_P1",
      pass: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      backendKind: status.active ? "oboe-native" : "unavailable",
      latencyMs: status.latencyMs,
      diagnostic: status.error ?? status.diagnostic,
      steps,
    };
  }
}

declare global {
  interface Window {
    runNativeIntegrationGateProbe?: typeof runNativeIntegrationGateProbe;
  }
}

if (typeof window !== "undefined") {
  window.runNativeIntegrationGateProbe = runNativeIntegrationGateProbe;
}
