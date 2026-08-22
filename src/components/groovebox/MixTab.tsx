import { useMemo } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Headphones, Sliders, Activity, Route, Volume2, VolumeX } from "lucide-react";
import type { DriveType } from "@/lib/model";
import { useMeter, useVisibleParts } from "@/hooks/useMeter";

const BUS_TARGETS = [
  { value: "master", label: "MASTER" },
  ...Array.from({ length: 6 }, (_, i) => ({ value: String(i), label: `BUS ${i + 1}` })),
];

function busTargetValue(target: number | null | undefined): string {
  return target === null || target === undefined ? "master" : String(target);
}

function Fader({ value, onChange, color = "primary", peak = 0 }: { value: number; onChange: (v: number) => void; color?: string; peak?: number }) {
  return (
    <div className="relative h-32 w-7 panel-inset rounded-md overflow-hidden">
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: `${value}%`, background: color === "primary" ? "var(--gradient-primary)" : `hsl(var(--${color}))` }}
      />
      {/* peak overlay */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-neon-lime/40 mix-blend-screen"
        style={{ height: `${Math.min(100, peak * 140)}%` }}
      />
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ writingMode: "vertical-lr", direction: "rtl" } as React.CSSProperties}
      />
      <div className="pointer-events-none absolute left-0 right-0" style={{ bottom: `${value}%` }}>
        <div className="h-1 bg-foreground/90 shadow-glow-primary" />
      </div>
    </div>
  );
}

export function MixTab() {
  const {
    parts, partBusAssignments, setPartVolume, setPartPan, setPartPitch,
    setPartBusAssignment, toggleMute, toggleSolo, selectedPart, selectPart,
  } = useGroove();
  // Register every visible part so the engine reads its analyser.
  const visibleIds = useMemo(() => parts.map((p) => p.id), [parts]);
  useVisibleParts(visibleIds);

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary">MIXER · 16 STEREO PARTS</div>
          <div className="font-mono text-[10px] text-muted-foreground">MAIN OUT</div>
        </div>
        <div className="hairline mb-2" />

        <div className="no-scrollbar overflow-x-auto -mx-3 px-3">
          <div className="flex gap-2 min-w-max">
            {parts.map((p) => (
              <PartMixerCell
                key={p.id}
                p={p}
                selected={p.id === selectedPart}
                onSelect={() => selectPart(p.id)}
                onVolume={(v) => setPartVolume(p.id, v)}
                onPan={(v) => setPartPan(p.id, v)}
                onPitch={(v) => setPartPitch(p.id, v)}
                busTarget={p.busTarget ?? partBusAssignments[p.id] ?? null}
                onBusTarget={(busIdx) => setPartBusAssignment(p.id, busIdx)}
                onMute={() => toggleMute(p.id)}
                onSolo={() => toggleSolo(p.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <ChannelStrip />
      <BusRoutingPanel />
      <SelectedPartSends />
      <MasterBus />
    </div>
  );
}

function Knob({ label, value, min, max, unit, onChange, color = "primary" }: {
  label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void; color?: string;
}) {
  const norm = (value - min) / (max - min);
  const angle = -135 + norm * 270;
  const startY = { current: 0 } as { current: number };
  const startV = { current: value } as { current: number };
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    startV.current = value;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    const dy = startY.current - e.clientY;
    const range = max - min;
    const next = Math.max(min, Math.min(max, startV.current + (dy / 120) * range));
    onChange(Math.round(next * 100) / 100);
  };
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div
        className="relative h-11 w-11 ring-knob rounded-full grid place-items-center touch-none cursor-ns-resize"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onDoubleClick={() => onChange(min + (max - min) / 2)}
      >
        <div
          className="absolute h-0.5 w-4 rounded-full origin-left"
          style={{
            left: "50%", top: "50%",
            background: `hsl(var(--${color}))`,
            boxShadow: `0 0 6px hsl(var(--${color}))`,
            transform: `rotate(${angle}deg) translateX(6px)`,
          }}
        />
        <div className="absolute inset-1.5 rounded-full border border-border" />
      </div>
      <div className="font-display text-[9px] text-primary tabular-nums">
        {value > 0 && unit !== "%" && unit !== "Hz" ? "+" : ""}{Math.round(value * 10) / 10}{unit ? unit : ""}
      </div>
    </div>
  );
}

interface PartMixerCellProps {
  p: ReturnType<typeof useGroove.getState>["parts"][number];
  selected: boolean;
  onSelect: () => void;
  onVolume: (v: number) => void;
  onPan: (v: number) => void;
  onPitch: (v: number) => void;
  busTarget: number | null;
  onBusTarget: (busIdx: number | null) => void;
  onMute: () => void;
  onSolo: () => void;
}

// Isolated meter cell: only this component rerenders @ ≤10 Hz when the
// part's peak changes. The rest of MixTab stays still.
function PartMixerCell({ p, selected, onSelect, onVolume, onPan, onPitch, busTarget, onBusTarget, onMute, onSolo }: PartMixerCellProps) {
  const peak = useMeter((s) => s.partPeaks[p.id] ?? 0);
  return (
    <div
      onClick={onSelect}
      className={cn(
        "w-[68px] shrink-0 panel-inset rounded-md p-2 flex flex-col items-center gap-2 cursor-pointer",
        selected && "neon-border"
      )}
    >
      <div className="flex items-center gap-1 w-full">
        <span
          className="h-1.5 w-1.5 rounded-full glow-dot"
          style={{ color: `hsl(var(--${p.color}))`, background: `hsl(var(--${p.color}))` }}
        />
        <span className="font-mono text-[8px] text-muted-foreground">{String(p.id + 1).padStart(2, "0")}</span>
        <span className={cn("ml-auto h-1.5 w-1.5 rounded-full transition-colors",
          peak > 0.9 ? "bg-neon-crimson" : peak > 0.6 ? "bg-neon-amber" : peak > 0.05 ? "bg-neon-lime" : "bg-surface-1")} />
      </div>
      <div className="font-display text-[9px] leading-none text-foreground truncate w-full">{p.name}</div>

      <Fader value={p.volume} onChange={onVolume} color={p.color} peak={peak} />

      <div className="w-full">
        <input type="range" min={-50} max={50} value={p.pan}
          onChange={(e) => onPan(Number(e.target.value))}
          className="w-full h-1 accent-primary"
        />
        <div className="font-mono text-[8px] text-muted-foreground text-center">{p.pan === 0 ? "C" : p.pan > 0 ? `R${p.pan}` : `L${-p.pan}`}</div>
      </div>

      <div className="w-full">
        <input type="range" min={-24} max={24} value={p.pitch}
          onChange={(e) => onPitch(Number(e.target.value))}
          className="w-full h-1 accent-primary"
        />
        <div className="font-mono text-[8px] text-neon-cyan text-center">{p.pitch > 0 ? `+${p.pitch}` : p.pitch}st</div>
      </div>

      <select
        aria-label={`${p.name} output bus`}
        value={busTargetValue(busTarget)}
        onChange={(e) => {
          e.stopPropagation();
          onBusTarget(e.target.value === "master" ? null : Number(e.target.value));
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-6 w-full rounded panel-inset bg-surface-0 px-0.5 text-[8px] font-mono text-primary outline-none"
      >
        {BUS_TARGETS.map((target) => (
          <option key={target.value} value={target.value}>{target.label}</option>
        ))}
      </select>

      <div className="flex gap-1 w-full">
        <button
          onClick={(e) => { e.stopPropagation(); onMute(); }}
          className={cn("flex-1 h-6 rounded text-[9px] font-mono panel-inset",
            p.mute && "bg-neon-crimson text-primary-foreground border-neon-crimson")}
        >M</button>
        <button
          onClick={(e) => { e.stopPropagation(); onSolo(); }}
          className={cn("flex-1 h-6 rounded text-[9px] font-mono panel-inset",
            p.solo && "bg-neon-amber text-background border-neon-amber")}
        >S</button>
      </div>

      <div className="font-mono text-[8px] text-primary">{p.volume}</div>
    </div>
  );
}

function BusRoutingPanel() {
  const { busLevels, setBusLevelAction, toggleBusMute } = useGroove();

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-xs text-primary flex items-center gap-2">
          <Route className="h-3.5 w-3.5" />
          FX BUS CHANNELS
        </div>
        <div className="font-mono text-[9px] text-muted-foreground">DRY ROUTING · LEVEL · MUTE</div>
      </div>
      <div className="hairline mb-3" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {busLevels.map((bus, i) => (
          <div key={i} className={cn("panel-inset rounded-md p-2", bus.mute && "opacity-70")}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-display text-[10px] text-foreground">BUS {i + 1}</div>
              <button
                type="button"
                aria-label={`Mute bus ${i + 1}`}
                aria-pressed={bus.mute}
                onClick={() => toggleBusMute(i)}
                className={cn(
                  "h-6 w-7 rounded panel-inset grid place-items-center",
                  bus.mute ? "bg-neon-crimson text-primary-foreground border-neon-crimson" : "text-muted-foreground",
                )}
              >
                {bus.mute ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
            </div>
            <input
              aria-label={`Bus ${i + 1} volume`}
              type="range"
              min={0}
              max={100}
              value={bus.volume}
              onChange={(e) => setBusLevelAction(i, Number(e.target.value), bus.mute)}
              className="w-full h-1 accent-primary"
            />
            <div className="flex items-center justify-between mt-1 font-mono text-[8px] text-muted-foreground">
              <span>FX {String.fromCharCode(65 + i)}</span>
              <span className="text-primary">{bus.volume}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelStrip() {
  const { parts, selectedPart, setChannel } = useGroove();
  const p = parts[selectedPart];
  const c = p.channel;
  const types: DriveType[] = ["soft", "tape", "tube"];

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-xs flex items-center gap-2">
          <Sliders className="h-3.5 w-3.5 text-primary" />
          CHANNEL · <span className="text-primary">{p.name}</span>
        </div>
        <div className="font-mono text-[9px] text-muted-foreground">HP → LP → DRIVE → EQ → GAIN</div>
      </div>
      <div className="hairline mb-3" />

      <div className="grid grid-cols-4 gap-2">
        <Knob label="HP CUT" value={c.hpCut} min={0} max={100} unit="" onChange={(v) => setChannel(p.id, { hpCut: v })} color="primary" />
        <Knob label="HP RES" value={c.hpRes} min={0} max={100} unit="" onChange={(v) => setChannel(p.id, { hpRes: v })} color="primary" />
        <Knob label="LP CUT" value={c.lpCut} min={0} max={100} unit="" onChange={(v) => setChannel(p.id, { lpCut: v })} color="neon-cyan" />
        <Knob label="LP RES" value={c.lpRes} min={0} max={100} unit="" onChange={(v) => setChannel(p.id, { lpRes: v })} color="neon-cyan" />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 items-center">
        <Knob label="DRIVE" value={c.drive} min={0} max={100} unit="" onChange={(v) => setChannel(p.id, { drive: v })} color="neon-amber" />
        <div className="col-span-2 flex flex-col gap-1">
          <div className="font-mono text-[8px] text-muted-foreground">DRIVE TYPE</div>
          <div className="flex gap-1">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setChannel(p.id, { driveType: t })}
                className={cn(
                  "flex-1 h-7 rounded panel-inset font-mono text-[10px] uppercase",
                  c.driveType === t && "bg-gradient-primary text-primary-foreground border-primary"
                )}
              >{t}</button>
            ))}
          </div>
        </div>
        <Knob label="OUT" value={c.outGain} min={0} max={200} unit="" onChange={(v) => setChannel(p.id, { outGain: v })} color="neon-lime" />
      </div>

      <div className="mt-3">
        <div className="font-mono text-[8px] text-muted-foreground mb-1">EQ (dB)</div>
        <div className="grid grid-cols-3 gap-2">
          <Knob label="LOW" value={c.eqLow} min={-12} max={12} unit="dB" onChange={(v) => setChannel(p.id, { eqLow: v })} color="neon-magenta" />
          <Knob label="MID" value={c.eqMid} min={-12} max={12} unit="dB" onChange={(v) => setChannel(p.id, { eqMid: v })} color="neon-violet" />
          <Knob label="HIGH" value={c.eqHigh} min={-12} max={12} unit="dB" onChange={(v) => setChannel(p.id, { eqHigh: v })} color="neon-cyan" />
        </div>
      </div>
    </div>
  );
}

function SelectedPartSends() {
  const { parts, selectedPart, setSend, fx } = useGroove();
  const p = parts[selectedPart];
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-xs">{p.name} · FX SENDS</div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
          <Headphones className="h-3 w-3" /> CUE
        </div>
      </div>
      <div className="hairline mb-3" />
      <div className="grid grid-cols-6 gap-2">
        {fx.map((f, i) => (
          <div key={f.slot} className="panel-inset rounded-md p-2 flex flex-col items-center gap-1.5">
            <div className="font-display text-[10px] text-primary">FX {f.slot}</div>
            <div className="font-mono text-[8px] text-muted-foreground truncate w-full text-center">{f.type ?? "—"}</div>
            <div className="relative h-16 w-6 panel-inset rounded overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-accent" style={{ height: `${p.sends[i]}%` }} />
              <input type="range" min={0} max={100} value={p.sends[i]}
                onChange={(e) => setSend(p.id, i, Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0"
                style={{ writingMode: "vertical-lr", direction: "rtl" } as React.CSSProperties}
              />
            </div>
            <div className="font-mono text-[9px] text-primary">{p.sends[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MasterBus() {
  const { master, setMaster } = useGroove();
  const peakL = useMeter((s) => s.peakL);
  const peakR = useMeter((s) => s.peakR);
  const limiterReduction = useMeter((s) => s.limiterReduction);
  const grPct = Math.min(100, (limiterReduction / 12) * 100);
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-xs flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-neon-lime" />
          MASTER BUS
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-[2px]">
            <div className="h-1 w-16 bg-surface-0 rounded overflow-hidden">
              <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, peakL * 140)}%` }} />
            </div>
            <div className="h-1 w-16 bg-surface-0 rounded overflow-hidden">
              <div className="h-full bg-gradient-accent" style={{ width: `${Math.min(100, peakR * 140)}%` }} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-[2px]" title="Limiter gain reduction">
            <div className="font-mono text-[8px] text-muted-foreground leading-none">GR {limiterReduction.toFixed(1)}dB</div>
            <div className="h-1 w-16 bg-surface-0 rounded overflow-hidden">
              <div className="h-full bg-neon-crimson" style={{ width: `${grPct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="hairline mb-3" />

      <div className="grid grid-cols-3 gap-2">
        <Knob label="LOW" value={master.eqLow} min={-12} max={12} unit="dB" onChange={(v) => setMaster({ eqLow: v })} color="neon-magenta" />
        <Knob label="MID" value={master.eqMid} min={-12} max={12} unit="dB" onChange={(v) => setMaster({ eqMid: v })} color="neon-violet" />
        <Knob label="HIGH" value={master.eqHigh} min={-12} max={12} unit="dB" onChange={(v) => setMaster({ eqHigh: v })} color="neon-cyan" />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 items-center">
        <Knob label="WIDTH" value={master.width} min={0} max={200} unit="" onChange={(v) => setMaster({ width: v })} color="neon-amber" />
        <Knob label="SOFT CLIP" value={master.softClip} min={0} max={100} unit="" onChange={(v) => setMaster({ softClip: v })} color="neon-lime" />
        <button
          onClick={() => setMaster({ limiter: !master.limiter })}
          className={cn(
            "h-12 rounded-md panel-inset font-display text-[11px]",
            master.limiter && "neon-border text-neon-lime"
          )}
        >LIMITER {master.limiter ? "ON" : "OFF"}</button>
      </div>
    </div>
  );
}
