// AiContextButton — Contextual AI action button for module headers.
// Non-blocking. Silent fail on error. Shows spinner while running.
// Each module passes its own onAction — the button never touches audio itself.

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiContextButtonProps {
  label: string;
  onAction: () => void | Promise<void>;
  className?: string;
}

export function AiContextButton({ label, onAction, className }: AiContextButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try { await onAction(); } catch { /* AI actions are optional — silent fail */ } finally { setBusy(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={cn(
        "h-7 px-2.5 rounded panel-inset font-mono text-[9px] flex items-center gap-1.5 transition-colors",
        busy ? "text-muted-foreground" : "text-neon-violet hover:neon-border",
        className,
      )}
      aria-label={label}
    >
      {busy
        ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        : <Sparkles className="h-3 w-3 shrink-0" />}
      {label}
    </button>
  );
}
