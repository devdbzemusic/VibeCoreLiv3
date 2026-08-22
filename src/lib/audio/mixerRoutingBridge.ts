/**
 * Store → audio routing bridge.
 *
 * This deliberately contains no Web Audio or Zustand dependencies. The engine
 * uses it both when a live store slice changes and when a newly-built graph
 * needs to be hydrated from persisted mixer state.
 */

export interface MixerRoutingSnapshot {
  partBusAssignments?: Readonly<Record<number, number | null>> | Readonly<Record<string, number | null>>;
  parts?: ReadonlyArray<{ id: number; busTarget?: number | null }>;
  busLevels?: ReadonlyArray<{ volume: number; mute: boolean }>;
}

export interface MixerRoutingControls {
  routePartMainToBus: (partId: number, busIdx: number | null) => void;
  setBusChannelLevel: (busIdx: number, volumeLinear: number, mute: boolean) => void;
}

/**
 * Apply every persisted mixer routing value to the concrete engine controls.
 *
 * `partBusAssignments` is the authoritative map. The per-Part `busTarget`
 * fallback keeps older persisted projects routable when they predate the map.
 */
export function applyMixerRoutingSnapshot(
  snapshot: MixerRoutingSnapshot,
  controls: MixerRoutingControls,
): void {
  const assignments: Record<string, number | null> = {
    ...((snapshot.partBusAssignments ?? {}) as Record<string, number | null>),
  };

  for (const part of snapshot.parts ?? []) {
    const key = String(part.id);
    if (!Object.prototype.hasOwnProperty.call(assignments, key) && part.busTarget !== undefined) {
      assignments[key] = part.busTarget ?? null;
    }
  }

  Object.entries(assignments).forEach(([partId, busIdx]) => {
    controls.routePartMainToBus(Number(partId), busIdx);
  });

  (snapshot.busLevels ?? []).forEach((bus, busIdx) => {
    controls.setBusChannelLevel(busIdx, bus.volume / 100, bus.mute);
  });
}