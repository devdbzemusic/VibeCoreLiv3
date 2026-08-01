// VibeCore UI Architect — 3D Bass Instrument Page.
//
// Master prompt: "3D BASS — Eigene Instrumentenseite.
//   Fokus auf Sub, Punch, Drive, Filter, Width, Glide."
//
// Structure: ModuleHeader → Voice picker → CORE (6 focus params) → deep editor.

import { useEffect } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ModuleHeader } from "./ModuleHeader";
import { Bass3DSubtab } from "./Bass3DSubtab";
import { defaultBass3D } from "@/lib/bass3d/params";

function CoreKnob({ label, value, min = 0, max = 100, step = 1, onChange, suffix }: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 panel-inset rounded-md p-2">
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest">{label}</div>
      <div className="font-display text-[11px] text-primary">{Math.round(value)}{suffix ?? ""}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-primary touch-none" />
    </div>
  );
}

export function Bass3DPage() {
  const { parts, selectedPart, selectPart, setSynthEngine, setPartSource, setBass3D } = useGroove();

  // Assign the 3D Bass instrument to the selected voice (only if not already 3D Bass).
  useEffect(() => {
    const p = useGroove.getState().parts[selectedPart];
    if (p && p.synth.engine !== "3D Bass") {
      setSynthEngine(selectedPart, "3D Bass");
      setPartSource(selectedPart, "synth");
    }
  }, [selectedPart, setSynthEngine, setPartSource]);

  const p = parts[selectedPart];
  const b = p?.bass3d ?? defaultBass3D();

  return (
    <div className="space-y-3">
      {/* ModuleHeader is rendered by the <ModulePage> wrapper in Index.tsx */}

      {/* Voice picker */}
      <div className="panel p-2">
        <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1.5">VOICE</div>
        <div className="no-scrollbar overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1 min-w-max">
            {parts.map((pt) => (
              <button key={pt.id} onClick={() => selectPart(pt.id)}
                className={cn(
                  "shrink-0 h-11 min-w-[3.5rem] px-2 rounded panel-inset flex flex-col items-center justify-center gap-0.5 touch-none",
                  pt.id === selectedPart && "neon-border text-primary")}>
                <span className="text-[7px] text-muted-foreground font-mono">{String(pt.id + 1).padStart(2, "0")}</span>
                <span className="font-display text-[9px] truncate w-full text-center">{pt.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CORE — 6 focus parameters per master prompt: Sub · Punch · Drive · Filter · Width · Glide */}
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">CORE — SUB · PUNCH · DRIVE · FILTER · WIDTH · GLIDE</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-3 gap-1.5">
          <CoreKnob label="SUB" value={Math.round(b.sub.level * 100)}
            onChange={(v) => setBass3D(p.id, { sub: { ...b.sub, level: v / 100 } })} suffix="%" />
          <CoreKnob label="PUNCH" value={Math.round(b.dynamics.bassPunch.amount * 100)}
            onChange={(v) => setBass3D(p.id, { dynamics: { ...b.dynamics, bassPunch: { ...b.dynamics.bassPunch, amount: v / 100 } } })} suffix="%" />
          <CoreKnob label="DRIVE" value={Math.round(b.drive.amount * 100)} max={200}
            onChange={(v) => setBass3D(p.id, { drive: { ...b.drive, amount: v / 100 } })} suffix="%" />
          <CoreKnob label="FILTER" value={b.filter1.freq} min={20} max={20000} step={10}
            onChange={(v) => setBass3D(p.id, { filter1: { ...b.filter1, freq: v } })} suffix="Hz" />
          <CoreKnob label="WIDTH" value={Math.round(b.spatial.width * 50)} min={0} max={200}
            onChange={(v) => setBass3D(p.id, { spatial: { ...b.spatial, width: v / 50 } })} suffix="%" />
          <CoreKnob label="GLIDE" value={Math.round(b.performance.glideTime * 1000)} min={0} max={2000} step={10}
            onChange={(v) => setBass3D(p.id, { performance: { ...b.performance, glideTime: v / 1000 } })} suffix="ms" />
        </div>
      </div>

      {/* Deep editor — full workflow (SOUND → OSC → FILTER → DRIVE → DYN → ENV → 3D → FX → SAVE) */}
      <Bass3DSubtab />
    </div>
  );
}