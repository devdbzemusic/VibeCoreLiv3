import { useEffect, useRef, useState } from "react";
import { useGroove } from "@/lib/store";
import { FX_PARAM_LABELS, SLOT_FX_OPTIONS, type FxType } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Power, Workflow, Activity, AlertTriangle } from "lucide-react";
import { useMeter } from "@/hooks/useMeter";

/** Convert linear amplitude (0..1+) to dBFS. Floor returned for true silence. */
function toDb(v: number, floor = -60): number {
  if (!isFinite(v) || v <= 0) return floor;
  const db = 20 * Math.log10(v);
  return db < floor ? floor : db;
}
/** Map dBFS [floor..+6] → 0..1 for vertical meter height. */
function dbToY(db: number, floor = -60): number {
  const min = floor, max = 6;
  return Math.max(0, Math.min(1, (db - min) / (max - min)));
}
/** Color for a dB value: green < -12, amber < -3, red >= -3. */
function dbColorClass(db: number): string {
  if (db >= -3) return "bg-destructive";
  if (db >= -12) return "bg-neon-amber";
  return "bg-neon-lime";
}



export function FxTab() {
  const {
    fx, selectedFxSlot, selectFx, fxRouting, setFxRouting,
    setFxMix, setFxBoost, toggleFxBypass, setFxType, setFxParam,
    fxSharedFloor, toggleFxSharedFloor,
  } = useGroove();
  // Selected-slot meters live in dedicated subscribers below (DetailMeter).
  const slot = fx[selectedFxSlot];
  const labels = slot.type ? FX_PARAM_LABELS[slot.type] : ["A", "B", "C", "D"];
  const allowed = SLOT_FX_OPTIONS[selectedFxSlot];

  return (
    <div className="space-y-3">
      {/* Routing + Shared Floor */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary flex items-center gap-2">
            <Workflow className="h-3.5 w-3.5" /> FX MATRIX · ROUTING
          </div>
          <div className="flex gap-1">
            {(["serial", "parallel", "hybrid"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFxRouting(r)}
                className={cn(
                  "h-7 px-2 rounded font-mono text-[10px] panel-inset uppercase",
                  fxRouting === r && "neon-border text-primary"
                )}
              >{r}</button>
            ))}
          </div>
        </div>
        <div className="hairline mb-2" />
        <div className="flex items-center justify-between">
          <div className="font-mono text-[9px] text-muted-foreground">SHARED FLOOR</div>
          <button
            onClick={toggleFxSharedFloor}
            className={cn(
              "h-5 px-2 rounded font-mono text-[9px] panel-inset transition-all",
              fxSharedFloor && "neon-border text-primary bg-primary/10"
            )}
            title={fxSharedFloor ? "All slots share one calibrated floor" : "Each slot calibrates its own floor"}
          >
            {fxSharedFloor ? "ON" : "OFF"}
          </button>
        </div>
        <div className="hairline mb-2 mt-2" />
        <RoutingDiagram />
      </div>

      {/* Slot picker */}
      <div className="grid grid-cols-6 gap-1.5">
        {fx.map((f, i) => (
          <FxSlotPicker
            key={f.slot}
            slotIndex={i}
            f={f}
            selected={selectedFxSlot === i}
            onSelect={() => selectFx(i as 0|1|2|3|4|5)}
          />
        ))}
      </div>


      {/* Selected slot editor */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-sm">
            SLOT <span className="text-primary">{slot.slot}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="text-foreground">{slot.type ?? "EMPTY"}</span>
          </div>
          <div className="flex items-center gap-2">
            <SelectedFxDetailMeter slotIndex={selectedFxSlot} shared={fxSharedFloor} />
            <button
              onClick={() => toggleFxBypass(selectedFxSlot)}
              className={cn("h-8 w-8 grid place-items-center rounded panel-inset",
                !slot.bypass && "text-primary neon-border"
              )}
              title={slot.bypass ? "FX bypassed" : "FX enabled"}
            >
              <Power className="h-3.5 w-3.5" />
            </button>
          </div>

        </div>

        {/* Type picker (restricted to allowed slot types) */}
        <div className="mb-4">
          <div className="font-mono text-[9px] text-muted-foreground mb-1">SLOT {slot.slot} · AVAILABLE</div>
          <div className="flex flex-wrap gap-1">
            {allowed.map((t) => (
              <button
                key={t}
                onClick={() => setFxType(selectedFxSlot, t as FxType)}
                className={cn(
                  "h-7 px-2 rounded panel-inset font-mono text-[10px]",
                  slot.type === t && "bg-gradient-primary text-primary-foreground border-primary"
                )}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Params */}
        <div className="grid grid-cols-4 gap-2">
          {(["A", "B", "C", "D"] as const).map((p, idx) => (
            <Knob
              key={p}
              label={labels[idx]}
              value={slot.params[p] ?? 50}
              onChange={(v) => setFxParam(selectedFxSlot, p, v)}
            />
          ))}
        </div>

        {/* Wet / Dry + Boost */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground w-12">WET</span>
            <input
              type="range" min={0} max={100} value={slot.mix}
              onChange={(e) => setFxMix(selectedFxSlot, Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="font-display text-primary text-sm w-10 text-right">{slot.mix}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground w-12" title="Perceptual boost: 0..+12 dB">BOOST</span>
            <input
              type="range" min={0} max={100} value={slot.boost ?? 0}
              onChange={(e) => setFxBoost(selectedFxSlot, Number(e.target.value))}
              onDoubleClick={() => setFxBoost(selectedFxSlot, 0)}
              className="flex-1 accent-neon-amber"
            />
            <span className="font-display text-neon-amber text-sm w-12 text-right tabular-nums">
              +{(((slot.boost ?? 0) / 100) * 12).toFixed(1)}dB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Per-slot picker meter — subscribes only to its own slot index.
// Only this small cell rerenders @ ≤10 Hz on meter publishes.
function FxSlotPicker({ slotIndex, f, selected, onSelect }: {
  slotIndex: number;
  f: { slot: string; type: string | null; mix: number; bypass: boolean };
  selected: boolean;
  onSelect: () => void;
}) {
  const peak   = useMeter((s) => s.fxPeaks[slotIndex] ?? 0);
  const rms    = useMeter((s) => s.fxRms[slotIndex] ?? 0);
  const clipAt = useMeter((s) => s.fxClip[slotIndex] ?? 0);
  const floor  = useMeter((s) => s.fxFloorDb[slotIndex] ?? -60);
  return (
    <button
      onClick={onSelect}
      className={cn(
        "panel-inset rounded-md p-2 flex flex-col items-center gap-0.5 transition-all relative",
        selected && "neon-border",
        f.bypass && "opacity-40"
      )}
    >
      <ClipLed clipAt={clipAt} className="absolute top-1 right-1" />
      <div className="font-display text-sm text-primary">{f.slot}</div>
      <div className="font-mono text-[8px] text-muted-foreground truncate w-full text-center">{f.type ?? "EMPTY"}</div>
      <div className="h-1 w-full bg-surface-0 rounded mt-1 overflow-hidden">
        <div className="h-full bg-gradient-accent" style={{ width: `${f.mix}%` }} />
      </div>
      <SlotMiniMeter peak={peak} rms={rms} floor={floor} />
    </button>
  );
}

function SelectedFxDetailMeter({ slotIndex, shared }: { slotIndex: number; shared?: boolean }) {
  const peak   = useMeter((s) => s.fxPeaks[slotIndex] ?? 0);
  const rms    = useMeter((s) => s.fxRms[slotIndex] ?? 0);
  const clipAt = useMeter((s) => s.fxClip[slotIndex] ?? 0);
  const floor  = useMeter((s) => s.fxFloorDb[slotIndex] ?? -60);
  return <DetailMeter peak={peak} rms={rms} clipAt={clipAt} floor={floor} shared={shared} />;
}

/**
 * Mobile-first FX knob.
 *  - Full 0..100 sweep = 200 px finger travel (linear).
 *  - Long-press (≥500 ms) → fine mode: sensitivity 0.1x (decimal-grade).
 *  - Double-tap → reset to default (50, or per-prop).
 *  - touch-action: none → no scroll conflict.
 * Audio-side parameter smoothing already lives in the engine
 * (setTargetAtTime ~20 ms), so no zipper-noise from UI sweeps.
 */



function Knob({
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
    // Double-tap detect (≤300 ms)
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onChange(defaultValue);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    // Long-press → fine mode
    clearLong();
    longTimer.current = window.setTimeout(() => {
      fine.current = true;
      setFineActive(true);
      // Reset anchor so fine mode starts from current position.
      startY.current = e.clientY;
      startV.current = value;
      if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* noop */ }
    }, 500);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    const dy = startY.current - e.clientY;
    // If finger moves >6 px before long-press fires, cancel long-press.
    if (!fine.current && Math.abs(dy) > 6) clearLong();
    // 200 px = full sweep; fine mode = 10x denser (= 2000 px equivalent).
    const sensitivity = fine.current ? 0.05 : 0.5; // %/px
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
            <div
              key={f.slot}
              className={cn(
                "panel-inset rounded-md py-1 px-1 text-center transition-transform",
                f.bypass ? "opacity-30" : ""
              )}
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

/** Tiny horizontal peak+RMS bar for slot picker. `floor` is the auto-calibrated noise floor (dBFS). */
function SlotMiniMeter({ peak, rms, floor }: { peak: number; rms: number; floor: number }) {
  const peakDb = toDb(peak, floor);
  const rmsDb = toDb(rms, floor);
  const peakW = dbToY(peakDb, floor) * 100;
  const rmsW = dbToY(rmsDb, floor) * 100;
  return (
    <div className="h-1 w-full bg-surface-0 rounded mt-0.5 overflow-hidden relative">
      <div className={cn("h-full absolute left-0 top-0 transition-[width] duration-75", dbColorClass(peakDb))} style={{ width: `${peakW}%`, opacity: 0.45 }} />
      <div className={cn("h-full absolute left-0 top-0 transition-[width] duration-75", dbColorClass(rmsDb))} style={{ width: `${rmsW}%` }} />
    </div>
  );
}

/** Red clip LED that latches for ~1.5s after the last clip event. */
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

/** Detailed post-wet meter: vertical peak + RMS bar, numeric dBFS readouts, clip LED.
 *  `floor` is the engine's auto-calibrated noise floor for this slot (dBFS).
 *  Readouts fall to "-∞" when the value is at or below the calibrated floor. */
function DetailMeter({ peak, rms, clipAt, floor, shared }: { peak: number; rms: number; clipAt: number; floor: number; shared?: boolean }) {
  const peakDb = toDb(peak, floor);
  const rmsDb = toDb(rms, floor);
  const peakH = dbToY(peakDb, floor) * 100;
  const rmsH = dbToY(rmsDb, floor) * 100;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const clipActive = clipAt > 0 && now - clipAt < 1500;
  // Show -∞ once we're within 0.5 dB of the calibrated floor.
  const peakInf = peak <= 0 || peakDb <= floor + 0.5;
  const rmsInf  = rms  <= 0 || rmsDb  <= floor + 0.5;
  return (
    <div className="panel-inset rounded px-1.5 py-1 flex items-center gap-1.5" title={`floor ${floor.toFixed(1)} dBFS${shared ? " · shared" : ""}`}>
      <Activity className="h-3 w-3 text-neon-lime" />
      {/* Vertical bar */}
      <div className="relative h-10 w-3 bg-surface-0 rounded overflow-hidden">
        {/* -12 dB tick */}
        <div className="absolute left-0 right-0 h-px bg-border" style={{ bottom: `${dbToY(-12, floor) * 100}%` }} />
        {/* -3 dB tick */}
        <div className="absolute left-0 right-0 h-px bg-destructive/60" style={{ bottom: `${dbToY(-3, floor) * 100}%` }} />
        {/* Peak bar (translucent) */}
        <div
          className={cn("absolute left-0 right-0 bottom-0 transition-[height] duration-75", dbColorClass(peakDb))}
          style={{ height: `${peakH}%`, opacity: 0.45 }}
        />
        {/* RMS bar (solid) */}
        <div
          className={cn("absolute left-0 right-0 bottom-0 transition-[height] duration-75", dbColorClass(rmsDb))}
          style={{ height: `${rmsH}%` }}
        />
      </div>
      {/* Numeric readouts */}
      <div className="flex flex-col items-end leading-none">
        <div className="font-mono text-[8px] text-muted-foreground">PK</div>
        <div className={cn("font-display text-[10px] tabular-nums", peakDb >= -3 ? "text-destructive" : peakDb >= -12 ? "text-neon-amber" : "text-neon-lime")}>
          {peakInf ? "-∞" : peakDb.toFixed(1)}
        </div>
        <div className="font-mono text-[8px] text-muted-foreground mt-0.5">RMS</div>
        <div className="font-display text-[10px] tabular-nums text-foreground">
          {rmsInf ? "-∞" : rmsDb.toFixed(1)}
        </div>
        <div className="font-mono text-[7px] text-muted-foreground/60 mt-0.5" title="Auto-calibrated noise floor">
          {shared ? "🔗" : "⌊"}{floor.toFixed(0)}
        </div>
      </div>
      {/* Clip LED with optional icon */}
      <div className="flex flex-col items-center gap-0.5">
        <ClipLed clipAt={clipAt} />
        {clipActive && <AlertTriangle className="h-2.5 w-2.5 text-destructive animate-pulse" />}
      </div>
    </div>
  );
}
