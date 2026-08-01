import { useEffect, useMemo, useRef, useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Upload, Play, Sliders, Activity, Sparkles, Wand2, Volume2, Waves, Snowflake, Rewind, Repeat, Wind, Clock, Download } from "lucide-react";
import { assignBufferToPart, decodeSampleFile, ensureAudio, getBuffer, getCtx, grainModOffsets, resamplePart, triggerPart } from "@/lib/audio/engine";
import type { GrainDir, PlayMode, Slice, StretchMode, StretchQuality, SynthEngine, WaveEdit } from "@/lib/model";
import { equalSlice, sliceRegion } from "@/lib/sampleforge/sliceEngine";
import { useMeter, useVisibleParts } from "@/hooks/useMeter";
import { Synth3DSubtab } from "./Synth3DSubtab";
import { Bass3DSubtab } from "./Bass3DSubtab";

type SubTab = "SOURCE" | "WAVE" | "SLICE" | "GRAIN" | "STRETCH" | "SYNTH" | "FILTER" | "MOD" | "FX";

const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "SOURCE", label: "SRC", icon: Wand2 },
  { key: "WAVE", label: "WAVE", icon: Waves },
  { key: "SLICE", label: "SLICE", icon: Sparkles },
  { key: "GRAIN", label: "GRAIN", icon: Wind },
  { key: "STRETCH", label: "STR", icon: Clock },
  { key: "SYNTH", label: "SYNTH", icon: Sparkles },
  { key: "FILTER", label: "FILT", icon: Sliders },
  { key: "MOD", label: "MOD", icon: Activity },
  { key: "FX", label: "FX", icon: Volume2 },
];

function Knob({ label, value, min = 0, max = 100, step = 1, onChange, color = "primary", suffix }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; color?: string; suffix?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 panel-inset rounded-md p-2">
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest">{label}</div>
      <div className="font-display text-[11px] text-primary">{Math.round(value)}{suffix ?? ""}</div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("w-full h-1 accent-primary touch-none")}
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "h-9 rounded-md panel-inset font-mono text-[10px] flex items-center justify-center gap-1",
        value && "neon-border text-primary"
      )}
    >
      {label}
    </button>
  );
}

function PartPickerCell({ p, selected, onSelect }: {
  p: ReturnType<typeof useGroove.getState>["parts"][number];
  selected: boolean;
  onSelect: () => void;
}) {
  const peak = useMeter((s) => s.partPeaks[p.id] ?? 0);
  return (
    <button
      onClick={onSelect}
      className={cn(
        "shrink-0 w-14 panel-inset rounded p-1 flex flex-col items-center gap-0.5 touch-none",
        selected && "neon-border"
      )}
    >
      <span className="font-mono text-[8px] text-muted-foreground">{String(p.id + 1).padStart(2, "0")}</span>
      <span className="font-display text-[9px] truncate w-full text-center" style={{ color: `hsl(var(--${p.color}))` }}>{p.name}</span>
      <span className={cn("h-1 w-full rounded-full",
        peak > 0.6 ? "bg-neon-crimson" : peak > 0.05 ? "bg-neon-lime" : "bg-surface-1")} />
    </button>
  );
}

function PartPicker() {
  const { parts, selectedPart, selectPart } = useGroove();
  const visibleIds = useMemo(() => parts.map((p) => p.id), [parts]);
  useVisibleParts(visibleIds);
  return (
    <div className="no-scrollbar overflow-x-auto -mx-3 px-3">
      <div className="flex gap-1 min-w-max">
        {parts.map((p) => (
          <PartPickerCell key={p.id} p={p} selected={p.id === selectedPart} onSelect={() => selectPart(p.id)} />
        ))}
      </div>
    </div>
  );
}

function SourceSubtab() {
  const { parts, selectedPart, setPartSource, setPartSampleName } = useGroove();
  const p = parts[selectedPart];
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f?: File | null) => {
    if (!f) return;
    const buf = await decodeSampleFile(f);
    assignBufferToPart(p.id, buf);
    setPartSampleName(p.id, f.name);
  };

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">SOURCE MODE — {p.name}</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-3 gap-1.5">
          {(["sample", "synth", "hybrid"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPartSource(p.id, m)}
              className={cn(
                "h-12 panel-inset rounded font-display text-[11px] uppercase",
                p.source === m && "neon-border text-primary"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs">SAMPLE</div>
          <label className="h-7 px-2 rounded panel-inset font-mono text-[10px] flex items-center gap-1 cursor-pointer">
            <Upload className="h-3 w-3" /> LOAD
            <input ref={fileRef} type="file" accept="audio/*" className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="hairline mb-2" />
        <div className="font-mono text-[10px] text-muted-foreground">
          {p.sampleName ? <span className="text-neon-lime">{p.sampleName}</span> : "no sample loaded"}
        </div>
      </div>

      {p.source === "hybrid" && <HybridPanel />}

      <div className="panel p-3">
        <button
          onClick={async () => { await ensureAudio(); triggerPart(p.id, getCtx()!.currentTime, { velocity: 110, semitone: 0, gateSec: 0.5 }); }}
          className="w-full h-12 rounded-md bg-gradient-primary text-primary-foreground font-display text-[11px] tracking-widest"
        >
          ▶  AUDITION VOICE
        </button>
      </div>
    </div>
  );
}

function HybridPanel() {
  const { parts, selectedPart, setHybridParam } = useGroove();
  const p = parts[selectedPart];
  const h = p.hybrid;
  return (
    <div className="panel p-3">
      <div className="font-display text-xs text-primary mb-2">HYBRID MIX</div>
      <div className="hairline mb-2" />
      <div className="grid grid-cols-4 gap-1.5">
        <Knob label="SMPL" value={h.sampleMix} onChange={(v) => setHybridParam(p.id, { sampleMix: v })} />
        <Knob label="SYNTH" value={h.synthMix} onChange={(v) => setHybridParam(p.id, { synthMix: v })} />
        <Knob label="SUB" value={h.subMix} onChange={(v) => setHybridParam(p.id, { subMix: v })} />
        <Knob label="SUB Hz" value={h.subFreq} onChange={(v) => setHybridParam(p.id, { subFreq: v })} />
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <Toggle label={`SMPL ${h.samplePhase ? "Ø" : "+"}`} value={h.samplePhase} onChange={(v) => setHybridParam(p.id, { samplePhase: v })} />
        <Toggle label={`SYNTH ${h.synthPhase ? "Ø" : "+"}`} value={h.synthPhase} onChange={(v) => setHybridParam(p.id, { synthPhase: v })} />
      </div>
    </div>
  );
}

function WaveSubtab() {
  const { parts, selectedPart, setWaveEdit } = useGroove();
  const p = parts[selectedPart];
  const w = p.wave;
  const buf = getBuffer(p.id);

  const peaks = useMemo(() => {
    if (!buf) return Array.from({ length: 128 }, (_, i) => Math.abs(Math.sin(i * 0.21)) * 0.5);
    const d = buf.getChannelData(0);
    const bins = 128;
    const block = Math.max(1, Math.floor(d.length / bins));
    const out: number[] = [];
    for (let i = 0; i < bins; i++) {
      let pk = 0;
      for (let j = 0; j < block; j += 16) {
        const a = Math.abs(d[i * block + j] || 0); if (a > pk) pk = a;
      }
      out.push(Math.min(1, pk));
    }
    return out;
  }, [buf]);

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary">WAVE EDITOR</div>
          <div className="font-mono text-[9px] text-muted-foreground">{buf ? `${buf.duration.toFixed(2)}s` : "—"}</div>
        </div>
        <div className="panel-inset rounded-md relative h-28 overflow-hidden scanline">
          <div className="absolute inset-1 flex items-center gap-[1px]">
            {peaks.map((v, i) => (
              <div key={i} className="flex-1 bg-gradient-primary rounded-sm"
                style={{ height: `${Math.max(2, v * 100)}%`, opacity: 0.5 + v * 0.5 }} />
            ))}
          </div>
          {Array.from({ length: w.slices - 1 }).map((_, i) => (
            <div key={i} className="absolute top-1 bottom-1 w-px bg-neon-amber/70"
              style={{ left: `${((i + 1) / w.slices) * 100}%` }} />
          ))}
          <div className="absolute top-0 bottom-0 w-px bg-neon-cyan shadow-[0_0_4px_hsl(var(--primary))]"
            style={{ left: `${w.start * 100}%` }} />
          <div className="absolute top-0 bottom-0 w-px bg-neon-magenta shadow-[0_0_4px_hsl(var(--magenta))]"
            style={{ left: `${w.end * 100}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <Knob label="START" value={w.start * 100} onChange={(v) => setWaveEdit(p.id, { start: v / 100 })} />
          <Knob label="END" value={w.end * 100} onChange={(v) => setWaveEdit(p.id, { end: v / 100 })} />
        </div>
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">ENVELOPE & TRIM</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          <Knob label="FADE IN" value={w.fadeIn} onChange={(v) => setWaveEdit(p.id, { fadeIn: v })} />
          <Knob label="FADE OUT" value={w.fadeOut} onChange={(v) => setWaveEdit(p.id, { fadeOut: v })} />
          <Knob label="X-FADE" value={w.xfade} onChange={(v) => setWaveEdit(p.id, { xfade: v })} />
          <Knob label="SLICES" value={w.slices} min={2} max={64} step={1} onChange={(v) => setWaveEdit(p.id, { slices: v })} />
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          <Toggle label="LOOP" value={w.loop} onChange={(v) => setWaveEdit(p.id, { loop: v })} />
          <Toggle label="REVERSE" value={w.reverse} onChange={(v) => setWaveEdit(p.id, { reverse: v })} />
          <Toggle label="NORMAL." value={w.normalize} onChange={(v) => setWaveEdit(p.id, { normalize: v })} />
          <Toggle label="FREEZE" value={w.freeze} onChange={(v) => setWaveEdit(p.id, { freeze: v })} />
        </div>
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">PITCH / STRETCH / GRAIN</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-2 gap-1.5">
          <Knob label="PITCH ±24" value={w.pitchShift} min={-24} max={24} onChange={(v) => setWaveEdit(p.id, { pitchShift: v })} suffix="st" />
          <Knob label="STRETCH%" value={w.timeStretch} min={25} max={400} onChange={(v) => setWaveEdit(p.id, { timeStretch: v })} />
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          <Knob label="G-SIZE" value={w.grainSize} onChange={(v) => setWaveEdit(p.id, { grainSize: v })} />
          <Knob label="G-DENS" value={w.grainDensity} onChange={(v) => setWaveEdit(p.id, { grainDensity: v })} />
          <Knob label="G-POS" value={w.grainPos} onChange={(v) => setWaveEdit(p.id, { grainPos: v })} />
          <Knob label="G-SPRAY" value={w.grainSpray} onChange={(v) => setWaveEdit(p.id, { grainSpray: v })} />
        </div>
      </div>
    </div>
  );
}

function SynthSubtab() {
  const { parts, selectedPart, setSynthEngine, setSynthParam, setPartSource } = useGroove();
  const p = parts[selectedPart];
  const s = p.synth;
  const engines: SynthEngine[] = ["Kick", "Snare", "Hat", "Bass", "Synth", "3D", "3D Bass"];

  // VibeCore 3D Synth — dedicated workflow-first editor (UX_GOVERNANCE.md)
  if (s.engine === "3D" || s.engine === "3D Bass") {
    return (
      <div className="space-y-3">
        <div className="panel p-3">
          <div className="font-display text-xs text-primary mb-2">SYNTH ENGINE</div>
          <div className="hairline mb-2" />
          <div className="grid grid-cols-7 gap-1">
            {engines.map((e) => (
              <button
                key={e}
                onClick={() => { setSynthEngine(p.id, e); if (e === "3D" || e === "3D Bass") setPartSource(p.id, "synth"); }}
                className={cn("h-10 panel-inset rounded font-display text-[9px]",
                  s.engine === e && "neon-border text-primary")}
              >
                {e.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {s.engine === "3D" && <Synth3DSubtab />}
        {s.engine === "3D Bass" && <Bass3DSubtab />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">SYNTH ENGINE</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-7 gap-1">
          {engines.map((e) => (
            <button
              key={e}
              onClick={() => { setSynthEngine(p.id, e); if (e === "3D" || e === "3D Bass") setPartSource(p.id, "synth"); }}
              className={cn("h-10 panel-inset rounded font-display text-[9px]",
                s.engine === e && "neon-border text-primary")}
            >
              {e.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-3 space-y-2">
        <div className="font-display text-xs">{s.engine.toUpperCase()} DESIGNER</div>
        <div className="hairline" />
        {s.engine === "Kick" && (
          <div className="grid grid-cols-3 gap-1.5">
            <Knob label="PITCH" value={s.kPitch} onChange={(v) => setSynthParam(p.id, "kPitch", v)} />
            <Knob label="CLICK" value={s.kClick} onChange={(v) => setSynthParam(p.id, "kClick", v)} />
            <Knob label="BODY" value={s.kBody} onChange={(v) => setSynthParam(p.id, "kBody", v)} />
            <Knob label="SUB" value={s.kSub} onChange={(v) => setSynthParam(p.id, "kSub", v)} />
            <Knob label="DRIVE" value={s.kDrive} onChange={(v) => setSynthParam(p.id, "kDrive", v)} />
            <Knob label="DECAY" value={s.kDecay} onChange={(v) => setSynthParam(p.id, "kDecay", v)} />
          </div>
        )}
        {s.engine === "Snare" && (
          <div className="grid grid-cols-4 gap-1.5">
            <Knob label="NOISE" value={s.sNoise} onChange={(v) => setSynthParam(p.id, "sNoise", v)} />
            <Knob label="TONE" value={s.sTone} onChange={(v) => setSynthParam(p.id, "sTone", v)} />
            <Knob label="SNAP" value={s.sSnap} onChange={(v) => setSynthParam(p.id, "sSnap", v)} />
            <Knob label="DECAY" value={s.sDecay} onChange={(v) => setSynthParam(p.id, "sDecay", v)} />
          </div>
        )}
        {s.engine === "Hat" && (
          <div className="grid grid-cols-4 gap-1.5">
            <Knob label="METAL" value={s.hMetal} onChange={(v) => setSynthParam(p.id, "hMetal", v)} />
            <Knob label="NOISE" value={s.hNoise} onChange={(v) => setSynthParam(p.id, "hNoise", v)} />
            <Knob label="FILTER" value={s.hFilter} onChange={(v) => setSynthParam(p.id, "hFilter", v)} />
            <Knob label="DECAY" value={s.hDecay} onChange={(v) => setSynthParam(p.id, "hDecay", v)} />
          </div>
        )}
        {s.engine === "Bass" && (
          <div className="grid grid-cols-3 gap-1.5">
            <Knob label="OSC" value={s.bOsc} onChange={(v) => setSynthParam(p.id, "bOsc", v)} />
            <Knob label="SUB" value={s.bSub} onChange={(v) => setSynthParam(p.id, "bSub", v)} />
            <Knob label="FILTER" value={s.bFilter} onChange={(v) => setSynthParam(p.id, "bFilter", v)} />
            <Knob label="FM" value={s.bFm} onChange={(v) => setSynthParam(p.id, "bFm", v)} />
            <Knob label="GLIDE" value={s.bGlide} onChange={(v) => setSynthParam(p.id, "bGlide", v)} />
            <Knob label="DECAY" value={s.bDecay} onChange={(v) => setSynthParam(p.id, "bDecay", v)} />
          </div>
        )}
        {s.engine === "Synth" && (
          <>
            <div className="font-mono text-[9px] text-muted-foreground">FM MORPH ENGINE</div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob label="FM AMT" value={s.fmAmount} onChange={(v) => setSynthParam(p.id, "fmAmount", v)} />
              <Knob label="FM RATIO" value={s.fmRatio} onChange={(v) => setSynthParam(p.id, "fmRatio", v)} />
              <Knob label="MORPH" value={s.morph} onChange={(v) => setSynthParam(p.id, "morph", v)} />
              <Knob label="VOICES" value={s.voices} min={1} max={8} step={1} onChange={(v) => setSynthParam(p.id, "voices", v)} />
              <Knob label="DETUNE" value={s.detune} onChange={(v) => setSynthParam(p.id, "detune", v)} />
              <Knob label="SPREAD" value={s.spread} onChange={(v) => setSynthParam(p.id, "spread", v)} />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Knob label="ATT" value={s.fAttack} onChange={(v) => setSynthParam(p.id, "fAttack", v)} />
              <Knob label="DEC" value={s.fDecay} onChange={(v) => setSynthParam(p.id, "fDecay", v)} />
              <Knob label="SUS" value={s.fSustain} onChange={(v) => setSynthParam(p.id, "fSustain", v)} />
              <Knob label="REL" value={s.fRelease} onChange={(v) => setSynthParam(p.id, "fRelease", v)} />
            </div>
          </>
        )}
      </div>

      <button
        onClick={async () => { await ensureAudio(); triggerPart(p.id, getCtx()!.currentTime, { velocity: 110, semitone: 0, gateSec: 0.6 }); }}
        className="w-full h-12 rounded-md bg-gradient-primary text-primary-foreground font-display text-[11px] tracking-widest"
      >
        ▶  AUDITION
      </button>
    </div>
  );
}

function FilterSubtab() {
  const { parts, selectedPart, setChannel } = useGroove();
  const p = parts[selectedPart];
  const c = p.channel;
  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">FILTERS — {p.name}</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          <Knob label="HP CUT" value={c.hpCut} onChange={(v) => setChannel(p.id, { hpCut: v })} />
          <Knob label="HP RES" value={c.hpRes} onChange={(v) => setChannel(p.id, { hpRes: v })} />
          <Knob label="LP CUT" value={c.lpCut} onChange={(v) => setChannel(p.id, { lpCut: v })} />
          <Knob label="LP RES" value={c.lpRes} onChange={(v) => setChannel(p.id, { lpRes: v })} />
        </div>
      </div>
      <div className="panel p-3">
        <div className="font-display text-xs mb-2">DRIVE & EQ</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          <Knob label="DRIVE" value={c.drive} onChange={(v) => setChannel(p.id, { drive: v })} />
          <Knob label="LOW" value={c.eqLow} min={-12} max={12} onChange={(v) => setChannel(p.id, { eqLow: v })} suffix="dB" />
          <Knob label="MID" value={c.eqMid} min={-12} max={12} onChange={(v) => setChannel(p.id, { eqMid: v })} suffix="dB" />
          <Knob label="HIGH" value={c.eqHigh} min={-12} max={12} onChange={(v) => setChannel(p.id, { eqHigh: v })} suffix="dB" />
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {(["soft", "tape", "tube"] as const).map((t) => (
            <button key={t}
              onClick={() => setChannel(p.id, { driveType: t })}
              className={cn("h-9 panel-inset rounded font-mono text-[10px] uppercase",
                c.driveType === t && "neon-border text-primary")}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModFxLink({ to, title, desc }: { to: "MOD" | "FX"; title: string; desc: string }) {
  const { setTab } = useGroove();
  const target = to === "MOD" ? "PTN" : "FX";
  return (
    <div className="panel p-4 space-y-2">
      <div className="font-display text-xs text-primary">{title}</div>
      <div className="hairline" />
      <div className="font-mono text-[10px] text-muted-foreground">{desc}</div>
      <button
        onClick={() => setTab(target as Parameters<typeof setTab>[0])}
        className="w-full h-11 rounded-md bg-gradient-primary text-primary-foreground font-display text-[11px] tracking-widest"
      >
        OPEN {to} EDITOR ▸
      </button>
    </div>
  );
}

function FxSendsPanel() {
  const { parts, selectedPart, fx, setSend } = useGroove();
  const p = parts[selectedPart];
  return (
    <div className="panel p-3">
      <div className="font-display text-xs mb-2">FX SENDS</div>
      <div className="hairline mb-2" />
      <div className="grid grid-cols-3 gap-1.5">
        {fx.map((f, i) => (
          <div key={i} className="panel-inset rounded p-2">
            <div className="font-mono text-[8px] text-muted-foreground">SEND {f.slot}</div>
            <div className="font-display text-[9px] truncate">{f.type ?? "—"}</div>
            <input type="range" min={0} max={100} value={p.sends[i]}
              onChange={(e) => setSend(p.id, i, Number(e.target.value))}
              className="w-full mt-1 accent-primary touch-none" />
            <div className="font-mono text-[9px] text-primary text-right">{p.sends[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Granular ─────────────────────────────────────────────────

interface GrainPreset { label: string; patch: Partial<WaveEdit>; }
const GRAIN_PRESETS: GrainPreset[] = [
  { label: "CLOUD",   patch: { granEnabled: true,  grainSize: 35, grainDensity: 45, grainSpray: 50, granDir: "fwd", granRandPitch: 0,  granRandPan: 25, granWidth: 120, granFreeze: false } },
  { label: "DRONE",   patch: { granEnabled: true,  grainSize: 65, grainDensity: 35, grainSpray: 5,  granDir: "fwd", granRandPitch: 0,  granRandPan: 10, granWidth: 100, granFreeze: true,  freezePos: 30, freezeMix: 100 } },
  { label: "TEXTURE", patch: { granEnabled: true,  grainSize: 20, grainDensity: 70, grainSpray: 50, granDir: "rnd", granRandPitch: 25, granRandPan: 25, granWidth: 160, granFreeze: false } },
  { label: "SHIMMER", patch: { granEnabled: true,  grainSize: 28, grainDensity: 24, grainSpray: 35, granDir: "fwd", granRandPitch: 10, granRandPan: 25, granWidth: 140, granPitch: 12 } },
];

function GrainVisualizer({ partId }: { partId: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = getBuffer(partId);
  const peaks = useMemo(() => {
    if (!buf) return new Array(180).fill(0);
    const d = buf.getChannelData(0);
    const bins = 180; const block = Math.max(1, Math.floor(d.length / bins)); const out: number[] = [];
    for (let i = 0; i < bins; i++) {
      let pk = 0;
      for (let j = 0; j < block; j += 16) { const a = Math.abs(d[i * block + j] || 0); if (a > pk) pk = a; }
      out.push(Math.min(1, pk));
    }
    return out;
  }, [buf]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cvs = ref.current; if (!cvs) return;
      const w = cvs.width = cvs.clientWidth;
      const h = cvs.height = cvs.clientHeight;
      const ctx = cvs.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);
      // waveform
      ctx.fillStyle = "hsl(195 100% 50% / 0.7)";
      const bw = w / peaks.length;
      peaks.forEach((v, i) => {
        const bh = Math.max(2, v * h);
        ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 1), bh);
      });
      // grain cursor
      const part = useGroove.getState().parts[partId];
      if (part) {
        const w_ = part.wave;
        const isFreeze = w_.granFreeze || w_.freeze;
        const base = isFreeze ? w_.freezePos / 100 : w_.grainPos / 100;
        const mod = isFreeze ? (grainModOffsets.freezePos.get(partId) ?? 0) : (grainModOffsets.pos.get(partId) ?? 0);
        const pos = Math.max(0, Math.min(1, base + mod));
        ctx.fillStyle = "hsl(320 100% 60%)";
        ctx.fillRect(pos * w - 1, 0, 2, h);
        // spray field
        const spray = Math.min(0.5, w_.grainSpray / 100);
        ctx.fillStyle = "hsl(320 100% 60% / 0.18)";
        ctx.fillRect(Math.max(0, (pos - spray / 2) * w), 0, spray * w, h);
        // density particles
        ctx.fillStyle = "hsl(140 100% 55% / 0.8)";
        const n = Math.round(1 + (w_.grainDensity / 100) * 8);
        for (let i = 0; i < n; i++) {
          const x = Math.random() * w; const y = Math.random() * h;
          ctx.fillRect(x, y, 1.5, 1.5);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [partId, peaks]);
  return <canvas ref={ref} className="w-full h-24 rounded panel-inset" />;
}

function GrainSubtab() {
  const { parts, selectedPart, setWaveEdit, setPartSampleName } = useGroove();
  const p = parts[selectedPart];
  const w = p.wave;
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const applyPreset = (preset: GrainPreset) => setWaveEdit(p.id, preset.patch);

  const doResample = async () => {
    setBusy(true);
    setStatus("Resampling 4s…");
    await ensureAudio();
    const buf = await resamplePart(p.id, 4);
    if (buf) {
      setPartSampleName(p.id, `RESAMPLE ${new Date().toLocaleTimeString().slice(0,5)}`);
      setStatus(`Resampled → ${buf.duration.toFixed(1)}s`);
    } else {
      setStatus("Need a loaded sample first");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary">GRANULAR ENGINE — {p.name}</div>
          <Toggle label={w.granEnabled ? "ON" : "OFF"} value={w.granEnabled} onChange={(v) => setWaveEdit(p.id, { granEnabled: v })} />
        </div>
        <GrainVisualizer partId={p.id} />
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">PRESETS</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          {GRAIN_PRESETS.map((pr) => (
            <button key={pr.label} onClick={() => applyPreset(pr)}
              className="h-10 panel-inset rounded font-display text-[10px] text-primary active:bg-primary/20">
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">GRAIN PARAMETERS</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          <Knob label="SIZE ms" value={40 + (w.grainSize / 100) * 460} min={40} max={500} onChange={(v) => setWaveEdit(p.id, { grainSize: Math.round(((v - 40) / 460) * 100) })} />
          <Knob label="DENSITY" value={1 + (w.grainDensity / 100) * 15} min={1} max={16} step={1} onChange={(v) => setWaveEdit(p.id, { grainDensity: Math.round(((v - 1) / 15) * 100) })} />
          <Knob label="POSITION" value={w.grainPos} onChange={(v) => setWaveEdit(p.id, { grainPos: v })} suffix="%" />
          <Knob label="SPRAY" value={Math.min(50, w.grainSpray)} max={50} onChange={(v) => setWaveEdit(p.id, { grainSpray: v })} suffix="%" />
          <Knob label="PITCH ±24" value={w.granPitch} min={-24} max={24} onChange={(v) => setWaveEdit(p.id, { granPitch: v })} suffix="st" />
          <Knob label="RND PITCH" value={Math.min(25, w.granRandPitch)} max={25} onChange={(v) => setWaveEdit(p.id, { granRandPitch: v })} suffix="%" />
          <Knob label="RND PAN" value={Math.min(25, w.granRandPan)} max={25} onChange={(v) => setWaveEdit(p.id, { granRandPan: v })} suffix="%" />
          <Knob label="WIDTH" value={w.granWidth} min={0} max={200} onChange={(v) => setWaveEdit(p.id, { granWidth: v })} suffix="%" />
          <Knob label="GAIN dB" value={w.granGain} min={-24} max={12} onChange={(v) => setWaveEdit(p.id, { granGain: v })} suffix="dB" />
        </div>
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">DIRECTION & FREEZE</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {(["fwd", "rev", "rnd"] as GrainDir[]).map((d) => (
            <button key={d} onClick={() => setWaveEdit(p.id, { granDir: d })}
              className={cn("h-9 panel-inset rounded font-mono text-[10px] uppercase",
                w.granDir === d && "neon-border text-primary")}>
              {d === "fwd" ? "FORWARD" : d === "rev" ? "REVERSE" : "RANDOM"}
            </button>
          ))}
        </div>
        <Toggle label={`FREEZE ${w.granFreeze ? "ON" : "OFF"}`} value={w.granFreeze} onChange={(v) => setWaveEdit(p.id, { granFreeze: v })} />
        {(w.granFreeze || w.freeze) && (
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            <Knob label="FRZ POS" value={w.freezePos} onChange={(v) => setWaveEdit(p.id, { freezePos: v })} suffix="%" />
            <Knob label="FRZ SIZE" value={w.freezeSize} min={10} max={5000} onChange={(v) => setWaveEdit(p.id, { freezeSize: v })} suffix="ms" />
            <Knob label="FRZ FBK" value={w.freezeFb} onChange={(v) => setWaveEdit(p.id, { freezeFb: v })} suffix="%" />
            <Knob label="FRZ MIX" value={w.freezeMix} onChange={(v) => setWaveEdit(p.id, { freezeMix: v })} suffix="%" />
          </div>
        )}
      </div>

      <button onClick={doResample} disabled={busy}
        className="w-full h-12 rounded-md bg-gradient-primary text-primary-foreground font-display text-[11px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
        <Download className="h-4 w-4" /> RESAMPLE → SAMPLE (4s)
      </button>
      {status && <div className="font-mono text-[10px] text-neon-cyan text-center">{status}</div>}
    </div>
  );
}

// ─── Stretch ───────────────────────────────────────────────────

function StretchSubtab() {
  const { parts, selectedPart, setWaveEdit } = useGroove();
  const p = parts[selectedPart];
  const w = p.wave;
  const PRESETS = [25, 50, 75, 100, 200, 400, 800];
  const MODES: { k: StretchMode; l: string }[] = [
    { k: "tape", l: "TAPE" }, { k: "dj", l: "DJ" },
    { k: "granular", l: "GRAN" }, { k: "hybrid", l: "HYBRID" },
  ];
  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">TIME-STRETCH — {p.name}</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          {MODES.map((m) => (
            <button key={m.k} onClick={() => setWaveEdit(p.id, { stretchMode: m.k })}
              className={cn("h-10 panel-inset rounded font-display text-[10px]",
                w.stretchMode === m.k && "neon-border text-primary")}>
              {m.l}
            </button>
          ))}
        </div>
        <div className="font-mono text-[9px] text-muted-foreground mt-2">
          {w.stretchMode === "tape" && "Pitch follows tempo (varispeed)"}
          {w.stretchMode === "dj" && "Tempo changes, pitch preserved (granular)"}
          {w.stretchMode === "granular" && "Granular stretch engine"}
          {w.stretchMode === "hybrid" && "Granular + phase-style xfade"}
        </div>
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">STRETCH AMOUNT</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-7 gap-1">
          {PRESETS.map((v) => (
            <button key={v} onClick={() => setWaveEdit(p.id, { timeStretch: v })}
              className={cn("h-9 panel-inset rounded font-mono text-[10px]",
                Math.round(w.timeStretch) === v && "neon-border text-primary")}>
              {v}%
            </button>
          ))}
        </div>
        <div className="mt-2">
          <Knob label="STRETCH %" value={w.timeStretch} min={25} max={800} onChange={(v) => setWaveEdit(p.id, { timeStretch: v })} suffix="%" />
        </div>
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">QUALITY & PRESERVE</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {(["low", "medium", "high"] as StretchQuality[]).map((q) => (
            <button key={q} onClick={() => setWaveEdit(p.id, { stretchQuality: q })}
              className={cn("h-9 panel-inset rounded font-mono text-[10px] uppercase",
                w.stretchQuality === q && "neon-border text-primary")}>
              {q}
            </button>
          ))}
        </div>
        <Toggle label={`FORMANT PRESERVE ${w.formant ? "ON" : "OFF"}`} value={w.formant} onChange={(v) => setWaveEdit(p.id, { formant: v })} />
      </div>

      <div className="panel p-3">
        <div className="font-display text-xs mb-2">PLAY MODE</div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { k: "forward",  l: "FORWARD",  Icon: Play },
            { k: "reverse",  l: "REVERSE",  Icon: Rewind },
            { k: "pingpong", l: "PINGPONG", Icon: Repeat },
          ] as { k: PlayMode; l: string; Icon: React.ComponentType<{ className?: string }> }[]).map(({ k, l, Icon }) => (
            <button key={k} onClick={() => setWaveEdit(p.id, { playMode: k, reverse: k === "reverse" })}
              className={cn("h-10 panel-inset rounded flex items-center justify-center gap-1 font-mono text-[10px]",
                w.playMode === k && "neon-border text-primary")}>
              <Icon className="h-3.5 w-3.5" /> {l}
            </button>
          ))}
        </div>
        <div className="font-mono text-[9px] text-muted-foreground mt-2">
          Original sample remains intact — non-destructive.
        </div>
      </div>

      <button
        onClick={async () => { await ensureAudio(); triggerPart(p.id, getCtx()!.currentTime, { velocity: 110, semitone: 0, gateSec: 1.5 }); }}
        className="w-full h-12 rounded-md bg-gradient-primary text-primary-foreground font-display text-[11px] tracking-widest">
        ▶ AUDITION STRETCH
      </button>
    </div>
  );
}

// ─── Slice ─────────────────────────────────────────────────────

function SliceSubtab() {
  const { parts, selectedPart, setWaveEdit, setPartSlices } = useGroove();
  const p = parts[selectedPart];
  const w = p.wave;
  const slicePresets = [2, 4, 8, 16, 32, 64];
  // Use persisted sliceData if available; fall back to equal-spaced derived
  // from the `slices` count when no metadata has been saved yet.
  const slices: Slice[] = w.sliceData ?? equalSlice(w.slices);

  const applyEqualSlice = (n: number) => {
    setPartSlices(p.id, equalSlice(n));
  };

  const triggerSlice = async (i: number) => {
    await ensureAudio();
    const { triggerSampleRegion } = await import("@/lib/audio/engine");
    const region = sliceRegion(slices, i);
    if (!region) return;
    triggerSampleRegion(p.id, region.start, region.end, slices[i]?.velocity ?? 110);
  };

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2">SLICE EDITOR — {p.name}</div>
        <div className="hairline mb-2" />
        <div className="font-mono text-[9px] text-muted-foreground mb-2">EQUAL SLICE</div>
        <div className="grid grid-cols-6 gap-1">
          {slicePresets.map((n) => (
            <button key={n} onClick={() => applyEqualSlice(n)}
              className={cn("h-9 panel-inset rounded font-mono text-[10px]",
                slices.length === n && "neon-border text-primary")}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs">PLAY SLICE</div>
          <div className="font-mono text-[9px] text-muted-foreground">{slices.length} SLICES</div>
        </div>
        <div className="hairline mb-2" />
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(slices.length, 16)},minmax(0,1fr))` }}>
          {slices.map((s, i) => (
            <button key={s.id ?? i} onClick={() => triggerSlice(i)}
              className="h-9 panel-inset rounded font-mono text-[9px] text-neon-amber active:bg-neon-amber/20 truncate">
              {s.name ?? (i + 1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SoundTab() {
  const [sub, setSub] = useState<SubTab>("SOURCE");
  return (
    <div className="space-y-3">
      <PartPicker />
      <div className="grid grid-cols-9 gap-1">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={cn(
              "h-10 panel-inset rounded flex flex-col items-center justify-center gap-0.5 font-mono text-[8px] touch-none",
              sub === key && "neon-border text-primary"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {sub === "SOURCE" && <SourceSubtab />}
      {sub === "WAVE" && <WaveSubtab />}
      {sub === "SLICE" && <SliceSubtab />}
      {sub === "GRAIN" && <GrainSubtab />}
      {sub === "STRETCH" && <StretchSubtab />}
      {sub === "SYNTH" && <SynthSubtab />}
      {sub === "FILTER" && <FilterSubtab />}
      {sub === "MOD" && (
        <ModFxLink to="MOD" title="MODULATION MATRIX" desc="Route LFOs, ENVs, Step LFO, Velocity, Random, Ribbon and MIDI CC to filter, pitch, volume, sends and more — per part. Now also Grain Size/Density/Position/Spray, Stretch, Freeze Position/Mix and Stereo Width." />
      )}
      {sub === "FX" && (
        <>
          <FxSendsPanel />
          <ModFxLink to="FX" title="FX MATRIX" desc="6 FX buses A–F: Chorus/Flanger/RingMod, Delays, Reverbs, Pitch, Voice, Dynamics. Edit type, mix and DSP parameters." />
        </>
      )}
    </div>
  );
}