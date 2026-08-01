// VibeCoreLiv3 Sprint 5 — Track Channel Strip.
// Shown directly below the step grid; controls the currently-selected part.
// Category-aware: drums get sample-select+tone/decay; bass/synth get FM+envelope;
// user samples get pitch/start/end/gain. FX sends + musical delay div live here too.
// Backward-compatible: only reads/writes existing store actions; no model change required.

import { useGroove } from "@/lib/store";
import { SAMPLE_LIBRARY, type PartCategory } from "@/lib/model";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Volume2, Volume1, Headphones, VolumeX } from "lucide-react";

function Knob({
  label, value, min, max, onChange, suffix, step = 1, disabled,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; suffix?: string; step?: number; disabled?: boolean;
}) {
  return (
    <div className={cn("panel-inset px-2 py-1.5 flex flex-col gap-1", disabled && "opacity-40")}>
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground uppercase">
        <span>{label}</span>
        <span className="text-primary font-display text-[11px]">{value}{suffix ?? ""}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary touch-none"
      />
    </div>
  );
}

function SampleSelect({ partId, category, current }: { partId: number; category: PartCategory; current: string | null }) {
  const setPartSampleName = useGroove((s) => s.setPartSampleName);
  const list = SAMPLE_LIBRARY[category];
  const idx = Math.max(0, list.indexOf(current ?? ""));
  const go = (dir: -1 | 1) => {
    const next = (idx + dir + list.length) % list.length;
    setPartSampleName(partId, list[next]);
  };
  const display = current ?? `${list[0]} (preview)`;
  return (
    <div className="panel-inset px-2 py-1.5 col-span-2">
      <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground uppercase mb-1">
        <span>Sample Select</span>
        <span className="text-primary font-display text-[10px]">{idx + 1}/{list.length}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => go(-1)} className="h-7 w-7 grid place-items-center rounded panel-inset">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 h-7 panel-inset rounded grid place-items-center font-display text-[11px] text-primary truncate px-1">
          {display}
        </div>
        <button onClick={() => go(1)} className="h-7 w-7 grid place-items-center rounded panel-inset">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ChannelStrip() {
  const {
    parts, selectedPart, fx,
    setPartVolume, setPartPan, setPartPitch, toggleMute, toggleSolo,
    setChannel, setSynthParam, setSend,
  } = useGroove();
  const part = parts[selectedPart];
  if (!part) return null;
  const cat = part.category;
  const isDrum = ["kick", "snare", "perc", "hat"].includes(cat);
  const isBassSynth = cat === "bass" || cat === "synth";
  const isUserSample = cat === "sample";

  return (
    <div className="panel p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full glow-dot"
            style={{ color: `hsl(var(--${part.color}))`, background: `hsl(var(--${part.color}))` }}
          />
          <span className="font-display text-xs text-primary">CHANNEL · {part.name}</span>
          <span className="font-mono text-[9px] text-muted-foreground uppercase">{cat}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleMute(part.id)}
            className={cn("h-7 px-2 rounded panel-inset font-mono text-[10px] flex items-center gap-1", part.mute && "neon-border text-neon-crimson")}
          >
            {part.mute ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />} M
          </button>
          <button
            onClick={() => toggleSolo(part.id)}
            className={cn("h-7 px-2 rounded panel-inset font-mono text-[10px] flex items-center gap-1", part.solo && "neon-border text-neon-amber")}
          >
            <Headphones className="h-3 w-3" /> S
          </button>
        </div>
      </div>
      <div className="hairline mb-2" />

      {/* Common: Volume / Pan */}
      <div className="grid grid-cols-4 gap-1.5">
        <Knob label="Volume" value={part.volume} min={0} max={100} onChange={(v) => setPartVolume(part.id, v)} suffix="%" />
        <Knob label="Pan" value={part.pan} min={-50} max={50} onChange={(v) => setPartPan(part.id, v)} />
        <Knob label="Tune" value={part.pitch} min={-24} max={24} onChange={(v) => setPartPitch(part.id, v)} suffix="st" />
        <Knob label="Drive" value={part.channel.drive} min={0} max={100} onChange={(v) => setChannel(part.id, { drive: v })} />
      </div>

      {isDrum && (
        <>
          <div className="hairline my-2" />
          <div className="grid grid-cols-4 gap-1.5">
            <SampleSelect partId={part.id} category={cat} current={part.sampleName} />
            <Knob label="Tone" value={part.synth.hMetal} min={0} max={100} onChange={(v) => setSynthParam(part.id, "hMetal", v)} />
            <Knob label="Decay" value={part.synth.kDecay} min={0} max={100} onChange={(v) => setSynthParam(part.id, "kDecay", v)} />
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            <Knob label="Lowpass" value={part.channel.lpCut} min={0} max={100} onChange={(v) => setChannel(part.id, { lpCut: v })} />
            <Knob label="Highpass" value={part.channel.hpCut} min={0} max={100} onChange={(v) => setChannel(part.id, { hpCut: v })} />
            <Knob label="Resonance" value={Math.max(part.channel.lpRes, part.channel.hpRes)} min={0} max={100} onChange={(v) => setChannel(part.id, { lpRes: v, hpRes: v })} />
          </div>
        </>
      )}

      {isBassSynth && (
        <>
          <div className="hairline my-2" />
          <div className="grid grid-cols-4 gap-1.5">
            <Knob label="FM Amount" value={part.synth.fmAmount} min={0} max={100} onChange={(v) => setSynthParam(part.id, "fmAmount", v)} />
            <Knob label="Ratio" value={part.synth.fmRatio} min={0} max={100} onChange={(v) => setSynthParam(part.id, "fmRatio", v)} />
            <Knob label="Attack" value={part.synth.fAttack} min={0} max={100} onChange={(v) => setSynthParam(part.id, "fAttack", v)} />
            <Knob label="Release" value={part.synth.fRelease} min={0} max={100} onChange={(v) => setSynthParam(part.id, "fRelease", v)} />
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-1.5">
            <Knob label="Filter" value={part.channel.lpCut} min={0} max={100} onChange={(v) => setChannel(part.id, { lpCut: v })} />
            <Knob label="Resonance" value={part.channel.lpRes} min={0} max={100} onChange={(v) => setChannel(part.id, { lpRes: v })} />
            {cat === "synth" && <Knob label="Morph" value={part.synth.morph} min={0} max={100} onChange={(v) => setSynthParam(part.id, "morph", v)} />}
            {cat === "bass" && <Knob label="Sub" value={part.synth.bSub} min={0} max={100} onChange={(v) => setSynthParam(part.id, "bSub", v)} />}
            <Knob label="Decay" value={cat === "bass" ? part.synth.bDecay : part.synth.fDecay} min={0} max={100}
              onChange={(v) => setSynthParam(part.id, cat === "bass" ? "bDecay" : "fDecay", v)} />
          </div>
        </>
      )}

      {isUserSample && (
        <>
          <div className="hairline my-2" />
          <div className="grid grid-cols-4 gap-1.5">
            <SampleSelect partId={part.id} category={cat} current={part.sampleName} />
            <Knob label="Pitch" value={part.pitch} min={-24} max={24} onChange={(v) => setPartPitch(part.id, v)} suffix="st" />
            <Knob label="Gain" value={part.channel.outGain} min={0} max={200} onChange={(v) => setChannel(part.id, { outGain: v })} suffix="%" />
          </div>
        </>
      )}

      {/* FX Sends — musical naming */}
      <div className="hairline my-2" />
      <div className="font-mono text-[9px] text-muted-foreground mb-1 flex items-center gap-2">
        <Volume1 className="h-3 w-3" /> FX SENDS
      </div>

      <div className="grid grid-cols-6 gap-1">
        {part.sends.map((amt, i) => {
          const slot = fx[i];
          const label = slot?.type ?? `SLOT ${String.fromCharCode(65 + i)}`;
          return (
            <div key={i} className="panel-inset px-1.5 py-1">
              <div className="font-mono text-[8px] text-muted-foreground truncate">{label}</div>
              <input
                type="range" min={0} max={100} value={amt}
                onChange={(e) => setSend(part.id, i, Number(e.target.value))}
                className="w-full accent-primary mt-0.5 touch-none"
              />
              <div className="text-right font-display text-[10px] text-primary">{amt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
