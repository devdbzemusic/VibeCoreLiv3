import { useEffect, useRef, useState } from "react";
import {
  ENGINE_BOUNDARY_REJECTED_EVENT,
  SOURCE_BOUNDARY_REJECTED_EVENT,
  type EngineBoundaryRejectedDetail,
  type SourceBoundaryRejectedDetail,
} from "@/lib/instruments/sourceRuntimeGuard";

const HIDE_AFTER_MS = 3200;

type BoundaryNotice =
  | { kind: "source"; detail: SourceBoundaryRejectedDetail }
  | { kind: "engine"; detail: EngineBoundaryRejectedDetail };

function authorityLabel(authority: SourceBoundaryRejectedDetail["authority"]): string {
  if (authority === "synth3d") return "3D SYNTH";
  if (authority === "bass3d") return "3D BASS";
  return "SAMPLE";
}

export function SourceBoundaryNotice() {
  const [notice, setNotice] = useState<BoundaryNotice | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const armHide = () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setNotice(null);
        timerRef.current = null;
      }, HIDE_AFTER_MS);
    };

    const onSourceRejected = (event: Event) => {
      const custom = event as CustomEvent<SourceBoundaryRejectedDetail>;
      setNotice({ kind: "source", detail: custom.detail });
      armHide();
    };

    const onEngineRejected = (event: Event) => {
      const custom = event as CustomEvent<EngineBoundaryRejectedDetail>;
      setNotice({ kind: "engine", detail: custom.detail });
      armHide();
    };

    window.addEventListener(SOURCE_BOUNDARY_REJECTED_EVENT, onSourceRejected);
    window.addEventListener(ENGINE_BOUNDARY_REJECTED_EVENT, onEngineRejected);
    return () => {
      window.removeEventListener(SOURCE_BOUNDARY_REJECTED_EVENT, onSourceRejected);
      window.removeEventListener(ENGINE_BOUNDARY_REJECTED_EVENT, onEngineRejected);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!notice) return null;

  const { detail } = notice;
  const message = notice.kind === "source"
    ? `Legacy mode “${detail.requested.toUpperCase()}” is compatibility-only. Active source stays “${detail.canonical.toUpperCase()}”.`
    : detail.canonical
      ? `Legacy engine “${detail.requested.toUpperCase()}” is compatibility-only. Active renderer stays “${detail.canonical.toUpperCase()}”.`
      : `“${detail.requested.toUpperCase()}” is a synth engine, but this slot belongs to the Sample domain.`;

  return (
    <div
      className="fixed left-3 right-3 bottom-24 z-[70] panel neon-border rounded-md px-3 py-2 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <div className="font-display text-[10px] text-primary tracking-wider">
        {detail.partName} · {authorityLabel(detail.authority)} AUTHORITY
      </div>
      <div className="font-mono text-[9px] text-muted-foreground mt-1">
        {message}
      </div>
    </div>
  );
}
