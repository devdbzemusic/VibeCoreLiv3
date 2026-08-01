// VibeCore UI — Voice Tab.
// Vocal production surface: record, pitch, formant, stretch, slice, AI.
// Follows the 8-parameter rule and 3-touch workflow.

import { useState, useCallback } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PartStrip } from "./PartStrip";
import {
  Mic, Square, Trash2, Sparkles, Wand2, Music2, Layers,
  ArrowUp, Play,
} from "lucide-react";
import { buildContext } from "@/lib/ai/context";
import {
  suggestVocalPitch, suggestVocalHarmony, suggestVocalLayer, suggestVocalPhrase,
} from "@/lib/ai/voiceAssistant";
import type { Note } from "@/lib/model";

type VocalTool = "PITCH" | "HARMONY" | "LAYER" | "PHRASE";

const TOOLS: { key: VocalTool; label: string; icon: typeof Mic }[] = [
  { key: "PITCH", label: "PITCH", icon: ArrowUp },
  { key: "HARMONY", label: "HARMONY", icon: Music2 },
  { key: "LAYER", label: "LAYER", icon: Layers },
  { key: "PHRASE", label: "PHRASE", icon: Wand2 },
];

export function VoiceTab() {
  const {
    parts, selectedPart, patterns, selectedPattern, selectedSceneIdx,
    setPartPitch, setPartVolume, setPartPan, setSend,
    setChannel, setWaveEdit, setNotes, addNote, removeNote,
    recording, toggleRec, transport,
  } = useGroove();

  const [tool, setTool] = useState<VocalTool>("PITCH");
  const [aiSeed, setAiSeed] = useState(42);

  const part = parts[selectedPart];
  const pattern = patterns[selectedPattern];
  const scene = pattern?.scenes[selectedSceneIdx];
  const notes: Note[] = (scene?.partNotes[part?.id ?? -1] as Note[]) ?? [];

  const applyAi = useCallback(() => {
    if (!part) return;
    const ctx = buildContext();
    const seed = aiSeed;
    if (tool === "PITCH") {
      const s = suggestVocalPitch(ctx, notes.map(n => ({ step: n.step, pitch: n.pitch, length: n.length, velocity: n.velocity })), { seed, partId: part.id });
      setNotes(part.id, s.payload.notes);
    } else if (tool === "HARMONY") {
      const s = suggestVocalHarmony(ctx, notes.map(n => ({ step: n.step, pitch: n.pitch, length: n.length, velocity: n.velocity })), { seed, partId: part.id });
      if (s.payload.harmony) setNotes(part.id, s.payload.harmony);
    } else if (tool === "LAYER") {
      const s = suggestVocalLayer(ctx, notes.map(n => ({ step: n.step, pitch: n.pitch, length: n.length, velocity: n.velocity })), { seed, partId: part.id });
      setNotes(part.id, s.payload.notes);
    } else if (tool === "PHRASE") {
      const s = suggestVocalPhrase(ctx, { seed, partId: part.id });
      setNotes(part.id, s.payload.notes);
    }
    setAiSeed(s => s + 1);
  }, [part, tool, aiSeed, notes, setNotes]);

  if (!part) return null;

  const pitch = part.pitch ?? 0;
  const vol = part.volume ?? 80;
  const pan = part.pan ?? 0;
  const filterFreq = part.channel?.lpCut ?? 50;
  const stretch = part.wave?.timeStretch ?? 50;
  const reverbSend = part.sends?.[0] ?? 0;
  const delaySend = part.sends?.[1] ?? 0;
  const drive = part.channel?.drive ?? 0;

  return (
    <div className="space-y-3">
      <PartStrip />

      {/* Record bar */}
      <div className="hw-bezel p-3 flex items-center gap-3">
        <button
          onClick={() => toggleRec()}
          className={cn(
            "h-14 w-14 rounded-full grid place-items-center shrink-0 touch-none active:scale-95 transition-transform",
            recording ? "bg-neon-crimson text-primary-foreground shadow-glow-primary animate-pulse-neon" : "panel-inset text-neon-crimson",
          )}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-display text-xs text-primary truncate">{part.name} · VOCAL</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {recording ? "RECORDING" : transport.playing ? "MONITORING" : "READY"} · {notes.length} NOTES
          </div>
        </div>
        <div className="font-mono text-[9px] text-muted-foreground text-right">
          <div>TAKE</div>
          <div className="font-display text-lg text-primary tabular-nums leading-none">{notes.length}</div>
        </div>
      </div>

      {/* 8-parameter panel — the only visible controls */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">VOCAL PARAMETERS</span>
          <span className="font-mono text-[9px] text-muted-foreground ml-auto">8 / 8</span>
        </div>
        <div className="hairline mb-3" />
        <div className="grid grid-cols-2 gap-2">
          <ParamSlider label="PITCH" value={pitch} min={-24} max={24} unit="st"
            onChange={(v) => setPartPitch(part.id, v)} />
          <ParamSlider label="VOLUME" value={vol} min={0} max={100} unit="%"
            onChange={(v) => setPartVolume(part.id, v)} />
          <ParamSlider label="PAN" value={pan} min={-50} max={50} unit=""
            onChange={(v) => setPartPan(part.id, v)} />
          <ParamSlider label="FORMANT" value={filterFreq} min={0} max={100} unit=""
            onChange={(v) => setChannel(part.id, { lpCut: v })} />
          <ParamSlider label="STRETCH" value={stretch} min={0} max={100} unit=""
            onChange={(v) => setWaveEdit(part.id, { timeStretch: v })} />
          <ParamSlider label="DRIVE" value={drive} min={0} max={100} unit=""
            onChange={(v) => setChannel(part.id, { drive: v })} />
          <ParamSlider label="REVERB" value={reverbSend} min={0} max={100} unit=""
            onChange={(v) => setSend(part.id, 0, v)} />
          <ParamSlider label="DELAY" value={delaySend} min={0} max={100} unit=""
            onChange={(v) => setSend(part.id, 1, v)} />
        </div>
      </div>

      {/* AI tools — context-aware, 4 actions */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">AI VOCAL ASSISTANT</span>
        </div>
        <div className="hairline mb-3" />
        <div className="grid grid-cols-4 gap-1.5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTool(t.key)}
                data-active={tool === t.key}
                className={cn(
                  "tab-pill h-14 rounded-md flex flex-col items-center justify-center gap-1 font-mono transition-all",
                  tool === t.key ? "text-primary" : "panel-inset text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px] tracking-wider">{t.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={applyAi}
          className="w-full mt-3 h-12 rounded-md bg-gradient-primary text-primary-foreground font-display text-sm tracking-wider flex items-center justify-center gap-2 touch-none active:scale-[0.98] transition-transform shadow-glow-primary"
        >
          <Sparkles className="h-4 w-4" />
          APPLY AI · {tool}
        </button>
      </div>

      {/* Take list — notes in current scene */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-xs text-primary">TAKES · {notes.length}</span>
          <button
            onClick={() => part && setNotes(part.id, [])}
            className="h-7 px-2 rounded panel-inset text-[10px] text-muted-foreground hover:text-neon-crimson font-mono"
          >CLEAR ALL</button>
        </div>
        <div className="hairline mb-2" />
        {notes.length === 0 ? (
          <div className="text-center font-mono text-[10px] text-muted-foreground py-4">
            No vocal takes — press record or use AI Phrase
          </div>
        ) : (
          <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
            {notes.map((n, i) => (
              <div key={n.id ?? i} className="flex items-center gap-2 px-2 py-1.5 rounded panel-inset">
                <Play className="h-3 w-3 text-primary shrink-0" />
                <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-12">
                  {String(n.step + 1).padStart(2, "0")}.{n.pitch}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  LEN {n.length}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  VEL {n.velocity}
                </span>
                <button
                  onClick={() => removeNote(part.id, n.id)}
                  className="ml-auto h-6 w-6 rounded grid place-items-center text-muted-foreground hover:text-neon-crimson shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ParamSlider({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="panel-inset px-2.5 py-2 rounded-md">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[9px] text-muted-foreground tracking-wider">{label}</span>
        <span className="font-display text-[11px] text-primary tabular-nums">
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5 touch-none"
      />
    </div>
  );
}