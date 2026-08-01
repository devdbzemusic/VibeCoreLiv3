// VibeCoreLiv3 — AI Module UI (Performance & Advanced redesign).
//
// AI is entirely context-based — no standalone chat.
// This module: AI Activity Log + Global Style Configurator + CO-ASSISTANT + PART BUILDER.

import { useState } from "react";
import { useGroove, type AiStyle, type AiHistoryEntry } from "@/lib/store";
import { buildScene, type ScenebuildStyle } from "@/lib/audio/aiSceneBuild";
import type { PartCategory, Step } from "@/lib/model";
import { cn } from "@/lib/utils";
import { Sparkles, Bot, Trash2, Clock, Drum } from "lucide-react";
import { AiCoAssistant } from "@/components/groovebox/AiCoAssistant";

const AI_STYLES: { key: AiStyle; label: string; desc: string }[] = [
  { key: "CLASSIC",   label: "CLASSIC",   desc: "Balanced, musical" },
  { key: "MINIMAL",   label: "MINIMAL",   desc: "Sparse, focused" },
  { key: "COMPLEX",   label: "COMPLEX",   desc: "Dense, layered" },
  { key: "ORGANIC",   label: "ORGANIC",   desc: "Natural, breathing" },
  { key: "DIGITAL",   label: "DIGITAL",   desc: "Quantized, precise" },
  { key: "CINEMATIC", label: "CINEMATIC", desc: "Wide, atmospheric" },
  { key: "HYPNOTIC",  label: "HYPNOTIC",  desc: "Repetitive, trance" },
  { key: "GLITCH",    label: "GLITCH",    desc: "Broken, textured" },
];

const MODULE_COLORS: Record<string, string> = {
  "GROOVE":     "text-neon-lime",
  "3D SYNTH":   "text-neon-cyan",
  "3D BASS":    "text-neon-magenta",
  "VOICE":      "text-neon-amber",
  "REMIX":      "text-neon-cyan",
  "FX MIX LAB": "text-neon-lime",
  "ARP":        "text-neon-amber",
  "AI":         "text-primary",
};

function relTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

type AiView = "log" | "co" | "part";

export function AiSceneTab() {
  const { aiHistory, aiStyle, setAiStyle, clearAiHistory } = useGroove();
  const [view, setView] = useState<AiView>("log");

  return (
    <div className="p-3 space-y-3">
      {/* ── Global AI Style selector ─── */}
      <div className="hw-bezel p-3">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-sm text-primary tracking-wider">AI STYLE</span>
          <span className="ml-auto font-mono text-[9px] text-muted-foreground">
            biases groove · melody · density · swing
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {AI_STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => setAiStyle(s.key)}
              data-active={aiStyle === s.key}
              className={cn(
                "rounded-lg p-2 flex flex-col items-center gap-0.5 touch-none active:scale-95 transition-transform",
                aiStyle === s.key ? "bg-primary/10 neon-border" : "panel-inset",
              )}
            >
              <span className={cn(
                "font-display text-[10px] tracking-wider",
                aiStyle === s.key ? "text-primary" : "text-muted-foreground",
              )}>{s.label}</span>
              <span className="font-mono text-[8px] text-muted-foreground/70 text-center leading-tight">
                {s.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── View selector: LOG | CO-ASSISTANT | PART BUILDER ─── */}
      <div className="hw-bezel p-1.5 flex gap-1">
        <button onClick={() => setView("log")} data-active={view === "log"}
          className={cn("tab-pill flex-1 flex items-center justify-center gap-1.5 py-2 font-display text-[11px] tracking-wider",
            view === "log" ? "text-primary" : "text-muted-foreground")}>
          <Clock className="h-3.5 w-3.5" /> ACTIVITY
        </button>
        <button onClick={() => setView("co")} data-active={view === "co"}
          className={cn("tab-pill flex-1 flex items-center justify-center gap-1.5 py-2 font-display text-[11px] tracking-wider",
            view === "co" ? "text-primary" : "text-muted-foreground")}>
          <Bot className="h-3.5 w-3.5" /> CO-ASSIST
        </button>
        <button onClick={() => setView("part")} data-active={view === "part"}
          className={cn("tab-pill flex-1 flex items-center justify-center gap-1.5 py-2 font-display text-[11px] tracking-wider",
            view === "part" ? "text-primary" : "text-muted-foreground")}>
          <Drum className="h-3.5 w-3.5" /> PART BUILD
        </button>
      </div>

      {/* ── Content ─── */}
      {view === "log" && <ActivityLog aiHistory={aiHistory} clearAiHistory={clearAiHistory} />}
      {view === "co"  && <AiCoAssistant />}
      {view === "part" && <PartBuilder />}
    </div>
  );
}

// ── Activity Log ─────────────────────────────────────────────────────────────
function ActivityLog({
  aiHistory,
  clearAiHistory,
}: {
  aiHistory: AiHistoryEntry[];
  clearAiHistory: () => void;
}) {
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-3.5 w-3.5 text-primary" />
        <span className="font-display text-xs text-primary">AI ACTIVITY LOG</span>
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{aiHistory.length} / 10</span>
        {aiHistory.length > 0 && (
          <button
            onClick={clearAiHistory}
            className="h-6 px-2 rounded panel-inset font-mono text-[9px] text-muted-foreground hover:text-neon-crimson"
          >CLR</button>
        )}
      </div>
      <div className="hairline mb-2" />
      {aiHistory.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto" />
          <div className="font-mono text-[10px] text-muted-foreground">
            No AI actions yet — use the AI buttons in each module
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {aiHistory.map((entry, i) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg panel-inset",
                i === 0 && "neon-border",
              )}
            >
              <Sparkles className="h-3 w-3 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono text-[9px] tracking-wider shrink-0",
                    MODULE_COLORS[entry.module] ?? "text-muted-foreground",
                  )}>{entry.module}</span>
                  <span className="font-display text-[10px] text-foreground truncate">{entry.action}</span>
                </div>
                {entry.description && (
                  <div className="font-mono text-[8px] text-muted-foreground truncate mt-0.5">
                    {entry.description}
                  </div>
                )}
              </div>
              <span className="font-mono text-[8px] text-muted-foreground shrink-0 tabular-nums">
                {relTime(entry.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Part Builder ─────────────────────────────────────────────────────────────
const STYLES: ScenebuildStyle[] = ["fourFloor", "boomBap", "trap", "breaks", "techno", "ambient", "minimal"];
const LENGTHS = [4, 8, 16] as const;

function PartBuilder() {
  const { parts, patterns, selectedPattern, selectedSceneIdx, setPatternSteps, addAiHistoryEntry } = useGroove();
  const pattern = patterns[selectedPattern];
  const [partId, setPartId] = useState<number>(parts[0]?.id ?? 0);
  const [style, setStyle] = useState<ScenebuildStyle>("fourFloor");
  const [density, setDensity] = useState(0.5);
  const [swing, setSwing] = useState(0.4);
  const [seed, setSeed] = useState(pattern?.seed ?? 0xC0FFEE);
  const [length, setLength] = useState<number>(16);
  const [lastPreview, setLastPreview] = useState<boolean[]>([]);

  const part = parts.find((p) => p.id === partId) ?? parts[0];
  const sceneLen = pattern?.scenes[selectedSceneIdx]?.length ?? 16;

  const generate = () => {
    if (!part || !pattern) return;
    const steps: Step[] = buildScene({
      category: part.category as PartCategory,
      style, density, swingProb: swing, seed, length,
    });
    setLastPreview(steps.map((s) => s.on));
    setPatternSteps(part.id, steps);
    addAiHistoryEntry({
      action: "Built pattern",
      module: "AI",
      description: `${style} · ${length} steps · density ${density.toFixed(2)}`,
    });
  };

  const reroll = () => setSeed((s) => (s + 0x9e3779b1) >>> 0);

  return (
    <div className="space-y-3">
      <div className="hw-bezel p-3 flex items-center justify-between">
        <div>
          <div className="font-display text-sm text-primary tracking-widest">AI SCENEBUILD</div>
          <div className="font-mono text-[10px] text-muted-foreground">Deterministic · scene len {sceneLen}</div>
        </div>
        <button onClick={generate}
          className="hw-screen px-3 py-2 flex items-center gap-2 font-display text-[11px] text-primary">
          <Sparkles className="h-3.5 w-3.5" /> GENERATE
        </button>
      </div>

      <div className="hw-bezel p-3 space-y-3">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-1 tracking-widest">PART</div>
          <div className="flex flex-wrap gap-1">
            {parts.map((p) => (
              <button key={p.id} onClick={() => setPartId(p.id)} data-active={partId === p.id}
                className="tab-pill font-mono text-[10px] px-2 py-1 border border-border text-muted-foreground">
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-1 tracking-widest">LENGTH</div>
          <div className="flex flex-wrap gap-1">
            {LENGTHS.map((L) => (
              <button key={L} onClick={() => setLength(L)} data-active={length === L}
                className="tab-pill font-mono text-[10px] px-2 py-1 border border-border text-muted-foreground">
                {L}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-1 tracking-widest">STYLE</div>
          <div className="flex flex-wrap gap-1">
            {STYLES.map((s) => (
              <button key={s} onClick={() => setStyle(s)} data-active={style === s}
                className="tab-pill font-mono text-[10px] px-2 py-1 border border-border text-muted-foreground">
                {s}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="flex justify-between font-mono text-[10px]">
            <span className="text-muted-foreground tracking-widest">DENSITY</span>
            <span className="text-primary tabular-nums">{density.toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
            className="accent-primary h-1.5 w-full" />
        </label>

        <label className="block">
          <div className="flex justify-between font-mono text-[10px]">
            <span className="text-muted-foreground tracking-widest">SWING</span>
            <span className="text-primary tabular-nums">{swing.toFixed(2)}</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={swing}
            onChange={(e) => setSwing(Number(e.target.value))}
            className="accent-primary h-1.5 w-full" />
        </label>

        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] text-muted-foreground">
            SEED <span className="text-primary tabular-nums">{seed.toString(16).padStart(8, "0").toUpperCase()}</span>
          </div>
          <button onClick={reroll} className="hw-screen px-2 py-1 font-mono text-[10px] text-primary">REROLL</button>
        </div>
      </div>

      {lastPreview.length > 0 && (
        <div className="hw-bezel p-3">
          <div className="font-mono text-[10px] text-muted-foreground mb-2 tracking-widest">
            PREVIEW · {lastPreview.length} steps
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(lastPreview.length, 16)}, minmax(0, 1fr))` }}>
            {lastPreview.map((on, i) => (
              <div key={i} className={cn("h-6 rounded-sm border", on ? "bg-primary border-primary" : "bg-secondary border-border")} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
