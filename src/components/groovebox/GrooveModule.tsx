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

import { useRef, useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PianoRollTab }      from "./PianoRollTab";
import { AutomationDrawer }  from "./AutomationDrawer";
import { PatternChainDrawer } from "./PatternChainDrawer";
import { Activity, Link2 }   from "lucide-react";

const SWIPE_DISTANCE_PX = 48;

function DrawerSwipeZone({
  onOpenAutomation,
  onOpenChain,
}: {
  onOpenAutomation: () => void;
  onOpenChain: () => void;
}) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.y - e.clientY < SWIPE_DISTANCE_PX) return;

    startRef.current = null;
    const rect = e.currentTarget.getBoundingClientRect();
    if (start.x - rect.left < rect.width / 4) {
      onOpenAutomation();
    } else {
      onOpenChain();
    }
  };

  const clearStart = () => { startRef.current = null; };

  return (
    <div
      data-testid="groove-drawer-swipe-zone"
      className="md:hidden h-10 -mt-1 flex items-start justify-center touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearStart}
      onPointerCancel={clearStart}
      aria-label="Swipe up to open automation or pattern chain"
    >
      <div className="mt-1.5 h-5 w-16 rounded-full panel-inset flex items-start justify-center">
        <div className="mt-1 h-1 w-9 rounded-full bg-muted-foreground/50" aria-hidden="true" />
      </div>
    </div>
  );
}

export function GrooveModule() {
  const recording = useGroove((s) => s.recording);
  const playing   = useGroove((s) => s.transport.playing);

  const [autoOpen,  setAutoOpen]  = useState(false);
  const [chainOpen, setChainOpen] = useState(false);

  const openAutomation = () => { setAutoOpen(true); setChainOpen(false); };
  const openChain = () => { setChainOpen(true); setAutoOpen(false); };

  return (
    <div className="space-y-2">
      {/* Primary editing surface — compact mode enforces 8-param rule */}
      <PianoRollTab compact />
      <DrawerSwipeZone
        onOpenAutomation={openAutomation}
        onOpenChain={openChain}
      />

      {/* ── Drawers (mutually exclusive, above the footer/navigation) ── */}
      {autoOpen && (
        <AutomationDrawer onClose={() => setAutoOpen(false)} />
      )}
      {chainOpen && (
        <PatternChainDrawer onClose={() => setChainOpen(false)} />
      )}

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
    </div>
  );
}
