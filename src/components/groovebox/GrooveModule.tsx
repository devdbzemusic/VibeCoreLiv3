// VibeCoreLiv3 — GROOVE Module
//
// The central production surface for all content: Piano Roll + Automation +
// Pattern Chain. All accessible within 3 touches, never more than 8
// parameters visible at once (enforced by PianoRollTab compact mode).
//
// Layout:
//   ModuleHeader (from Index.tsx ModulePage wrapper)
//     └── GrooveModule
//           ├── PianoRollTab (compact=true)   ← primary editing surface
//           ├── Footer bar  [AUTO] [CHAIN]   ← 1-touch access to drawers
//           ├── AutomationDrawer             ← velocity / prob / gate lanes
//           └── PatternChainDrawer           ← pattern browser + scene manager
//
// 3-touch access map:
//   Piano Roll editing → always open (0 touches)
//   Automation lanes  → GROOVE footer [AUTO] (1 touch)
//   Pattern chain     → GROOVE footer [CHAIN] (1 touch)
//   Secondary controls→ Piano Roll compact header [···] (1 touch)
//
// Recording:
//   Record button is in ModuleHeader (rendered by ModulePage in Index.tsx).
//   When recording=true + transport.playing, the Piano Roll grid shows a
//   pulsing red ring. Notes added via tap/drag are immediately committed
//   to the store and will play on the next scheduler loop.
//
// Signal flow (MASTERPROMPT v2.0 compliant):
//   MasterClock → Scheduler → store transport → Piano Roll
//   Store writes (note edits) → Scheduler reads on next tick → Audio engine

import { useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PianoRollTab }      from "./PianoRollTab";
import { AutomationDrawer }  from "./AutomationDrawer";
import { PatternChainDrawer } from "./PatternChainDrawer";
import { Activity, Link2 }   from "lucide-react";

export function GrooveModule() {
  const recording = useGroove((s) => s.recording);
  const playing   = useGroove((s) => s.transport.playing);

  const [autoOpen,  setAutoOpen]  = useState(false);
  const [chainOpen, setChainOpen] = useState(false);

  return (
    <div className="space-y-2">
      {/* Primary editing surface — compact mode enforces 8-param rule */}
      <PianoRollTab compact />

      {/* ── Footer bar: 1-touch access to automation + pattern chain ── */}
      <div className="flex items-center gap-2">
        {/* Automation drawer toggle */}
        <button
          onClick={() => { setAutoOpen((o) => !o); setChainOpen(false); }}
          aria-expanded={autoOpen}
          className={cn(
            "h-9 px-3 rounded-lg panel-inset font-mono text-[10px] flex items-center gap-1.5 transition-colors",
            autoOpen ? "neon-border text-neon-cyan" : "text-muted-foreground",
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          AUTO
        </button>

        {/* Pattern chain / scene queue drawer toggle */}
        <button
          onClick={() => { setChainOpen((o) => !o); setAutoOpen(false); }}
          aria-expanded={chainOpen}
          className={cn(
            "h-9 px-3 rounded-lg panel-inset font-mono text-[10px] flex items-center gap-1.5 transition-colors",
            chainOpen ? "neon-border text-neon-lime" : "text-muted-foreground",
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
          CHAIN
        </button>

        {/* Recording indicator — visible when overdub is active */}
        {recording && (
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[9px] text-neon-crimson",
            playing && "animate-pulse",
          )}>
            <span className="h-2 w-2 rounded-full bg-neon-crimson inline-block" />
            {playing ? "OVERDUB" : "REC ARMED"}
          </div>
        )}

        {/* Seq tab shortcut — the alternative expert view */}
        <div className="ml-auto font-mono text-[8px] text-muted-foreground">
          SEQ tab for step view
        </div>
      </div>

      {/* ── Drawers (mutually exclusive) ── */}
      {autoOpen && (
        <AutomationDrawer onClose={() => setAutoOpen(false)} />
      )}
      {chainOpen && (
        <PatternChainDrawer onClose={() => setChainOpen(false)} />
      )}
    </div>
  );
}
