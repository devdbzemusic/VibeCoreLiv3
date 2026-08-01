import { useMemo, useState } from "react";
import { BUILTIN_FORGE_PRESETS, presetsByCategory } from "@/lib/forge/presets";
import { getForgeDescriptor } from "@/lib/forge/registry";
import type { ForgeArea, ForgePreset, ForgePresetCategory } from "@/lib/forge/types";
import { renderPresetToAudioBuffer } from "@/lib/forge/render";
import { assignBufferToPart, ensureAudio, previewBuffer } from "@/lib/audio/engine";
import { useGroove } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const AREAS: { key: ForgeArea; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "shape", label: "Shape" },
  { key: "harmonics", label: "Harmonics" },
  { key: "spatial", label: "Spatial" },
  { key: "evolution", label: "Evolution" },
  { key: "output", label: "Output" },
];

const CATS: { key: ForgePresetCategory; label: string }[] = [
  { key: "kick", label: "Kicks" },
  { key: "snare", label: "Snares" },
  { key: "hat", label: "Hats" },
  { key: "perc", label: "Perc" },
  { key: "bass", label: "Bass" },
  { key: "synth", label: "Synths" },
  { key: "experimental", label: "Exp" },
];

export function ForgeTab() {
  const groups = useMemo(presetsByCategory, []);
  const [cat, setCat] = useState<ForgePresetCategory>("kick");
  const list = groups[cat] ?? [];
  const [presetIdx, setPresetIdx] = useState(0);
  const preset: ForgePreset = list[presetIdx] ?? BUILTIN_FORGE_PRESETS[0];
  const selectedPart = useGroove((s) => s.selectedPart);
  const partName = useGroove((s) => s.parts[selectedPart]?.sampleName ?? `Part ${selectedPart + 1}`);

  const byArea = useMemo(() => {
    const map = new Map<ForgeArea, { id: string; kind: string; label: string }[]>();
    for (const a of AREAS) map.set(a.key, []);
    for (const n of preset.nodes) {
      const desc = getForgeDescriptor(n.kind);
      const area: ForgeArea = desc?.area ?? "source";
      map.get(area)!.push({ id: n.id, kind: n.kind, label: desc?.label ?? n.kind });
    }
    return map;
  }, [preset]);

  const handleAudition = async () => {
    const ctx = await ensureAudio();
    const buf = renderPresetToAudioBuffer(ctx, preset);
    previewBuffer(buf, 0, 1);
  };

  const handleSendToPart = async () => {
    const ctx = await ensureAudio();
    const buf = renderPresetToAudioBuffer(ctx, preset);
    assignBufferToPart(selectedPart, buf);
    useGroove.getState().setPartSampleName(selectedPart, `forge:${preset.name}`);
    toast({ title: "Sent to part", description: `${preset.name} → Part ${selectedPart + 1}` });
  };

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-wide">FORGE</h2>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Sound Generator · {BUILTIN_FORGE_PRESETS.length} presets
          </p>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setCat(c.key); setPresetIdx(0); }}
            className={cn(
              "px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-widest border whitespace-nowrap",
              cat === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card/40 border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label} <span className="opacity-60">{groups[c.key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
        {list.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPresetIdx(i)}
            className={cn(
              "px-2 py-2 rounded border text-left font-mono text-xs",
              i === presetIdx
                ? "bg-accent/30 border-accent text-accent-foreground"
                : "bg-card/40 border-border hover:bg-card/70",
            )}
          >
            <div className="truncate">{p.name}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {p.nodes.length} nodes · {(p.durationSec ?? 1).toFixed(2)}s
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={handleAudition}>▶ Audition</Button>
        <Button size="sm" variant="secondary" onClick={handleSendToPart}>
          ↑ Send to {partName}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {AREAS.map((a) => {
          const items = byArea.get(a.key) ?? [];
          return (
            <section
              key={a.key}
              className="rounded-lg border border-border bg-card/40 p-2 min-h-[100px] flex flex-col"
            >
              <header className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {a.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{items.length}</span>
              </header>
              <ul className="flex-1 space-y-1">
                {items.length === 0 && (
                  <li className="text-[10px] font-mono text-muted-foreground/50 italic">empty</li>
                )}
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="rounded border border-border/60 bg-background/60 px-2 py-1 flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-xs">{it.label}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{it.id}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <details className="rounded-lg border border-border bg-card/30 p-2">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Preset JSON
        </summary>
        <pre className="mt-2 text-[10px] font-mono overflow-auto max-h-64">
{JSON.stringify(preset, null, 2)}
        </pre>
      </details>
    </div>
  );
}
