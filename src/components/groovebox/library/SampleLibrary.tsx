import { useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Play, Loader2, Disc } from "lucide-react";
import {
  ensureAudio, assignBufferToPart, previewBuffer,
} from "@/lib/audio/engine";
import {
  SAMPLE_CATALOG, renderSampleRecipe, type SampleRecipe,
} from "@/lib/audio/sampleLibrary";
import type { PartCategory } from "@/lib/model";

const CATS: (PartCategory | "all")[] = ["all", "kick", "snare", "perc", "hat", "bass", "synth", "sample"];
const CAT_LABEL: Record<string, string> = {
  all: "ALL", kick: "KICK", snare: "SNARE", perc: "PERC",
  hat: "HAT", bass: "BASS", synth: "SYNTH", sample: "TEXT",
};

const renderCache = new Map<string, AudioBuffer>();

export function SampleLibrary() {
  const { parts, selectedPart, setPartSampleName, setPartSource, setWaveEdit } = useGroove();
  const part = parts[selectedPart];
  const [cat, setCat] = useState<PartCategory | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const list = SAMPLE_CATALOG.filter((r) => cat === "all" || r.category === cat);

  const loadRecipe = async (r: SampleRecipe) => {
    setBusy(r.id);
    try {
      await ensureAudio();
      let buf = renderCache.get(r.id);
      if (!buf) { buf = await renderSampleRecipe(r); renderCache.set(r.id, buf); }
      assignBufferToPart(selectedPart, buf);
      setPartSampleName(selectedPart, r.name);
      setPartSource(selectedPart, "sample");
      setWaveEdit(selectedPart, { start: 0, end: 1, loop: r.loop });
      previewBuffer(buf);
    } finally { setBusy(null); }
  };

  const preview = async (r: SampleRecipe) => {
    await ensureAudio();
    let buf = renderCache.get(r.id);
    if (!buf) {
      setBusy(r.id);
      try { buf = await renderSampleRecipe(r); renderCache.set(r.id, buf); }
      finally { setBusy(null); }
    }
    previewBuffer(buf);
  };

  return (
    <div className="panel p-3">
      <div className="font-display text-xs text-primary flex items-center gap-2 mb-2">
        <Disc className="h-3.5 w-3.5" /> SAMPLE LIBRARY
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{list.length} sounds</span>
      </div>
      <div className="hairline mb-2" />

      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} data-active={cat === c}
            className={cn("tab-pill px-2 py-1 font-mono text-[9px] border border-border",
              cat === c ? "text-primary" : "text-muted-foreground")}>
            {CAT_LABEL[c]}
          </button>
        ))}
      </div>

      <div className="font-mono text-[9px] text-muted-foreground mb-2">
        TARGET → <span className="text-primary">{part.name}</span>
        <span className="text-muted-foreground"> (tap to assign + preview)</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-72 overflow-y-auto no-scrollbar pr-1">
        {list.map((r) => (
          <div key={r.id} className="panel-inset rounded p-1.5 flex items-center gap-1.5">
            <button onClick={() => loadRecipe(r)} disabled={busy === r.id}
              className={cn("flex-1 text-left font-display text-[10px] leading-tight",
                busy === r.id ? "text-muted-foreground" : "text-primary")}>
              {r.name}
            </button>
            <button onClick={() => preview(r)} disabled={busy === r.id}
              className="h-6 w-6 grid place-items-center rounded panel-inset text-primary disabled:opacity-40 shrink-0"
              aria-label={`Preview ${r.name}`}>
              {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}