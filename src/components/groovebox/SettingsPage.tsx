// SETTINGS module — consolidated Audio, MIDI, Sync, Performance, Diagnostics.
//
// Groups SetupTab and DiagPanel into a single scrollable settings module.
// The full DiagPanel is collapsed by default and expanded on demand.

import { useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { SetupTab } from "./SetupTab";
import { DiagPanel } from "./DiagPanel";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [diagOpen, setDiagOpen] = useState(false);

  return (
    <div className="space-y-3 pb-4">
      {/* Main setup sections */}
      <SetupTab />

      {/* Diagnostics — collapsible */}
      <div className="panel overflow-hidden">
        <button
          onClick={() => setDiagOpen((v) => !v)}
          className={cn(
            "w-full flex items-center justify-between p-3",
            "font-display text-[11px] text-neon-cyan tracking-wider",
            "hover:bg-surface-1/50 transition-colors",
          )}
          aria-expanded={diagOpen}
        >
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            DIAGNOSTICS
          </div>
          {diagOpen
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {diagOpen && (
          <div className="border-t border-border p-3">
            <DiagPanel embedded />
          </div>
        )}
      </div>
    </div>
  );
}
