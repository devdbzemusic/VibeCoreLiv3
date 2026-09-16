import type {
  NativePpq1920Tick,
  SixteenthStep,
} from "./timing";

export type RuntimeKind = "webaudio" | "oboe-native";

export interface RuntimeBackendInfo {
  kind: RuntimeKind;
  available: boolean;
  active: boolean;
  diagnostic: string;
}

export interface RuntimeSeekPosition {
  patternId: number;
  sceneIdx: number;
  step: SixteenthStep;
  nativeTick?: NativePpq1920Tick;
}

export interface RuntimeNoteInput {
  partId: number;
  midiNote: number;
  velocity: number;
  gateSec?: number;
  source?: "touch" | "midi" | "arp" | "motion" | "sequencer" | "preview";
}

export interface RuntimeSampleTrigger {
  partId: number;
  velocity: number;
  region?: { start01: number; end01: number };
}

export interface RuntimeTransport {
  play(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
  seek(position: RuntimeSeekPosition): Promise<void>;
  setTempo(bpm: number): Promise<void>;
}

export interface RuntimePerformanceInput {
  noteOn(input: RuntimeNoteInput): Promise<void>;
  noteOff(input: Pick<RuntimeNoteInput, "partId" | "midiNote" | "source">): Promise<void>;
  allNotesOff(partId?: number): Promise<void>;
  triggerSample(input: RuntimeSampleTrigger): Promise<void>;
}

export interface RuntimeDiagnostics {
  backendInfo(): RuntimeBackendInfo;
  latencyMs(): number | null;
  xruns(): number | null;
}

export interface VibeCoreRuntimeAdapter {
  readonly kind: RuntimeKind;
  readonly transport: RuntimeTransport;
  readonly performanceInput: RuntimePerformanceInput;
  readonly diagnostics: RuntimeDiagnostics;
  start(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  shutdown(): Promise<void>;
}
