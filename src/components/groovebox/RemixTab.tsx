// VibeCore UI — Remix Tab.
// Live arrangement surface: pattern chain, song structure, transitions, AI.
// No classic timeline — pattern-chain-based arrangement.

import { useState, useCallback } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Sparkles, Wand2, ArrowRight, Trash2, Plus, Repeat2,
  Eye, EyeOff, Music2, Zap,
} from "lucide-react";
import { buildContext } from "@/lib/ai/context";
import {
  suggestRemixIdea, suggestRemixTransition,
} from "@/lib/ai/remixAssistant";
import {
  suggestSongStructure, suggestTransition as suggestArrTransition,
} from "@/lib/ai/arrangementAssistant";
import type { ChainStep } from "@/lib/model";

type RemixAction = "STRUCTURE" | "REMIX" | "TRANSITION";

const ACTIONS: { key: RemixAction; label: string; icon: typeof Music2 }[] = [
  { key: "STRUCTURE", label: "SONG STRUCTURE", icon: Music2 },
  { key: "REMIX", label: "REMIX IDEA", icon: Wand2 },
  { key: "TRANSITION", label: "TRANSITION", icon: ArrowRight },
];

const GENRES = ["techno", "house", "dnb", "ambient", "pop"] as const;

export function RemixTab() {
  const {
    patterns, selectedPattern, selectPattern,
    transport, setChainSteps, addToChain, removeFromChain,
    setChainStepRepeat, toggleChainStepSkip, clearChain,
    moveChainStep, setChainMode, queuePattern,
  } = useGroove();

  const [genre, setGenre] = useState<string>("techno");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiChainSteps, setAiChainSteps] = useState<ChainStep[] | null>(null);

  const chain = transport.chainSteps ?? [];
  const chainMode = transport.chainMode;

  const applyAi = useCallback((action: RemixAction) => {
    const ctx = buildContext();
    if (action === "STRUCTURE") {
      const s = suggestSongStructure(ctx, { seed: Date.now() >>> 0, genre });
      setAiResult(s.description);
      setAiChainSteps(s.payload.chainSteps);
    } else if (action === "REMIX") {
      const s = suggestRemixIdea(ctx, { seed: Date.now() >>> 0, genre });
      setAiResult(s.description);
      setAiChainSteps(s.payload.chainSteps ?? null);
    } else if (action === "TRANSITION") {
      const s = suggestRemixTransition(ctx, { seed: Date.now() >>> 0, genre });
      setAiResult(s.description);
      setAiChainSteps(null);
    }
  }, [genre]);

  const applyAiChain = () => {
    if (aiChainSteps) setChainSteps(aiChainSteps);
    setAiChainSteps(null);
    setAiResult(null);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="hw-bezel p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-xs text-primary">PATTERN CHAIN · SONG MODE</span>
          <span className="font-mono text-[10px] text-muted-foreground">{chain.length} STEPS</span>
        </div>
        <div className="hairline mb-3" />
        {/* Chain mode toggle */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[9px] text-muted-foreground">CHAIN MODE</span>
          {(["IMMEDIATE", "BOUNDARY"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setChainMode(m)}
              data-active={chainMode === m}
              className={cn(
                "tab-pill px-2.5 py-1 rounded font-mono text-[10px]",
                chainMode === m ? "text-primary" : "panel-inset text-muted-foreground",
              )}
            >{m === "IMMEDIATE" ? "IMM" : "BAR"}</button>
          ))}
          <button
            onClick={() => clearChain()}
            disabled={chain.length === 0}
            className="ml-auto h-8 px-2.5 rounded panel-inset text-[10px] text-muted-foreground hover:text-neon-crimson font-mono disabled:opacity-40"
          >CLEAR</button>
        </div>

        {/* Chain strip — horizontal, draggable in future, touch-friendly now */}
        {chain.length === 0 ? (
          <div className="text-center font-mono text-[10px] text-muted-foreground py-6">
            Empty chain — add patterns below or use AI Song Structure
          </div>
        ) : (
          <div className="no-scrollbar overflow-x-auto -mx-3 px-3">
            <div className="flex gap-1.5 min-w-max">
              {chain.map((cs, i) => {
                const pat = patterns[cs.patternId];
                const isCurrent = transport.currentPattern === cs.patternId;
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative h-16 min-w-[4rem] rounded-md panel-inset flex flex-col items-center justify-center gap-0.5 shrink-0",
                      isCurrent && "neon-border",
                      cs.skip && "opacity-40",
                    )}
                  >
                    <span className="font-mono text-[8px] text-muted-foreground absolute top-1 left-1">{i + 1}</span>
                    {cs.marker && (
                      <span className="font-display text-[8px] text-primary absolute top-1 right-1 truncate max-w-[3rem]">
                        {cs.marker}
                      </span>
                    )}
                    <span className="font-display text-sm text-primary">{pat?.name ?? "?"}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setChainStepRepeat(i, Math.max(1, cs.repeat - 1))}
                        className="h-4 w-4 rounded grid place-items-center text-muted-foreground"
                      >−</button>
                      <span className="font-mono text-[10px] text-primary tabular-nums w-4 text-center">×{cs.repeat}</span>
                      <button
                        onClick={() => setChainStepRepeat(i, cs.repeat + 1)}
                        className="h-4 w-4 rounded grid place-items-center text-muted-foreground"
                      >+</button>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <button
                        onClick={() => toggleChainStepSkip(i)}
                        className="h-4 w-4 rounded grid place-items-center"
                        title={cs.skip ? "Unskip" : "Skip"}
                      >
                        {cs.skip ? <EyeOff className="h-2.5 w-2.5 text-muted-foreground" /> : <Eye className="h-2.5 w-2.5 text-primary" />}
                      </button>
                      <button
                        onClick={() => i > 0 && moveChainStep(i, i - 1)}
                        className="h-4 w-4 rounded grid place-items-center text-muted-foreground"
                        title="Move left"
                      ><ArrowRight className="h-2.5 w-2.5 rotate-180" /></button>
                      <button
                        onClick={() => i < chain.length - 1 && moveChainStep(i, i + 1)}
                        className="h-4 w-4 rounded grid place-items-center text-muted-foreground"
                        title="Move right"
                      ><ArrowRight className="h-2.5 w-2.5" /></button>
                      <button
                        onClick={() => removeFromChain(i)}
                        className="h-4 w-4 rounded grid place-items-center text-muted-foreground hover:text-neon-crimson"
                      ><Trash2 className="h-2.5 w-2.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick-add pattern buttons */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Plus className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">QUICK ADD PATTERN</span>
        </div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-4 gap-1.5">
          {patterns.map((p) => (
            <button
              key={p.id}
              onClick={() => addToChain(p.id, 1)}
              className={cn(
                "h-12 rounded-md panel-inset flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 transition-transform",
                selectedPattern === p.id && "neon-border",
              )}
            >
              <span className="font-display text-[10px] text-primary">{p.name}</span>
              <span className="font-mono text-[8px] text-muted-foreground">PAT {p.id + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Remix tools */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">AI REMIX ASSISTANT</span>
        </div>
        <div className="hairline mb-3" />
        {/* Genre selector */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-[9px] text-muted-foreground">GENRE</span>
          <div className="flex gap-1 flex-wrap">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                data-active={genre === g}
                className={cn(
                  "tab-pill px-2.5 py-1 rounded font-mono text-[9px]",
                  genre === g ? "text-primary" : "panel-inset text-muted-foreground",
                )}
              >{g.toUpperCase()}</button>
            ))}
          </div>
        </div>
        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={() => applyAi(a.key)}
                className="h-14 rounded-md panel-inset flex flex-col items-center justify-center gap-1 touch-none active:scale-95 transition-transform hover:neon-border"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-mono text-[8px] tracking-wider text-muted-foreground text-center leading-tight">{a.label}</span>
              </button>
            );
          })}
        </div>
        {/* AI result */}
        {aiResult && (
          <div className="mt-3 panel-inset p-3 rounded-md">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="font-mono text-[10px] text-foreground leading-relaxed flex-1">{aiResult}</p>
            </div>
            {aiChainSteps && (
              <button
                onClick={applyAiChain}
                className="w-full mt-2 h-10 rounded-md bg-gradient-primary text-primary-foreground font-display text-xs tracking-wider flex items-center justify-center gap-2 touch-none active:scale-[0.98] transition-transform"
              >
                <Repeat2 className="h-4 w-4" />
                APPLY CHAIN · {aiChainSteps.length} STEPS
              </button>
            )}
          </div>
        )}
      </div>

      {/* Live pattern switch — performance grid */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-display text-xs text-primary">LIVE PATTERN SWITCH</span>
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
                  "h-12 rounded-md flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 transition-transform",
                  isCurrent ? "bg-gradient-primary text-primary-foreground" : "panel-inset text-muted-foreground",
                  isQueued && "neon-border",
                )}
              >
                <span className="font-display text-[10px]">{p.name}</span>
                {isQueued && <span className="font-mono text-[8px] text-neon-amber">→ QUEUED</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}