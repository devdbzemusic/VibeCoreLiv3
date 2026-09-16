// VibeCoreLiv3 — 3D Bass Module Page.
//
// UX Rules: 8-parameter rule, 3-touch rule.
// Primary surface: 6 TactileSlider controls (Sub · Punch · Drive · Filter · Width · Glide).
// Portamento/Glide spans full width for expression.
// One-touch Piano Roll access (routes to GROOVE with bass part selected).

import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { TactileSlider } from "@/components/controls/TactileSlider";
import { TactileButton } from "@/components/controls/TactileButton";
import { Bass3DSubtab } from "./Bass3DSubtab";
import { AiContextButton } from "./AiContextButton";
import { InstrumentKeyboard } from "./InstrumentKeyboard";
import { defaultBass3D } from "@/lib/bass3d/params";
import { masterClock } from "@/lib/clock/masterClock";
import { buildMelody } from "@/lib/audio/aiSceneBuild";
import { useState } from "react";

// ── Individual horizontal slider row with label + value ──────────────────────
function ParamSlider({
  label, value, min = 0, max = 100, step = 1,
  onChange, display, color = "cyan",
}: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void; display?: string;
  color?: "cyan" | "magenta" | "amber" | "lime";
}) {
  return (
    <div className="flex items-center gap-3 panel-inset rounded-md px-3 py-2">
      <div className="font-mono text-[9px] text-muted-foreground w-14 shrink-0 tracking-widest">{label}</div>
      <TactileSlider
        value={value} min={min} max={max} step={step}
        onChange={onChange}
        orientation="horizontal" trackSize={8}
        color={color}
        className="flex-1"
      />
      <div className="font-display text-[11px] text-primary w-16 text-right shrink-0 tabular-nums">
        {display ?? String(Math.round(value))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Bass3DPage() {
  const {
    parts, selectedPart, selectPart, setSynthEngine, setPartSource, setBass3D,
    setTab, setNotes, patterns, selectedPattern, selectedSceneIdx,
  } = useGroove();
  const [deepOpen, setDeepOpen] = useState(false);

  useEffect(() => {
    const p = parts[selectedPart];
    if (p && p.category !== "bass") {
      const bassPart = parts.find((pt) => pt.category === "bass");
      if (bassPart) {
        selectPart(bassPart.id);
        return;
      }
    }
    if (p && p.synth.engine !== "3D Bass") {
      setSynthEngine(p.id, "3D Bass");
      setPartSource(p.id, "synth");
    }
  }, [parts, selectedPart, selectPart, setSynthEngine, setPartSource]);

  const p = parts[selectedPart];
  const b = p?.bass3d ?? defaultBass3D();
  if (!p) return null;

  const goToPianoRoll = () => {
    selectPart(p.id);
    setTab("ROLL");
  };

  const handleGenerateBassline = () => {
    const clock = masterClock.getState();
    const pattern = patterns[selectedPattern];
    if (!pattern) return;
    const sceneIdx = Math.min(selectedSceneIdx, pattern.scenes.length - 1);
    const scene = pattern.scenes[sceneIdx];
    const sceneLen = scene?.length ?? 16;
    const notes = buildMelody({
      scale: "minorPent",
      rootMidi: 36,
      density: 0.55,
      seed: (Date.now() & 0xFFFFFF) >>> 0,
      beatsPerBar: clock.beatsPerBar,
      length: sceneLen,
      category: "bass",
      kickHits: [],
    });
    setNotes(p.id, notes);
  };

  return (
    <div className="space-y-3">
      <div className="panel p-2">
        <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1.5">VOICE</div>
        <div className="no-scrollbar overflow-x-auto touch-scroll-x -mx-1 px-1">
          <div className="flex gap-1 min-w-max">
            {parts.map((pt) => (
              <button key={pt.id} onClick={() => selectPart(pt.id)}
                className={cn(
                  "shrink-0 h-11 min-w-[3.5rem] px-2 rounded panel-inset flex flex-col items-center justify-center gap-0.5",
                  pt.id === selectedPart && "neon-border text-primary")}>
                <span className="text-[7px] text-muted-foreground font-mono">{String(pt.id + 1).padStart(2, "0")}</span>
                <span className="font-display text-[9px] truncate w-full text-center">{pt.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary">CORE · SUB · PUNCH · DRIVE · FILTER · WIDTH</div>
          <AiContextButton label="AI Bassline" onAction={handleGenerateBassline} />
        </div>
        <div className="hairline mb-3" />

        <div className="space-y-2">
          <ParamSlider
            label="SUB"
            value={b.sub.level * 100} min={0} max={100}
            onChange={(v) => setBass3D(p.id, { sub: { ...b.sub, level: v / 100 } })}
            display={`${Math.round(b.sub.level * 100)}%`}
            color="cyan"
          />
          <ParamSlider
            label="PUNCH"
            value={b.dynamics.bassPunch.amount * 100} min={0} max={100}
            onChange={(v) => setBass3D(p.id, { dynamics: { ...b.dynamics, bassPunch: { ...b.dynamics.bassPunch, amount: v / 100 } } })}
            display={`${Math.round(b.dynamics.bassPunch.amount * 100)}%`}
            color="amber"
          />
          <ParamSlider
            label="DRIVE"
            value={b.drive.amount * 50} min={0} max={100}
            onChange={(v) => setBass3D(p.id, { drive: { ...b.drive, amount: v / 50 } })}
            display={`${Math.round(b.drive.amount * 100)}%`}
            color="amber"
          />
          <ParamSlider
            label="FILTER"
            value={Math.log10(b.filter1.freq / 20) / Math.log10(1000) * 100}
            min={0} max={100}
            onChange={(v) => {
              const freq = 20 * Math.pow(1000, v / 100);
              setBass3D(p.id, { filter1: { ...b.filter1, freq: Math.round(freq) } });
            }}
            display={b.filter1.freq >= 1000 ? `${(b.filter1.freq / 1000).toFixed(1)}k` : `${Math.round(b.filter1.freq)}`}
            color="magenta"
          />
          <ParamSlider
            label="WIDTH"
            value={b.spatial.width * 50} min={0} max={100}
            onChange={(v) => setBass3D(p.id, { spatial: { ...b.spatial, width: v / 50 } })}
            display={`${Math.round(b.spatial.width * 100)}%`}
            color="lime"
          />
        </div>
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">PORTAMENTO · GLIDE</div>
        <div className="hairline mb-3" />
        <ParamSlider
          label="GLIDE"
          value={b.performance.glideTime * 1000} min={0} max={2000} step={10}
          onChange={(v) => setBass3D(p.id, { performance: { ...b.performance, glideTime: Math.round(v) / 1000 } })}
          display={b.performance.glideTime === 0 ? "OFF" : `${Math.round(b.performance.glideTime * 1000)}ms`}
          color="cyan"
        />
        <div className="flex gap-2 mt-2">
          {(["poly", "mono", "legato"] as const).map((m) => (
            <button key={m}
              onClick={() => setBass3D(p.id, { performance: { ...b.performance, mode: m } })}
              className={cn("flex-1 h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
                b.performance.mode === m && "neon-border text-primary")}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <InstrumentKeyboard
        partId={p.id}
        instrument="bass3d"
        title={`BASS KEYS · ${p.name}`}
        baseOctave={2}
        gateSec={1}
      />

      <button
        onClick={goToPianoRoll}
        className="w-full h-11 panel-inset rounded-md flex items-center justify-center gap-2 font-display text-[11px] text-neon-cyan hover:neon-border transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        PIANO ROLL · {p.name}
      </button>

      <div className="panel p-3">
        <button
          onClick={() => setDeepOpen((o) => !o)}
          className="w-full flex items-center justify-between font-display text-xs text-muted-foreground"
        >
          <span>DEEP EDITOR</span>
          <span className="font-mono text-[10px]">{deepOpen ? "▾" : "▸"}</span>
        </button>
        {deepOpen && (
          <div className="mt-3">
            <Bass3DSubtab />
          </div>
        )}
      </div>
    </div>
  );
}
