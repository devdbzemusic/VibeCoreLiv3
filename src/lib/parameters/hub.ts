import { useGroove } from "@/lib/store";

export type ParameterId =
  | "transport.bpm"
  | "master.volume"
  | `part.${number}.volume`
  | `part.${number}.pan`;

export interface ParameterDescriptor {
  id: ParameterId;
  min: number;
  max: number;
  step: number;
  unit: string;
  persistent: boolean;
  realtime: boolean;
}

export type ParameterListener = (value: number, previous: number) => void;

const STATIC_DESCRIPTORS: Record<"transport.bpm" | "master.volume", ParameterDescriptor> = {
  "transport.bpm": {
    id: "transport.bpm",
    min: 20,
    max: 300,
    step: 0.1,
    unit: "BPM",
    persistent: true,
    realtime: true,
  },
  "master.volume": {
    id: "master.volume",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
    persistent: true,
    realtime: true,
  },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parsePartParameter(id: ParameterId): { partId: number; key: "volume" | "pan" } | null {
  const match = /^part\.(\d+)\.(volume|pan)$/.exec(id);
  if (!match) return null;
  return { partId: Number(match[1]), key: match[2] as "volume" | "pan" };
}

/**
 * Parameter Hub v1 foundation.
 *
 * This module deliberately owns NO parameter values. It proxies the existing
 * authoritative Zustand project state and its actions, so introducing the Hub
 * cannot create a second state store.
 */
export function getParameterDescriptor(id: ParameterId): ParameterDescriptor | null {
  if (id === "transport.bpm" || id === "master.volume") return STATIC_DESCRIPTORS[id];

  const part = parsePartParameter(id);
  if (!part) return null;
  if (part.key === "volume") {
    return {
      id,
      min: 0,
      max: 100,
      step: 1,
      unit: "%",
      persistent: true,
      realtime: true,
    };
  }
  return {
    id,
    min: -50,
    max: 50,
    step: 1,
    unit: "",
    persistent: true,
    realtime: true,
  };
}

export function getParameter(id: ParameterId): number | null {
  const state = useGroove.getState();
  if (id === "transport.bpm") return state.bpm;
  if (id === "master.volume") return state.masterVolume;

  const parsed = parsePartParameter(id);
  if (!parsed) return null;
  const part = state.parts.find((candidate) => candidate.id === parsed.partId);
  if (!part) return null;
  return parsed.key === "volume" ? part.volume : part.pan;
}

export function setParameter(id: ParameterId, rawValue: number): boolean {
  const descriptor = getParameterDescriptor(id);
  if (!descriptor) return false;
  const value = clamp(rawValue, descriptor.min, descriptor.max);
  const state = useGroove.getState();

  if (id === "transport.bpm") {
    state.setBpm(value);
    return true;
  }
  if (id === "master.volume") {
    state.setMasterVolume(value);
    return true;
  }

  const parsed = parsePartParameter(id);
  if (!parsed) return false;
  if (!state.parts.some((part) => part.id === parsed.partId)) return false;

  if (parsed.key === "volume") state.setPartVolume(parsed.partId, value);
  else state.setPartPan(parsed.partId, value);
  return true;
}

/**
 * Selective parameter subscription using the existing store subscription.
 * The listener fires only when this specific parameter value changes.
 */
export function subscribeParameter(id: ParameterId, listener: ParameterListener): () => void {
  let previous = getParameter(id);
  return useGroove.subscribe(() => {
    const next = getParameter(id);
    if (next == null || previous == null) {
      previous = next;
      return;
    }
    if (Object.is(next, previous)) return;
    const before = previous;
    previous = next;
    listener(next, before);
  });
}

/**
 * Gesture hooks are part of the stable Parameter-Hub contract. They are no-op
 * in v1 because undo/automation gesture batching is not yet centralized.
 * Keeping them stateless prevents a hidden gesture store from appearing here.
 */
export function beginParameterGesture(_id: ParameterId): void {}
export function endParameterGesture(_id: ParameterId): void {}
