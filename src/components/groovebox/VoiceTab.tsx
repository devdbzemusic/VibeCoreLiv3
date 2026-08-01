// VibeCoreLiv3 — Voice Module UI (Performance & Advanced redesign).
//
// 3-touch rule: (1) tap Record → (2) select edit action → (3) apply AI
// 8-parameter rule: PITCH · VOLUME · PAN · FORMANT · STRETCH · DRIVE · REVERB · DELAY
// One-touch record: large center-screen record button, no pre-config.

import { useState, useCallback, useRef } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Mic, Square, Trash2, Sparkles, Wand2, Music2, Layers, ArrowUp, Play,
} from "lucide-react";
import { buildContext } from "@/lib/ai/context";
import {
  suggestVocalPitch, suggestVocalHarmony, suggestVocalLayer, suggestVocalPhrase,
} from "@/lib/ai/voiceAssistant";
import type { Note } from "@/lib/model";
import { AiContextButton } from "./AiContextButton";

type VocalTool = "PITCH" | "HARMONY" | "LAYER" | "PHRASE";

const TOOLS: { key: VocalTool; label: string; icon: typeof Mic }[] = [
  { key: "PITCH",   label: "PITCH",   icon: ArrowUp },
  { key: "HARMONY", label: "HARMONY", icon: Music2 },
  { key: "LAYER",   label: "LAYER",   icon: Layers },
  { key: "PHRASE",  label: "PHRASE",  icon: Wand2 },
];

// Animated waveform placeholder (bars that shimmer during recording).
function WaveformDisplay({ recording, noteCount }: { recording: boolean; noteCount: number }) {
  const bars = 48;
  return (
    <div
      className={cn(
        "relative w-full rounded-lg overflow-hidden flex items-end gap-[1px] px-2 pb-2",
        "bg-background/60 border border-border",
      )}
      style={{ minHeight: 120, height: "24vw", maxHeight: 180 }}
    >
      {/* Background grid lines */}
      <div className="absolute inset-0 flex flex-col justify-around pointer-events-none">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-t border-border/20" />
        ))}
      </div>
      {/* Center line */}
      <div className="absolute inset-x-2 top-1/2 border-t border-primary/20" />

      {/* Waveform bars */}
      {Array.from({ length: bars }, (_, i) => {
        const seed = Math.abs(Math.sin(i * 0.7 + 1.3));
        const h = noteCount > 0
          ? 20 + 60 * Math.abs(Math.sin(i * 0.31 + noteCount * 0.1))
          : 5 + 8 * seed;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-t-sm transition-all",
              recording
                ? "bg-neon-crimson/60"
                : noteCount > 0
                  ? "bg-primary/40"
                  : "bg-muted-foreground/20",
            )}
            style={{
              height: `${h}%`,
              animationName: recording ? "pulse" : "none",
              animationDuration: `${0.8 + (i % 7) * 0.15}s`,
              animationDelay: `${(i * 0.03).toFixed(2)}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDirection: "alternate",
            }}
          />
        );
      })}

      {/* Overlay label */}
      <div className="absolute top-2 left-3 font-mono text-[9px] text-muted-foreground">
        {recording ? "● REC" : noteCount > 0 ? `${noteCount} NOTES` : "NO TAKE"}
      </div>
    </div>
  );
}

export function VoiceTab() {
  const {
    parts, selectedPart, patterns, selectedPattern, selectedSceneIdx,
    setPartPitch, setPartVolume, setPartPan, setSend,
    setChannel, setWaveEdit, setNotes, removeNote,
    recording, toggleRec, transport, addAiHistoryEntry,
  } = useGroove();

  const [tool, setTool] = useState<VocalTool>("PITCH");
  const [aiSeed, setAiSeed] = useState(42);
  const [activeTake, setActiveTake] = useState<string | null>(null);

  const part = parts[selectedPart];
  const pattern = patterns[selectedPattern];
  const scene = pattern?.scenes[selectedSceneIdx];
  const notes: Note[] = (scene?.partNotes[part?.id ?? -1] as Note[]) ?? [];

  const applyAi = useCallback(async () => {
    if (!part) return;
    const ctx = buildContext();
    const seed = aiSeed;
    const noteIn = notes.map((n) => ({ step: n.step, pitch: n.pitch, length: n.length, velocity: n.velocity }));
    if (tool === "PITCH") {
      const s = suggestVocalPitch(ctx, noteIn, { seed, partId: part.id });
      setNotes(part.id, s.payload.notes);
    } else if (tool === "HARMONY") {
      const s = suggestVocalHarmony(ctx, noteIn, { seed, partId: part.id });
      if (s.payload.harmony) setNotes(part.id, s.payload.harmony);
    } else if (tool === "LAYER") {
      const s = suggestVocalLayer(ctx, noteIn, { seed, partId: part.id });
      setNotes(part.id, s.payload.notes);
    } else if (tool === "PHRASE") {
      const s = suggestVocalPhrase(ctx, { seed, partId: part.id });
      setNotes(part.id, s.payload.notes);
    }
    setAiSeed((s) => s + 1);
    addAiHistoryEntry({ action: `Vocal ${tool.toLowerCase()}`, module: "VOICE" });
  }, [part, tool, aiSeed, notes, setNotes, addAiHistoryEntry]);

  if (!part) return null;

  const pitch = part.pitch ?? 0;
  const vol = part.volume ?? 80;
  const pan = part.pan ?? 0;
  const formant = part.channel?.lpCut ?? 50;
  const stretch = part.wave?.timeStretch ?? 50;
  const reverbSend = part.sends?.[0] ?? 0;
  const delaySend = part.sends?.[1] ?? 0;
  const drive = part.channel?.drive ?? 0;

  return (
    <div className="space-y-3">
      {/* ── Large one-touch record button ─── */}
      <div className="hw-bezel p-4 flex flex-col items-center gap-3">
        <button
          onClick={() => toggleRec()}
          className={cn(
            "h-20 w-20 rounded-full grid place-items-center shrink-0 touch-none active:scale-95 transition-transform",
            recording
              ? "bg-neon-crimson text-white shadow-[0_0_24px_rgba(220,38,38,0.6)] animate-pulse"
              : "panel-inset text-neon-crimson border-2 border-neon-crimson/40",
          )}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording
            ? <Square className="h-7 w-7 fill-current" />
            : <Mic className="h-8 w-8" />
          }
        </button>
        <div className="text-center">
          <div className="font-display text-xs text-primary">{part.name} · VOCAL</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {recording ? "● RECORDING" : transport.playing ? "MONITORING" : "READY TO RECORD"}
          </div>
        </div>
      </div>

      {/* ── Waveform take viewer ─── */}
      <div className="panel px-3 pt-3 pb-2">
        <WaveformDisplay recording={recording} noteCount={notes.length} />

        {/* ── Horizontal editing toolbar (4 actions) ─── */}
        <div className="flex gap-1.5 mt-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTool(t.key)}
                data-active={tool === t.key}
                className={cn(
                  "flex-1 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 transition-transform",
                  tool === t.key
                    ? "bg-primary/10 neon-border text-primary"
                    : "panel-inset text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-mono text-[8px] tracking-wider">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AI Improve Vocal + Apply ─── */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">AI VOCAL ASSISTANT</span>
          <div className="ml-auto">
            <AiContextButton label="Improve Vocal" onAction={applyAi} />
          </div>
        </div>
        <button
          onClick={applyAi}
          className="w-full h-11 rounded-lg bg-gradient-primary text-primary-foreground font-display text-sm tracking-wider flex items-center justify-center gap-2 touch-none active:scale-[0.98] transition-transform shadow-glow-primary"
        >
          <Sparkles className="h-4 w-4" />
          APPLY · {tool}
        </button>
      </div>

      {/* ── 8-parameter panel ─── */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-display text-xs text-primary">VOCAL PARAMETERS</span>
          <span className="font-mono text-[9px] text-muted-foreground ml-auto">8 / 8</span>
        </div>
        <div className="hairline mb-3" />
        <div className="grid grid-cols-2 gap-2">
          <ParamSlider label="PITCH"   value={pitch}       min={-24} max={24}   unit="st" onChange={(v) => setPartPitch(part.id, v)} />
          <ParamSlider label="VOLUME"  value={vol}         min={0}   max={100}  unit="%" onChange={(v) => setPartVolume(part.id, v)} />
          <ParamSlider label="PAN"     value={pan}         min={-50} max={50}   unit=""  onChange={(v) => setPartPan(part.id, v)} />
          <ParamSlider label="FORMANT" value={formant}     min={0}   max={100}  unit=""  onChange={(v) => setChannel(part.id, { lpCut: v })} />
          <ParamSlider label="STRETCH" value={stretch}     min={0}   max={100}  unit=""  onChange={(v) => setWaveEdit(part.id, { timeStretch: v })} />
          <ParamSlider label="DRIVE"   value={drive}       min={0}   max={100}  unit=""  onChange={(v) => setChannel(part.id, { drive: v })} />
          <ParamSlider label="REVERB"  value={reverbSend}  min={0}   max={100}  unit=""  onChange={(v) => setSend(part.id, 0, v)} />
          <ParamSlider label="DELAY"   value={delaySend}   min={0}   max={100}  unit=""  onChange={(v) => setSend(part.id, 1, v)} />
        </div>
      </div>

      {/* ── Takes list ─── */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-xs text-primary">TAKES · {notes.length}</span>
          <button
            onClick={() => setNotes(part.id, [])}
            className="h-7 px-2 rounded panel-inset text-[10px] text-muted-foreground hover:text-neon-crimson font-mono"
          >CLEAR ALL</button>
        </div>
        <div className="hairline mb-2" />
        {notes.length === 0 ? (
          <div className="text-center font-mono text-[10px] text-muted-foreground py-4">
            No vocal takes — press record or use AI PHRASE
          </div>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
            {notes.map((n, i) => {
              const isActive = activeTake === n.id;
              return (
                <div
                  key={n.id ?? i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveTake(isActive ? null : n.id)}
                  onKeyDown={(e) => e.key === "Enter" && setActiveTake(isActive ? null : n.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer",
                    "touch-none active:bg-primary/5 transition-colors select-none",
                    isActive ? "neon-border bg-primary/5" : "panel-inset",
                  )}
                  aria-pressed={isActive}
                  aria-label={`Take ${i + 1}: ${NOTE_NAME(n.pitch)} step ${n.step + 1}`}
                >
                  <Play className={cn("h-3 w-3 shrink-0", isActive ? "text-primary fill-current" : "text-muted-foreground")} />
                  <span className={cn("font-mono text-[10px] tabular-nums shrink-0", isActive ? "text-primary" : "text-muted-foreground")}>
                    {String(n.step + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {NOTE_NAME(n.pitch)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    LEN {n.length} VEL {n.velocity}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeNote(part.id, n.id); if (isActive) setActiveTake(null); }}
                    className="ml-auto h-7 w-7 rounded grid place-items-center text-muted-foreground hover:text-neon-crimson shrink-0 active:scale-90"
                    aria-label="Delete take"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const NOTE_NAMES_LIST = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function NOTE_NAME(midi: number): string {
  return `${NOTE_NAMES_LIST[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function ParamSlider({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="panel-inset px-2.5 py-2 rounded-md">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[9px] text-muted-foreground tracking-wider">{label}</span>
        <span className="font-display text-[11px] text-primary tabular-nums">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5 touch-none"
      />
    </div>
  );
}
