// VibeCoreLiv3 — FX Mix Lab Module Page.
//
// UX Rules: 8-parameter rule, 3-touch rule.
// Primary surface: 6 bus channel strips (FX slots A–F) in an accordion layout.
// Tapping a strip expands to reveal its 6 parameters (Mix, Boost, A, B, C, D).
// Only one strip is expanded at a time.
// Live meters update independently — only the meter cell re-renders per tick.
// Routing diagram and Master Bus are accessible via a collapsible section.

import { useEffect, useRef, useState } from "react";
import { useGroove } from "@/lib/store";
import { FX_PARAM_LABELS, SLOT_FX_OPTIONS, type FxType } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Power, Workflow, Activity, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useMeter } from "@/hooks/useMeter";
import { AiContextButton } from "./AiContextButton";

// ── dB helpers ───────────────────────────────────────────────────────────────
function toDb(v: number, floor = -60): number {
  if (!isFinite(v) || v <= 0) return floor;
  const db = 20 * Math.log10(v);
  return db < floor ? floor : db;
}
function dbToY(db: number, floor = -60): number {
  return Math.max(0, Math.min(1, (db - (-60)) / (6 - (-60))));
}
function dbColorClass(db: number): string {
  if (db >= -3) return "bg-destructive";
  if (db >= -12) return "bg-neon-amber";
  return "bg-neon-lime";
}

// ── Clip LED ─────────────────────────────────────────────────────────────────
function ClipLed({ clipAt, className }: { clipAt: number; className?: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!clipAt) return;
    const id = window.setInterval(() => force((x) => x + 1), 250);
    return () => window.clearInterval(id);
  }, [clipAt]);
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const active = clipAt > 0 && now - clipAt < 1500;
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full border border-border transition-colors",
        active ? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]" : "bg-surface-0",
        className,
      )}
      title={active ? "CLIP" : "ok"}
    />
  );
}

// ── Mini level bar (used in the collapsed strip) ─────────────────────────────
function StripMiniMeter({ slotIndex }: { slotIndex: number }) {
  const peak  = useMeter((s) => s.fxPeaks[slotIndex] ?? 0);
  const rms   = useMeter((s) => s.fxRms[slotIndex] ?? 0);
  const floor = useMeter((s) => s.fxFloorDb[slotIndex] ?? -60);
  const peakDb = toDb(peak, floor);
  const rmsDb  = toDb(rms, floor);
  const peakW = dbToY(peakDb, floor) * 100;
  const rmsW  = dbToY(rmsDb, floor) * 100;
  return (
    <div className="h-1.5 w-12 bg-surface-0 rounded overflow-hidden relative">
      <div className={cn("h-full absolute left-0 top-0 transition-[width] duration-75", dbColorClass(peakDb))}
        style={{ width: `${peakW}%`, opacity: 0.45 }} />
      <div className={cn("h-full absolute left-0 top-0 transition-[width] duration-75", dbColorClass(rmsDb))}
        style={{ width: `${rmsW}%` }} />
    </div>
  );
}

// ── FX param knob (drag-to-set) ──────────────────────────────────────────────
function FxKnob({
  label, value, onChange, defaultValue = 50,
}: { label: string; value: number; onChange: (v: number) => void; defaultValue?: number }) {
  const angle = -135 + (value / 100) * 270;
  const startY = useRef(0);
  const startV = useRef(value);
  const fine = useRef(false);
  const longTimer = useRef<number | null>(null);
  const lastTap = useRef(0);
  const [fineActive, setFineActive] = useState(false);

  const clearLong = () => {
    if (longTimer.current !== null) { window.clearTimeout(longTimer.current); longTimer.current = null; }
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    startV.current = value;
    fine.current = false;
    setFineActive(false);
    const now = Date.now();
    if (now - lastTap.current < 300) { onChange(defaultValue); lastTap.current = 0; return; }
    lastTap.current = now;
    clearLong();
    longTimer.current = window.setTimeout(() => {
      fine.current = true;
      setFineActive(true);
      startY.current = e.clientY;
      startV.current = value;
      if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* noop */ }
    }, 500);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    const dy = startY.current - e.clientY;
    if (!fine.current && Math.abs(dy) > 6) clearLong();
    const sensitivity = fine.current ? 0.05 : 0.5;
    const next = startV.current + dy * sensitivity;
    onChange(Math.max(0, Math.min(100, fine.current ? Math.round(next * 10) / 10 : Math.round(next))));
  };

  const onUp = () => { clearLong(); fine.current = false; setFineActive(false); };

  return (
    <div
      className="panel-inset rounded-md p-2 flex flex-col items-center gap-1 select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="font-mono text-[8px] text-muted-foreground tracking-wider">{label}</div>
      <div
        className={cn(
          "relative h-12 w-12 ring-knob rounded-full grid place-items-center cursor-ns-resize touch-none transition-shadow",
          fineActive && "ring-2 ring-neon-amber shadow-glow-primary",
        )}
      >
        <div
          className="absolute h-1 w-4 bg-primary rounded-full shadow-glow-primary origin-left"
          style={{ left: "50%", top: "50%", transform: `rotate(${angle}deg) translateX(6px)` }}
        />
        <div className="absolute inset-2 rounded-full border border-border" />
      </div>
      <div className="font-display text-[10px] text-primary tabular-nums">
        {fineActive ? value.toFixed(1) : Math.round(value)}
      </div>
    </div>
  );
}

// ── Expanded strip content (6 params) ────────────────────────────────────────
function ExpandedStrip({ slotIndex }: { slotIndex: number }) {
  const {
    fx, setFxMix, setFxBoost, setFxParam, setFxType,
  } = useGroove();
  const slot = fx[slotIndex];
  const labels = slot.type ? FX_PARAM_LABELS[slot.type] : ["A", "B", "C", "D"];
  const allowed = SLOT_FX_OPTIONS[slotIndex];

  const handleMixSuggestion = () => {
    // Apply a subtle randomized mix / boost within sane bounds
    setFxMix(slotIndex, 20 + Math.floor(Math.random() * 60));
    setFxBoost(slotIndex, Math.floor(Math.random() * 30));
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="hairline" />

      {/* FX type picker */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="font-mono text-[9px] text-muted-foreground">SLOT {slot.slot} · TYPE</div>
          <AiContextButton label="AI Mix" onAction={handleMixSuggestion} />
        </div>
        <div className="flex flex-wrap gap-1">
          {allowed.map((t) => (
            <button
              key={t}
              onClick={() => setFxType(slotIndex, t as FxType)}
              className={cn(
                "h-7 px-2 rounded panel-inset font-mono text-[10px]",
                slot.type === t && "bg-gradient-primary text-primary-foreground border-primary",
              )}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* 6 parameters: Mix, Boost, A, B, C, D */}
      <div className="grid grid-cols-3 gap-2">
        {/* Mix */}
        <div className="panel-inset rounded-md p-2 flex flex-col gap-1">
          <div className="font-mono text-[8px] text-muted-foreground">MIX</div>
          <input
            type="range" min={0} max={100} value={slot.mix}
            onChange={(e) => setFxMix(slotIndex, Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="font-display text-primary text-[10px] text-right">{slot.mix}%</div>
        </div>

        {/* Boost */}
        <div className="panel-inset rounded-md p-2 flex flex-col gap-1">
          <div className="font-mono text-[8px] text-muted-foreground">BOOST</div>
          <input
            type="range" min={0} max={100} value={slot.boost ?? 0}
            onChange={(e) => setFxBoost(slotIndex, Number(e.target.value))}
            onDoubleClick={() => setFxBoost(slotIndex, 0)}
            className="w-full accent-neon-amber"
          />
          <div className="font-display text-neon-amber text-[10px] text-right tabular-nums">
            +{(((slot.boost ?? 0) / 100) * 12).toFixed(1)}dB
          </div>
        </div>

        {/* A, B, C, D */}
        {(["A", "B", "C", "D"] as const).map((key, idx) => (
          <FxKnob
            key={key}
            label={labels[idx] ?? key}
            value={slot.params[key] ?? 50}
            onChange={(v) => setFxParam(slotIndex, key, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Individual bus channel strip ──────────────────────────────────────────────
function BusStrip({
  slotIndex, expanded, onToggle, shared,
}: { slotIndex: number; expanded: boolean; onToggle: () => void; shared: boolean }) {
  const { fx, toggleFxBypass } = useGroove();
  const f = fx[slotIndex];
  const clip = useMeter((s) => s.fxClip[slotIndex] ?? 0);

  return (
    <div
      className={cn(
        "panel p-3 transition-all",
        expanded && "neon-border",
      )}
    >
      {/* Strip header — tap to expand */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
      >
        {/* Slot letter */}
        <div className={cn(
          "h-10 w-10 shrink-0 rounded-md grid place-items-center font-display text-lg",
          expanded ? "bg-gradient-primary text-primary-foreground" : "panel-inset text-primary",
        )}>
          {f.slot}
        </div>

        {/* Type + meter */}
        <div className="flex-1 min-w-0">
          <div className="font-display text-[11px] truncate">{f.type ?? "EMPTY"}</div>
          <StripMiniMeter slotIndex={slotIndex} />
        </div>

        {/* Send level bar */}
        <div className="w-14 shrink-0">
          <div className="h-2 bg-surface-0 rounded overflow-hidden">
            <div className="h-full bg-gradient-accent transition-all" style={{ width: `${f.mix}%` }} />
          </div>
          <div className="font-mono text-[8px] text-muted-foreground text-right mt-0.5">{f.mix}%</div>
        </div>

        {/* Bypass toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFxBypass(slotIndex); }}
          className={cn(
            "h-9 w-9 shrink-0 grid place-items-center rounded panel-inset",
            !f.bypass && "text-primary neon-border",
            f.bypass && "opacity-50",
          )}
          title={f.bypass ? "FX bypassed" : "FX active"}
          aria-label="Bypass toggle"
        >
          <Power className="h-3.5 w-3.5" />
        </button>

        {/* Clip LED + expand chevron */}
        <div className="flex flex-col items-center gap-0.5">
          <ClipLed clipAt={clip} />
          {expanded
            ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Expanded content */}
      {expanded && <ExpandedStrip slotIndex={slotIndex} />}
    </div>
  );
}

// ── Routing diagram ───────────────────────────────────────────────────────────
function RoutingDiagram() {
  const { fx, fxRouting } = useGroove();
  return (
    <div className="relative h-24 flex items-center">
      <div className="font-mono text-[9px] text-muted-foreground absolute left-0 top-1/2 -translate-y-1/2">IN</div>
      <div className="font-mono text-[9px] text-muted-foreground absolute right-0 top-1/2 -translate-y-1/2">OUT</div>
      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-px bg-gradient-neon opacity-70" />
      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 grid grid-cols-6 gap-1">
        {fx.map((f, i) => {
          const offset = fxRouting === "parallel" ? (i % 2 === 0 ? -16 : 16) : fxRouting === "hybrid" ? (i % 3 - 1) * 12 : 0;
          return (
            <div key={f.slot}
              className={cn("panel-inset rounded-md py-1 px-1 text-center transition-transform", f.bypass && "opacity-30")}
              style={{ transform: `translateY(${offset}px)` }}
            >
              <div className="font-display text-[10px] text-primary leading-none">{f.slot}</div>
              <div className="font-mono text-[7px] text-muted-foreground truncate">{f.type ?? "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Master bus meters ─────────────────────────────────────────────────────────
function MasterMeters() {
  const peakL = useMeter((s) => s.peakL);
  const peakR = useMeter((s) => s.peakR);
  const limiterReduction = useMeter((s) => s.limiterReduction);
  return (
    <div className="flex items-center gap-3">
      <Activity className="h-3.5 w-3.5 text-neon-lime shrink-0" />
      <div className="flex flex-col gap-[2px] flex-1">
        <div className="h-1.5 bg-surface-0 rounded overflow-hidden">
          <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, peakL * 140)}%` }} />
        </div>
        <div className="h-1.5 bg-surface-0 rounded overflow-hidden">
          <div className="h-full bg-gradient-accent" style={{ width: `${Math.min(100, peakR * 140)}%` }} />
        </div>
      </div>
      <div className="font-mono text-[9px] text-muted-foreground shrink-0">
        GR {limiterReduction.toFixed(1)}dB
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function FxTab() {
  const { fx, fxRouting, setFxRouting, fxSharedFloor, toggleFxSharedFloor } = useGroove();
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);
  const [routingOpen, setRoutingOpen] = useState(false);

  const toggle = (i: number) => setExpandedSlot((cur) => (cur === i ? null : i));

  return (
    <div className="space-y-2">
      {/* Routing + Shared Floor — collapsible */}
      <div className="panel p-3">
        <button
          onClick={() => setRoutingOpen((o) => !o)}
          className="w-full flex items-center justify-between"
        >
          <div className="font-display text-xs text-primary flex items-center gap-2">
            <Workflow className="h-3.5 w-3.5" />
            ROUTING & MASTER
          </div>
          {routingOpen
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </button>

        {routingOpen && (
          <div className="mt-3 space-y-3">
            <div className="hairline" />
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(["serial", "parallel", "hybrid"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setFxRouting(r)}
                    className={cn(
                      "h-7 px-2 rounded font-mono text-[10px] panel-inset uppercase",
                      fxRouting === r && "neon-border text-primary",
                    )}
                  >{r}</button>
                ))}
              </div>
              <button
                onClick={toggleFxSharedFloor}
                className={cn(
                  "h-7 px-2 rounded font-mono text-[9px] panel-inset",
                  fxSharedFloor && "neon-border text-primary bg-primary/10",
                )}
              >
                {fxSharedFloor ? "🔗 SHARED" : "FLOOR: AUTO"}
              </button>
            </div>
            <RoutingDiagram />
            <div className="hairline" />
            <MasterMeters />
          </div>
        )}
      </div>

      {/* 6 bus channel strips (accordion) */}
      {fx.map((_, i) => (
        <BusStrip
          key={i}
          slotIndex={i}
          expanded={expandedSlot === i}
          onToggle={() => toggle(i)}
          shared={fxSharedFloor}
        />
      ))}
    </div>
  );
}
