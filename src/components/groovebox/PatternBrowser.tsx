import { useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Copy, ClipboardPaste, Dices, Star, Search, Pencil, Check,
} from "lucide-react";
import { MAX_PATTERN_PARTS } from "@/lib/model";
import type { Pattern } from "@/lib/model";

const FAV_TAG = "★";
const isFav = (p: Pattern) => (p.tags ?? []).includes(FAV_TAG);
const toggleFavTags = (p: Pattern): string[] =>
  isFav(p) ? (p.tags ?? []).filter((t) => t !== FAV_TAG) : [...(p.tags ?? []), FAV_TAG];

export function PatternBrowser() {
  const {
    patterns, selectedPattern, selectPattern,
    transport, addPatternPart, removePatternPart,
    copyPatternToClipboard, pastePatternFromClipboard,
    duplicatePattern, clearPattern, randomizePattern,
    renamePattern, setPatternTags,
  } = useGroove();

  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [nameVal, setNameVal] = useState("");

  const filtered = patterns.filter((p) => {
    if (favOnly && !isFav(p)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const startRename = (p: Pattern) => { setRenaming(p.id); setNameVal(p.name); };
  const commitRename = () => {
    if (renaming !== null && nameVal.trim()) renamePattern(renaming, nameVal.trim());
    setRenaming(null);
  };

  const onCellTap = (i: number) => {
    if (renaming === i) return;
    selectPattern(i);
  };

  return (
    <div className="panel p-3">
      {/* Header + search */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="font-display text-xs text-primary flex items-center gap-2 shrink-0">
          PATTERN BANK · {patterns.length}/{MAX_PATTERN_PARTS}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={cn("h-7 w-7 rounded panel-inset grid place-items-center shrink-0", favOnly && "neon-border text-neon-amber")}
            aria-label="filter favorites"
          >
            <Star className={cn("h-3.5 w-3.5", favOnly && "fill-neon-amber")} />
          </button>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search…"
              className="w-full h-7 pl-6 pr-2 rounded panel-inset font-mono text-[10px] bg-transparent outline-none"
            />
          </div>
        </div>
      </div>
      <div className="hairline mb-2" />

      {/* Pattern grid */}
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto no-scrollbar">
        {filtered.map((p) => {
          const sel = p.id === selectedPattern;
          const playing = transport.playing && transport.currentPattern === p.id;
          const queued = transport.queuedPattern === p.id;
          const fav = isFav(p);
          return (
            <div key={p.id} className="relative">
              <button
                onClick={() => onCellTap(p.id)}
                className={cn(
                  "w-full aspect-square rounded panel-inset flex flex-col items-center justify-center gap-0.5 touch-none",
                  sel && "neon-border",
                  playing && "text-neon-lime",
                )}
              >
                <span className="font-mono text-[7px] text-muted-foreground">{String(p.id + 1).padStart(3, "0")}</span>
                {renaming === p.id ? (
                  <input
                    autoFocus
                    value={nameVal}
                    onChange={(e) => setNameVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                    onBlur={commitRename}
                    className="w-full px-1 text-center font-display text-[9px] bg-background outline-none neon-border rounded"
                  />
                ) : (
                  <span className="font-display text-[8px] truncate w-full text-center leading-tight px-0.5">{p.name}</span>
                )}
                <span className="font-mono text-[7px] text-muted-foreground">{p.scenes.length}sc</span>
              </button>
              {/* Favorite star */}
              <button
                onClick={(e) => { e.stopPropagation(); setPatternTags(p.id, toggleFavTags(p)); }}
                className={cn("absolute top-0.5 right-0.5", fav ? "text-neon-amber" : "text-muted-foreground/40")}
                aria-label="toggle favorite"
              >
                <Star className={cn("h-2.5 w-2.5", fav && "fill-neon-amber")} />
              </button>
              {/* Queued indicator */}
              {queued && (
                <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-neon-amber glow-dot" />
              )}
            </div>
          );
        })}
        {patterns.length < MAX_PATTERN_PARTS && (
          <button
            onClick={() => addPatternPart()}
            className="aspect-square rounded panel-inset grid place-items-center text-primary"
            aria-label="add pattern"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-1 mt-2">
        <ActBtn icon={Plus} label="ADD" onClick={() => addPatternPart()} disabled={patterns.length >= MAX_PATTERN_PARTS} />
        <ActBtn icon={Copy} label="COPY" onClick={() => copyPatternToClipboard(selectedPattern)} />
        <ActBtn icon={ClipboardPaste} label="PASTE" onClick={() => pastePatternFromClipboard()} />
        <ActBtn icon={Copy} label="DUP" onClick={() => duplicatePattern(selectedPattern)} />
        <ActBtn icon={Dices} label="RND" onClick={() => randomizePattern(selectedPattern)} />
        <ActBtn icon={Pencil} label="REN" onClick={() => { const p = patterns[selectedPattern]; if (p) startRename(p); }} />
        <ActBtn icon={Check} label="CLR" onClick={() => clearPattern(selectedPattern)} tone="amber" />
        <ActBtn icon={Trash2} label="DEL" onClick={() => removePatternPart(selectedPattern)} disabled={patterns.length <= 1} tone="crimson" />
      </div>
    </div>
  );
}

function ActBtn({ icon: Icon, label, onClick, disabled, tone }: {
  icon: typeof Plus; label: string; onClick: () => void; disabled?: boolean;
  tone?: "amber" | "crimson";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 px-2 rounded panel-inset font-mono text-[9px] flex items-center gap-1 touch-none disabled:opacity-30",
        tone === "crimson" && "text-neon-crimson",
        tone === "amber" && "text-neon-amber",
        !tone && "text-primary",
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}