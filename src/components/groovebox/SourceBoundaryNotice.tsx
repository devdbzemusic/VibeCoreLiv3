import { useEffect, useRef, useState } from "react";
import {
  SOURCE_BOUNDARY_REJECTED_EVENT,
  type SourceBoundaryRejectedDetail,
} from "@/lib/instruments/sourceRuntimeGuard";

const HIDE_AFTER_MS = 3200;

function authorityLabel(authority: SourceBoundaryRejectedDetail["authority"]): string {
  if (authority === "synth3d") return "3D SYNTH";
  if (authority === "bass3d") return "3D BASS";
  return "SAMPLE";
}

export function SourceBoundaryNotice() {
  const [detail, setDetail] = useState<SourceBoundaryRejectedDetail | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onRejected = (event: Event) => {
      const custom = event as CustomEvent<SourceBoundaryRejectedDetail>;
      setDetail(custom.detail);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setDetail(null);
        timerRef.current = null;
      }, HIDE_AFTER_MS);
    };

    window.addEventListener(SOURCE_BOUNDARY_REJECTED_EVENT, onRejected);
    return () => {
      window.removeEventListener(SOURCE_BOUNDARY_REJECTED_EVENT, onRejected);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!detail) return null;

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
        Legacy mode “{detail.requested.toUpperCase()}” is kept for compatibility only. Active source stays “{detail.canonical.toUpperCase()}”.
      </div>
    </div>
  );
}
