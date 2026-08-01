import { useState, useEffect } from "react";
import { useGroove, type AiStyle } from "@/lib/store";
import {
  buildGroove, buildMelody, type MelodyScale, type ScenebuildStyle,
} from "@/lib/audio/aiSceneBuild";
import type { PartCategory, Step } from "@/lib/model";
import { masterClock } from "@/lib/clock/masterClock";
import { Drum, Music, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLES: ScenebuildStyle[] =
  ["fourFloor", "boomBap", "trap", "breaks", "techno", "ambient", "minimal"];

// AI Style → generation parameter biases
const STYLE_TO_GROOVE: Record<AiStyle, ScenebuildStyle> = {
  CLASSIC:   "fourFloor",
  MINIMAL:   "minimal",
  COMPLEX:   "breaks",
  ORGANIC:   "ambient",
  DIGITAL:   "techno",
  CINEMATIC: "ambient",
  HYPNOTIC:  "techno",
  GLITCH:    "breaks",
};
const STYLE_DENSITY: Record<AiStyle, number> = {
  CLASSIC: 0.60, MINIMAL: 0.30, COMPLEX: 0.80, ORGANIC: 0.50,
  DIGITAL: 0.70, CINEMATIC: 0.40, HYPNOTIC: 0.65, GLITCH: 0.75,
};
const STYLE_SWING: Record<AiStyle, number> = {
  CLASSIC: 0.40, MINIMAL: 0.30, COMPLEX: 0.50, ORGANIC: 0.55,
  DIGITAL: 0.20, CINEMATIC: 0.45, HYPNOTIC: 0.60, GLITCH: 0.35,
};

const SCALE_OPTS: { k: MelodyScale; label: string }[] = [
  { k: "minorPent", label: "MIN PENT" },
  { k: "majorPent", label: "MAJ PENT" },
  { k: "naturalMinor", label: "NAT MIN" },
  { k: "dorian", label: "DORIAN" },
  { k: "major", label: "MAJOR" },
];

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const RHYTHM: PartCategory[] = ["kick", "snare", "hat", "perc"];
const MELODIC: PartCategory[] = ["bass", "synth", "sample"];

/**
 * AI Co-Assistant — suggests a coordinated GROOVE (across all rhythm parts) or
 * a MELODIC line (for one melodic part) on demand.
 *
 * Sync contract: the co-assistant CONSULTS the MasterClock (VibeCore Sync is
 * the single synchronizer of every module) for `bpm` + `beatsPerBar` and bar-
 * aligns its output to them. It never starts a timer, never sets tempo, and
 * never bypasses Sync — it only writes patterns / notes through the store,
 * which the scheduler already plays in lock-step with the clock.
 */
export function AiCoAssistant() {
  const { parts, patterns, selectedPattern, selectedSceneIdx, setPatternSteps, setNotes, aiStyle } =
    useGroove();
  const pattern = patterns[selectedPattern];
  const scene = pattern?.scenes[selectedSceneIdx];
  const sceneLen = scene?.length ?? 16;

  const rhythmParts = parts.filter((p) => RHYTHM.includes(p.category));
  const melodicParts = parts.filter((p) => MELODIC.includes(p.category));

  const [mode, setMode] = useState<"groove" | "melody">("groove");
  const [style, setStyle] = useState<ScenebuildStyle>(() => STYLE_TO_GROOVE[aiStyle] ?? "fourFloor");
  const [scale, setScale] = useState<MelodyScale>("minorPent");
  const [rootMidi, setRootMidi] = useState(60);
  const [density, setDensity] = useState(() => STYLE_DENSITY[aiStyle] ?? 0.6);
  const [swing, setSwing] = useState(() => STYLE_SWING[aiStyle] ?? 0.4);
  const [seed, setSeed] = useState(pattern?.seed ?? 0xC0FFEE);

  // When global AI Style changes, bias the generation parameters
  useEffect(() => {
    setStyle(STYLE_TO_GROOVE[aiStyle] ?? "fourFloor");
    setDensity(STYLE_DENSITY[aiStyle] ?? 0.6);
    setSwing(STYLE_SWING[aiStyle] ?? 0.4);
  }, [aiStyle]);
  const [melPartId, setMelPartId] = useState<number>(melodicParts[0]?.id ?? 0);
  const [preview, setPreview] = useState<
    { kind: "groove"; steps: boolean[] } | { kind: "melody"; notes: { step: number; len: number; pitch: number }[] } | null
  >(null);
  const [status, setStatus] = useState<string>("");

  const clock = masterClock.getState();
  const beatsPerBar = clock.beatsPerBar;

  // Existing scene context — preserve user hits (context merge) + lock bass to kick.
  const existingRhythm: Partial<Record<PartCategory, Step[]>> = {};
  const kickHits: number[] = [];
  if (scene) {
    for (const cat of RHYTHM) {
      const part = parts.find((p) => p.category === cat);
      if (!part) continue;
      const arr = scene.partSteps[part.id];
      if (arr) existingRhythm[cat] = arr;
      if (cat === "kick") {
        arr.forEach((s, i) => { if (s.on) kickHits.push(i); });
      }
    }
  }

  const generate = () => {
    if (mode === "groove") {
      const groove = buildGroove({
        style, density, swingProb: swing, seed, beatsPerBar, length: sceneLen,
        existing: existingRhythm,
      });
      let written = 0;
      for (const cat of RHYTHM) {
        const part = parts.find((p) => p.category === cat);
        if (part && groove[cat]) { setPatternSteps(part.id, groove[cat]); written++; }
      }
      setPreview({ kind: "groove", steps: groove.kick.map((s) => s.on) });
      setStatus(`Groove → ${written} parts · ${clock.bpm.toFixed(0)} BPM · ${beatsPerBar}/4 · ${clock.source}`);
    } else {
      const part = parts.find((p) => p.id === melPartId);
      if (!part) { setStatus("No melodic part available"); return; }
      const notes = buildMelody({
        scale, rootMidi, density, seed, beatsPerBar, length: sceneLen,
        category: part.category, kickHits,
      });
      setNotes(part.id, notes);
      setPreview({ kind: "melody", notes: notes.map((n) => ({ step: n.step, len: n.length, pitch: n.pitch })) });
      setStatus(`Melody → ${part.name} · ${notes.length} notes · ${clock.bpm.toFixed(0)} BPM · ${clock.source}`);
    }
  };

  const reroll = () => setSeed((s) => (s + 0x9e3779b1) >>> 0);

  return (
    <div className="space-y-3">
      {/* Sync context — the SOLE synchronizer; co-assistant only reads it. */}
      <div className="hw-bezel p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] text-primary">
          <Activity className="h-3.5 w-3.5" />
          SYNC · {clock.source.toUpperCase()} · {clock.bpm.toFixed(1)} BPM · {beatsPerBar}/4
        </div>
        <div className="font-mono text-[9px] text-muted-foreground">consults clock only</div>
      </div>

      {/* Mode toggle — groove vs melody */}
      <div className="hw-bezel p-1.5 flex gap-1">
        <ModeBtn active={mode === "groove"} onClick={() => setMode("groove")} icon={Drum} label="GROOVE" />
        <ModeBtn active={mode === "melody"} onClick={() => setMode("melody")} icon={Music} label="MELODY" />
      </div>

      <div className="hw-bezel p-3 space-y-3">
        {mode === "groove" ? (
          <Field label={`STYLE · targets ${rhythmParts.length} rhythm parts`}>
            <div className="flex flex-wrap gap-1">
              {STYLES.map((s) => (
                <button key={s} onClick={() => setStyle(s)} data-active={style === s}
                  className="tab-pill font-mono text-[10px] px-2 py-1 border border-border text-muted-foreground">
                  {s}
                </button>
              ))}
            </div>
          </Field>
        ) : melodicParts.length === 0 ? (
          <div className="font-mono text-[10px] text-muted-foreground text-center py-2">
            No synth/bass/sample part — add one to receive a melody.
          </div>
        ) : (
          <>
            <Field label="PART">
              <div className="flex flex-wrap gap-1">
                {melodicParts.map((p) => (
                  <button key={p.id} onClick={() => setMelPartId(p.id)} data-active={melPartId === p.id}
                    className="tab-pill font-mono text-[10px] px-2 py-1 border border-border text-muted-foreground">
                    {p.name}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="SCALE">
              <div className="flex flex-wrap gap-1">
                {SCALE_OPTS.map((s) => (
                  <button key={s.k} onClick={() => setScale(s.k)} data-active={scale === s.k}
                    className="tab-pill font-mono text-[10px] px-2 py-1 border border-border text-muted-foreground">
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="ROOT">
              <div className="flex flex-wrap gap-1">
                {ROOTS.map((r, i) => (
                  <button key={r} onClick={() => setRootMidi(i + 48)} data-active={rootMidi % 12 === i}
                    className="tab-pill font-mono text-[10px] px-2 py-1 border border-border text-muted-foreground">
                    {r}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        <Slider label="DENSITY" value={density} onChange={setDensity} />
        {mode === "groove" && <Slider label="SWING" value={swing} onChange={setSwing} />}

        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] text-muted-foreground">
            SEED <span className="text-primary tabular-nums">{seed.toString(16).padStart(8, "0").toUpperCase()}</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={reroll} className="hw-screen px-2 py-1 font-mono text-[10px] text-primary">REROLL</button>
            <button onClick={generate}
              className="hw-screen px-3 py-1.5 flex items-center gap-1.5 font-display text-[11px] text-primary">
              {mode === "groove" ? <Drum className="h-3.5 w-3.5" /> : <Music className="h-3.5 w-3.5" />} SUGGEST
            </button>
          </div>
        </div>
      </div>

      {status && <div className="font-mono text-[10px] text-center text-primary/80">{status}</div>}

      {preview?.kind === "groove" && (
        <div className="hw-bezel p-3">
          <div className="font-mono text-[10px] text-muted-foreground mb-2 tracking-widest">
            GROOVE PREVIEW · KICK · {preview.steps.length}
          </div>
          <div className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${Math.min(preview.steps.length, 16)}, minmax(0, 1fr))` }}>
            {preview.steps.map((on, i) => (
              <div key={i}
                className={cn("h-6 rounded-sm border", on ? "bg-primary border-primary" : "bg-secondary border-border")} />
            ))}
          </div>
        </div>
      )}

      {preview?.kind === "melody" && (
        <div className="hw-bezel p-3">
          <div className="font-mono text-[10px] text-muted-foreground mb-2 tracking-widest">
            MELODY PREVIEW · {preview.notes.length} NOTES · {sceneLen} STEPS
          </div>
          <div className="relative h-16 w-full rounded bg-secondary border border-border overflow-hidden">
            {preview.notes.map((n, i) => {
              const left = (n.step / Math.max(1, sceneLen)) * 100;
              const w = (n.len / Math.max(1, sceneLen)) * 100;
              const top = Math.max(0, Math.min(92, 100 - ((n.pitch - 36) / 60) * 100));
              return (
                <div key={i} className="absolute h-1.5 rounded-sm bg-accent"
                  style={{ left: `${left}%`, width: `${Math.max(2, w)}%`, top: `${top}%` }} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeBtn({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: typeof Drum; label: string;
}) {
  return (
    <button onClick={onClick} data-active={active}
      className={cn(
        "tab-pill flex-1 flex items-center justify-center gap-1.5 py-2 font-display text-[11px] tracking-wider",
        active ? "text-primary" : "text-muted-foreground",
      )}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-muted-foreground mb-1 tracking-widest">{label}</div>
      {children}
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex justify-between font-mono text-[10px]">
        <span className="text-muted-foreground tracking-widest">{label}</span>
        <span className="text-primary tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary h-1.5 w-full" />
    </label>
  );
}