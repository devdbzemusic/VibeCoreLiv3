// VibeCoreLiv3 — Remix Module UI (Performance & Advanced redesign).
//
// 3-touch rule: (1) tap pattern tile → (2) set repeat count → (3) set transition
// Queue-based arrangement — no classic timeline.
// Pattern tiles: tap to queue, long-press → Piano Roll.

import { useState, useCallback, useRef } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Sparkles, Wand2, ArrowRight, Trash2, Plus, Repeat2,
  Eye, EyeOff, Zap, Music2, Upload, Gauge,
} from "lucide-react";
import { buildContext } from "@/lib/ai/context";
import { suggestRemixIdea } from "@/lib/ai/remixAssistant";
import { analyzeRemixAudioInput, type RemixAudioInputAnalysis } from "@/lib/ai/remixAudioInput";
import { suggestSongStructure } from "@/lib/ai/arrangementAssistant";
import { ensureAudio } from "@/lib/audio/engine";
import { bufferToPCM } from "@/lib/audio/sampleForge";
import type { ChainStep } from "@/lib/model";
import { AiContextButton } from "./AiContextButton";

type TransitionType = "CUT" | "FILL" | "FADE";
const TRANSITION_COLORS: Record<TransitionType, string> = {
  CUT: "text-neon-crimson",
  FILL: "text-neon-amber",
  FADE: "text-neon-cyan",
};

const GENRES = ["techno", "house", "dnb", "ambient", "pop"] as const;

export function RemixTab() {
  const {
    patterns, selectedPattern, transport, bpm, setBpm,
    setChainSteps, addToChain, removeFromChain,
    setChainStepRepeat, toggleChainStepSkip, clearChain,
    moveChainStep, setChainMode, queuePattern,
    setTab, selectPattern,
    setChainStepTransition,
    addAiHistoryEntry,
  } = useGroove();

  const [genre, setGenre] = useState<string>("techno");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiChainSteps, setAiChainSteps] = useState<ChainStep[] | null>(null);
  const [audioAnalysis, setAudioAnalysis] = useState<RemixAudioInputAnalysis | null>(null);
  const [audioInputName, setAudioInputName] = useState<string | null>(null);
  const [audioInputError, setAudioInputError] = useState<string | null>(null);
  const [audioInputBusy, setAudioInputBusy] = useState(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const chain = transport.chainSteps ?? [];
  const chainMode = transport.chainMode;
  // Transition types are persisted in the store (transport.chainStepTransitions)
  const transitions = transport.chainStepTransitions ?? [];

  const cycleTransition = (i: number) => {
    const cur = (transitions[i] ?? "CUT") as TransitionType;
    const opts: TransitionType[] = ["CUT", "FILL", "FADE"];
    setChainStepTransition(i, opts[(opts.indexOf(cur) + 1) % opts.length]);
  };

  // Long-press to open pattern in Piano Roll (≥500ms hold, cancelled on move)
  const lpTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lpMoved = useRef<Record<number, boolean>>({});

  const applyAiStructure = useCallback(() => {
    const ctx = buildContext();
    const s = suggestSongStructure(ctx, { seed: Date.now() >>> 0, genre });
    setAiResult(s.description);
    setAiChainSteps(s.payload.chainSteps);
    addAiHistoryEntry({ action: "Generated song structure", module: "REMIX" });
  }, [genre, addAiHistoryEntry]);

  const applyAiRemix = useCallback(() => {
    const ctx = buildContext();
    const s = suggestRemixIdea(ctx, { seed: Date.now() >>> 0, genre });
    setAiResult(s.description);
    setAiChainSteps(s.payload.chainSteps ?? null);
    addAiHistoryEntry({ action: "Generated remix idea", module: "REMIX" });
  }, [genre, addAiHistoryEntry]);

  const applyAiChain = () => {
    if (aiChainSteps) setChainSteps(aiChainSteps);
    setAiChainSteps(null);
    setAiResult(null);
  };

  const analyzeAudioFile = useCallback(async (file: File) => {
    setAudioInputBusy(true);
    setAudioInputError(null);
    try {
      const ctx = await ensureAudio();
      const data = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(data.slice(0));
      const analysis = analyzeRemixAudioInput(bufferToPCM(decoded), { targetBpm: bpm });
      setAudioInputName(file.name);
      setAudioAnalysis(analysis);
      addAiHistoryEntry({ action: "Analyzed remix audio input", module: "REMIX" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Audio input could not be analyzed.";
      setAudioInputError(msg);
      setAudioAnalysis(null);
    } finally {
      setAudioInputBusy(false);
    }
  }, [bpm, addAiHistoryEntry]);

  return (
    <div className="space-y-3">
      {/* ── Audio input analysis ─── */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">AUDIO INPUT</span>
          <span className="font-mono text-[9px] text-muted-foreground ml-1">file remix analysis</span>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void analyzeAudioFile(file);
              e.currentTarget.value = "";
            }}
          />
          <button
            onClick={() => audioInputRef.current?.click()}
            disabled={audioInputBusy}
            className="ml-auto h-7 px-2 rounded panel-inset text-[9px] text-primary font-mono disabled:opacity-40"
          >
            {audioInputBusy ? "SCAN" : "LOAD"}
          </button>
        </div>
        <div className="hairline mb-2" />
        {audioInputError ? (
          <div className="font-mono text-[10px] text-neon-crimson py-2">{audioInputError}</div>
        ) : audioAnalysis ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Gauge className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] text-foreground truncate">{audioInputName}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{audioAnalysis.summary}</div>
              </div>
              <span className="font-mono text-[9px] text-primary tabular-nums">{Math.round(audioAnalysis.confidence * 100)}%</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Metric label="BPM" value={audioAnalysis.bpm > 0 ? String(audioAnalysis.bpm) : "?"} />
              <Metric label="KEY" value={audioAnalysis.keyLabel} />
              <Metric label="NRG" value={audioAnalysis.energy.toUpperCase()} />
              <Metric label="CLIP" value={audioAnalysis.clipping ? "YES" : "NO"} warn={audioAnalysis.clipping} />
            </div>
            <button
              onClick={() => audioAnalysis.bpm > 0 && setBpm(audioAnalysis.bpm)}
              disabled={audioAnalysis.bpm <= 0}
              className="w-full h-9 rounded-lg panel-inset font-display text-[10px] text-primary disabled:opacity-40"
            >
              SYNC PROJECT BPM
            </button>
          </div>
        ) : (
          <div className="font-mono text-[10px] text-muted-foreground py-4 text-center">
            Load an audio file to detect tempo, key, energy and clipping.
          </div>
        )}
      </div>

      {/* ── Pattern queue ─── */}
      <div className="hw-bezel p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-display text-xs text-primary">PATTERN CHAIN</span>
          <span className="font-mono text-[10px] text-muted-foreground ml-1">{chain.length} STEPS</span>
          <div className="ml-auto flex gap-1.5">
            {(["IMMEDIATE", "BOUNDARY"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChainMode(m)}
                data-active={chainMode === m}
                className={cn(
                  "tab-pill h-7 px-2 rounded font-mono text-[9px]",
                  chainMode === m ? "text-primary" : "panel-inset text-muted-foreground",
                )}
              >{m === "IMMEDIATE" ? "IMM" : "BAR"}</button>
            ))}
            <button
              onClick={() => clearChain()}
              disabled={chain.length === 0}
              className="h-7 px-2 rounded panel-inset text-[9px] text-muted-foreground hover:text-neon-crimson font-mono disabled:opacity-40"
            >CLR</button>
          </div>
        </div>
        <div className="hairline mb-3" />

        {chain.length === 0 ? (
          <div className="text-center font-mono text-[10px] text-muted-foreground py-6">
            Chain empty — tap patterns below or use AI Structure
          </div>
        ) : (
          <div className="no-scrollbar overflow-x-auto -mx-3 px-3">
            <div className="flex gap-1 min-w-max items-center">
              {chain.map((cs, i) => {
                const pat = patterns[cs.patternId];
                const isCurrent = transport.currentPattern === cs.patternId;
                const transition = transitions[i] ?? "CUT";
                return (
                  <div key={i} className="flex items-center gap-1">
                    {/* Pattern tile */}
                    <div
                      className={cn(
                        "relative rounded-lg panel-inset flex flex-col items-center justify-center gap-0.5 shrink-0",
                        "min-w-[3.5rem] h-16 p-1",
                        isCurrent && "neon-border",
                        cs.skip && "opacity-40",
                      )}
                    >
                      <span className="font-mono text-[8px] text-muted-foreground absolute top-1 left-1">{i + 1}</span>
                      <span className="font-display text-sm text-primary">{pat?.name ?? "?"}</span>
                      {/* Repeat control */}
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setChainStepRepeat(i, Math.max(1, cs.repeat - 1))} className="h-4 w-4 grid place-items-center text-muted-foreground text-[10px]">−</button>
                        <span className="font-mono text-[9px] text-primary tabular-nums w-5 text-center">×{cs.repeat}</span>
                        <button onClick={() => setChainStepRepeat(i, cs.repeat + 1)} className="h-4 w-4 grid place-items-center text-muted-foreground text-[10px]">+</button>
                      </div>
                      {/* Actions */}
                      <div className="absolute top-1 right-1 flex gap-0.5">
                        <button onClick={() => toggleChainStepSkip(i)} className="h-4 w-4 grid place-items-center">
                          {cs.skip ? <EyeOff className="h-2.5 w-2.5 text-muted-foreground" /> : <Eye className="h-2.5 w-2.5 text-primary" />}
                        </button>
                        <button onClick={() => removeFromChain(i)} className="h-4 w-4 grid place-items-center text-muted-foreground hover:text-neon-crimson">
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Transition arrow between steps */}
                    {i < chain.length - 1 && (
                      <button
                        onClick={() => cycleTransition(i)}
                        className="flex flex-col items-center gap-0.5 h-10 px-0.5 justify-center shrink-0"
                        title={`Transition: ${transition}`}
                      >
                        <ArrowRight className={cn("h-3 w-3", TRANSITION_COLORS[transition])} />
                        <span className={cn("font-mono text-[7px]", TRANSITION_COLORS[transition])}>{transition}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Pattern grid — tap to add to chain ─── */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Plus className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">PATTERNS</span>
          <span className="font-mono text-[9px] text-muted-foreground ml-1">tap to add · long-press to edit</span>
        </div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          {patterns.map((p) => {
            const isCurrent = transport.currentPattern === p.id;
            const inChain = chain.some((cs) => cs.patternId === p.id);
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (!lpMoved.current[p.id]) addToChain(p.id, 1);
                  lpMoved.current[p.id] = false;
                }}
                onPointerDown={() => {
                  lpMoved.current[p.id] = false;
                  lpTimers.current[p.id] = setTimeout(() => {
                    lpMoved.current[p.id] = true; // suppress onClick
                    selectPattern(p.id);
                    setTab("ROLL");
                  }, 500);
                }}
                onPointerUp={() => clearTimeout(lpTimers.current[p.id])}
                onPointerCancel={() => { clearTimeout(lpTimers.current[p.id]); lpMoved.current[p.id] = false; }}
                onPointerLeave={() => clearTimeout(lpTimers.current[p.id])}
                onPointerMove={(e) => {
                  if (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4) {
                    clearTimeout(lpTimers.current[p.id]);
                  }
                }}
                className={cn(
                  "h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 transition-transform select-none",
                  isCurrent ? "bg-gradient-primary text-primary-foreground" : "panel-inset",
                  inChain && !isCurrent && "neon-border",
                )}
                title="Tap to add · hold to edit in Piano Roll"
              >
                <span className={cn("font-display text-[11px]", isCurrent ? "text-primary-foreground" : "text-primary")}>{p.name}</span>
                <span className={cn("font-mono text-[8px]", isCurrent ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {inChain ? `×${chain.filter((cs) => cs.patternId === p.id).length}` : `PAT ${p.id + 1}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Live pattern switch ─── */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">LIVE SWITCH</span>
          {transport.playing && <span className="h-1.5 w-1.5 rounded-full bg-neon-lime glow-dot ml-auto" />}
        </div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          {patterns.map((p) => {
            const isCurrent = transport.currentPattern === p.id;
            const isQueued = transport.queuedPattern === p.id;
            return (
              <button
                key={p.id}
                onClick={() => queuePattern(p.id)}
                className={cn(
                  "h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 transition-transform",
                  isCurrent ? "bg-gradient-primary text-primary-foreground" : "panel-inset text-muted-foreground",
                  isQueued && "neon-border",
                )}
              >
                <span className="font-display text-[10px]">{p.name}</span>
                {isQueued && <span className="font-mono text-[8px] text-neon-amber">QUEUED</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── AI Arrangement ─── */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">AI ARRANGEMENT</span>
          <div className="ml-auto">
            <AiContextButton label="Generate Arrangement" onAction={applyAiStructure} />
          </div>
        </div>
        <div className="hairline mb-2" />

        {/* Genre selector */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[9px] text-muted-foreground shrink-0">GENRE</span>
          <div className="flex gap-1 flex-wrap">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                data-active={genre === g}
                className={cn(
                  "tab-pill h-7 px-2 rounded font-mono text-[9px]",
                  genre === g ? "text-primary" : "panel-inset text-muted-foreground",
                )}
              >{g.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={applyAiStructure}
            className="h-12 rounded-lg panel-inset flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 hover:neon-border"
          >
            <Music2 className="h-4 w-4 text-primary" />
            <span className="font-mono text-[8px] text-muted-foreground">SONG STRUCTURE</span>
          </button>
          <button
            onClick={applyAiRemix}
            className="h-12 rounded-lg panel-inset flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 hover:neon-border"
          >
            <Wand2 className="h-4 w-4 text-primary" />
            <span className="font-mono text-[8px] text-muted-foreground">REMIX IDEA</span>
          </button>
        </div>

        {aiResult && (
          <div className="mt-2 panel-inset p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="font-mono text-[10px] text-foreground leading-relaxed flex-1">{aiResult}</p>
            </div>
            {aiChainSteps && (
              <button
                onClick={applyAiChain}
                className="w-full mt-2 h-10 rounded-lg bg-gradient-primary text-primary-foreground font-display text-xs tracking-wider flex items-center justify-center gap-2 touch-none active:scale-[0.98] transition-transform"
              >
                <Repeat2 className="h-4 w-4" />
                APPLY · {aiChainSteps.length} STEPS
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="panel-inset rounded-lg px-2 py-1.5 min-w-0">
      <div className="font-mono text-[7px] text-muted-foreground">{label}</div>
      <div className={cn("font-display text-[10px] truncate", warn ? "text-neon-crimson" : "text-primary")}>{value}</div>
    </div>
  );
}
