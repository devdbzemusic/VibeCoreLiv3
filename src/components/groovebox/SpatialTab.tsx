import { useEffect, useRef, useState } from "react";
import { Power } from "lucide-react";
import {
  enableSpatial, disableSpatial, isSpatialEnabled, getSpatialParams,
  setSpatialParam, readSpatialPosition, type SpatialParams,
  getSpatialSync, setSpatialSync, type SpatialSyncState,
} from "@/lib/audio/quantumSpatial";
import { ALL_DIVISIONS, type Division } from "@/lib/clock/types";

const PARAMS: { key: keyof SpatialParams; label: string; min: number; max: number; bipolar?: boolean }[] = [
  { key: "width", label: "Width", min: 0, max: 1 },
  { key: "depth", label: "Depth", min: 0, max: 1 },
  { key: "distance", label: "Distance", min: 0, max: 1 },
  { key: "orbit", label: "Orbit", min: 0, max: 1 },
  { key: "rotation", label: "Rotation", min: 0, max: 1 },
  { key: "elevation", label: "Elevation", min: -1, max: 1, bipolar: true },
  { key: "motion", label: "Motion", min: 0, max: 1 },
  { key: "focus", label: "Focus", min: 0, max: 1 },
];

export function SpatialTab() {
  const [on, setOn] = useState(isSpatialEnabled());
  const [params, setParams] = useState<SpatialParams>(getSpatialParams());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>();

  useEffect(() => {
    const draw = () => {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) {
          const w = c.width, h = c.height;
          ctx.clearRect(0, 0, w, h);
          // Grid
          ctx.strokeStyle = "hsla(195, 100%, 55%, 0.12)";
          ctx.lineWidth = 1;
          for (let i = 0; i <= 8; i++) {
            const x = (i / 8) * w; const y = (i / 8) * h;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
          }
          // Concentric distance rings
          ctx.strokeStyle = "hsla(320, 100%, 60%, 0.2)";
          for (let r = 1; r <= 3; r++) {
            ctx.beginPath(); ctx.arc(w / 2, h / 2, (r / 3) * (w * 0.45), 0, Math.PI * 2); ctx.stroke();
          }
          // Position dot
          const pos = readSpatialPosition(performance.now() / 1000);
          const px = w / 2 + pos.x * (w * 0.42);
          const py = h / 2 + pos.y * (h * 0.42);
          const radius = 6 + (1 - pos.r) * 8;
          const grad = ctx.createRadialGradient(px, py, 1, px, py, radius * 2);
          grad.addColorStop(0, "hsla(38, 100%, 65%, 0.95)");
          grad.addColorStop(0.5, "hsla(320, 100%, 60%, 0.6)");
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(px, py, radius * 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "hsl(195, 100%, 90%)";
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const toggle = async () => {
    if (on) { disableSpatial(); setOn(false); }
    else { await enableSpatial(); setOn(true); }
  };
  const onParam = (k: keyof SpatialParams, v: number) => {
    setParams((p) => ({ ...p, [k]: v }));
    setSpatialParam(k, v);
  };

  return (
    <div className="p-3 space-y-3">
      <div className="hw-bezel p-3 flex items-center justify-between">
        <div>
          <div className="font-display text-sm text-primary tracking-widest">QUANTUM SPATIAL</div>
          <div className="font-mono text-[10px] text-muted-foreground">3D Orbit · Width · Depth · Focus</div>
        </div>
        <button onClick={toggle}
          className={`hw-screen px-3 py-2 flex items-center gap-2 font-display text-[11px] ${on ? "text-neon-magenta" : "text-muted-foreground"}`}>
          <Power className="h-3.5 w-3.5" />
          {on ? "ON" : "OFF"}
        </button>
      </div>

      <div className="hw-bezel p-2">
        <canvas ref={canvasRef} width={320} height={220} className="w-full h-[220px] hw-screen rounded" />
      </div>

      <div className="hw-bezel p-3 grid grid-cols-2 gap-3">
        {PARAMS.map(({ key, label, min, max, bipolar }) => (
          <label key={key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-muted-foreground tracking-widest">{label.toUpperCase()}</span>
              <span className="text-primary tabular-nums">
                {bipolar
                  ? (params[key] >= 0 ? "+" : "") + params[key].toFixed(2)
                  : params[key].toFixed(2)}
              </span>
            </div>
            <input type="range" min={min} max={max} step={0.01}
              value={params[key]}
              onChange={(e) => onParam(key, Number(e.target.value))}
              className="accent-primary h-1.5" />
          </label>
        ))}
      </div>

      <SpatialSyncPanel />
    </div>
  );
}

function SpatialSyncPanel() {
  const [sync, setSync] = useState<SpatialSyncState>(getSpatialSync());
  const update = <K extends keyof SpatialSyncState>(k: K, v: SpatialSyncState[K]) => {
    setSpatialSync(k, v);
    setSync(getSpatialSync());
  };
  const axes: { key: "orbitSync" | "motionSync" | "rotationSync"; divKey: "orbitDiv" | "motionDiv" | "rotationDiv"; label: string }[] = [
    { key: "orbitSync", divKey: "orbitDiv", label: "ORBIT" },
    { key: "motionSync", divKey: "motionDiv", label: "MOTION" },
    { key: "rotationSync", divKey: "rotationDiv", label: "ROTATION" },
  ];
  return (
    <div className="hw-bezel p-3 space-y-2">
      <div className="font-display text-[11px] text-neon-cyan tracking-widest">CLOCK SYNC</div>
      {axes.map(({ key, divKey, label }) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-muted-foreground">{label}</span>
            <button
              onClick={() => update(key, !sync[key])}
              className={`px-2 py-0.5 panel-inset rounded text-[9px] ${sync[key] ? "text-neon-cyan neon-border" : "text-muted-foreground"}`}
            >{sync[key] ? "SYNC" : "FREE"}</button>
          </div>
          <div className={`grid grid-cols-5 gap-1 ${!sync[key] && "opacity-40 pointer-events-none"}`}>
            {ALL_DIVISIONS.map((d) => (
              <button
                key={d}
                onClick={() => update(divKey, d as Division)}
                className={`h-7 panel-inset rounded font-mono text-[9px] ${sync[divKey] === d ? "neon-border text-neon-magenta" : "text-muted-foreground"}`}
              >{d}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
