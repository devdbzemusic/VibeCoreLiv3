import { useGroove } from "@/lib/store";

export type CoreParameterId =
  | "transport.bpm"
  | "master.volume"
  | `part.${number}.volume`
  | `part.${number}.pan`;

export type ParameterValue = number;

export interface ParameterGesture {
  id: number;
  parameter: CoreParameterId;
}

export interface ParameterSetOptions {
  source?: "ui" | "midi" | "automation" | "ai" | "preset" | "runtime";
  gesture?: ParameterGesture;
}

type GrooveState = ReturnType<typeof useGroove.getState>;

let gestureCounter = 0;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parsePartParameter(id: CoreParameterId): { partId: number; field: "volume" | "pan" } | null {
  const match = /^part\.(\d+)\.(volume|pan)$/.exec(id);
  if (!match) return null;
  return {
    partId: Number(match[1]),
    field: match[2] as "volume" | "pan",
  };
}

function valueFromState(state: GrooveState, id: CoreParameterId): ParameterValue | undefined {
  if (id === "transport.bpm") return state.bpm;
  if (id === "master.volume") return state.masterVolume;

  const parsed = parsePartParameter(id);
  if (!parsed) return undefined;
  const part = state.parts.find((candidate) => candidate.id === parsed.partId);
  if (!part) return undefined;
  return parsed.field === "volume" ? part.volume : part.pan;
}

/**
 * ParameterHub v1 intentionally owns NO parameter values.
 *
 * The canonical Zustand project state remains authoritative. This module only
 * provides a typed get/set/subscribe route so UI, MIDI, automation and AI can
 * converge on one parameter command surface without introducing a second store.
 */
export function getParameter(id: CoreParameterId): ParameterValue | undefined {
  return valueFromState(useGroove.getState(), id);
}

export function setParameter(
  id: CoreParameterId,
  value: ParameterValue,
  _options: ParameterSetOptions = {},
): boolean {
  const state = useGroove.getState();

  if (id === "transport.bpm") {
    state.setBpm(clamp(value, 20, 300));
    return true;
  }
  if (id === "master.volume") {
    state.setMasterVolume(clamp(value, 0, 100));
    return true;
  }

  const parsed = parsePartParameter(id);
  if (!parsed) return false;
  const exists = state.parts.some((part) => part.id === parsed.partId);
  if (!exists) return false;

  if (parsed.field === "volume") {
    state.setPartVolume(parsed.partId, clamp(value, 0, 100));
  } else {
    state.setPartPan(parsed.partId, clamp(value, -50, 50));
  }
  return true;
}

/**
 * Subscribe to one parameter only. Store writes unrelated to the parameter do
 * not invoke the consumer callback.
 */
export function subscribeParameter(
  id: CoreParameterId,
  listener: (value: ParameterValue) => void,
): () => void {
  let previous = valueFromState(useGroove.getState(), id);
  return useGroove.subscribe((state) => {
    const next = valueFromState(state, id);
    if (next === undefined || Object.is(next, previous)) return;
    previous = next;
    listener(next);
  });
}

/**
 * Gesture tokens are correlation metadata only in v1. They do not create an
 * undo stack, automation lane, persistence layer or hidden gesture state.
 */
export function beginParameterGesture(parameter: CoreParameterId): ParameterGesture {
  return { id: ++gestureCounter, parameter };
}

export function endParameterGesture(_gesture: ParameterGesture): void {
  // Contract placeholder. Undo/automation integration is deliberately deferred
  // until one authoritative command-history model is selected.
}
