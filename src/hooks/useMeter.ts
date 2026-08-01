// VibeCoreLiv3 — useMeter hook
// =====================================================================
// React adapter for the non-React meter bus.
//
// Usage:
//   const peakL = useMeter((s) => s.peakL);
//   const peak  = useMeter((s) => s.partPeaks[partId] ?? 0);
//
// The hook re-renders only when the selected primitive changes
// (Object.is equality). Returning an Array/Object from the selector
// will cause a render on every publish – prefer primitive selectors.
// =====================================================================

import { useEffect, useSyncExternalStore } from "react";
import {
  getMeterSnapshot,
  subscribeMeter,
  setPartVisible,
  type MeterSnapshot,
} from "@/lib/audio/meterBus";

export function useMeter<T>(selector: (s: MeterSnapshot) => T): T {
  return useSyncExternalStore(
    subscribeMeter,
    () => selector(getMeterSnapshot()),
    () => selector(getMeterSnapshot()),
  );
}

/** Register a part as visible while the component is mounted.
 *  The engine uses this to skip analyser reads for off-screen parts. */
export function useVisiblePart(id: number | null | undefined): void {
  useEffect(() => {
    if (id == null) return;
    setPartVisible(id, true);
    return () => setPartVisible(id, false);
  }, [id]);
}

/** Register every part in `ids` as visible. Used by Mix / Sound tabs
 *  that render all 16 part meters at once. */
export function useVisibleParts(ids: readonly number[]): void {
  useEffect(() => {
    ids.forEach((id) => setPartVisible(id, true));
    return () => { ids.forEach((id) => setPartVisible(id, false)); };
    // ids is a stable array of part ids derived from `parts.map(p => p.id)`,
    // which only changes if the user adds/removes parts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.length, ids.join(",")]);
}
