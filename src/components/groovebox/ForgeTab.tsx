import { useMemo, useState } from "react";
import { BUILTIN_FORGE_PRESETS, presetsByCategory } from "@/lib/forge/presets";
import { getForgeDescriptor } from "@/lib/forge/registry";
import type {
  ForgeArea,
  ForgeNodeState,
  ForgeParamDef,
  ForgePreset,
  ForgePresetCategory,
} from "@/lib/forge/types";
import { renderPresetToAudioBuffer } from "@/lib/forge/render";
import { assignBufferToPart, ensureAudio, previewBuffer } from "@/lib/audio/engine";
import { useGroove } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { TactileKnob } from "@/components/controls/TactileKnob";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Play, Send } from "lucide-react";

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

type MacroKey =
  | "source"
  | "pitch"
  | "filter"
  | "shape"
  | "harmonics"
  | "spatial"
  | "evolution"
  | "output";

interface MacroSpec {
  key: MacroKey;
  label: string;
  color: "cyan" | "magenta" | "amber" | "lime";
  preferredParams: string[];
}

interface MacroBinding {
  spec: MacroSpec;
  node: ForgeNodeState | null;
  param: ForgeParamDef | null;
}

const MACROS: MacroSpec[] = [
  { key: "source", label: "SOURCE", color: "cyan", preferredParams: ["gain", "level"] },
  { key: "pitch", label: "PITCH", color: "magenta", preferredParams: ["freq", "speed"] },
  { key: "filter", label: "FILTER", color: "cyan", preferredParams: ["cutoff", "amount", "color"] },
  { key: "shape", label: "SHAPE", color: "amber", preferredParams: ["ratio", "curve", "color"] },
  { key: "harmonics", label: "HARMONICS", color: "amber", preferredParams: ["amount", "color", "ratio"] },
  { key: "spatial", label: "SPATIAL", color: "magenta", preferredParams: ["width", "pan", "spread", "level"] },
  { key: "evolution", label: "EVOLUTION", color: "lime", preferredParams: ["decay", "hold", "speed", "attack"] },
  { key: "output", label: "OUTPUT", color: "lime", preferredParams: ["level", "gain"] },
];

function cloneForgePreset(preset: ForgePreset): ForgePreset {
  return {
    ...preset,
    nodes: preset.nodes.map((node) => ({ ...node, params: { ...node.params } })),
    edges: preset.edges.map((edge) => ({ ...edge })),
    automation: preset.automation?.map((event) => ({ ...event })),
    macros: preset.macros ? { ...preset.macros } : undefined,
  };
}

function buildMacroBindings(preset: ForgePreset): MacroBinding[] {
  const candidates = preset.nodes.flatMap((node) => {
    const descriptor = getForgeDescriptor(node.kind);
    return (descriptor?.params ?? []).map((param) => ({ node, param }));
  });
  const used = new Set<string>();

  return MACROS.map((spec) => {
    const preferred = candidates.find(({ node, param }) =>
      !used.has(`${node.id}:${param.id}`) && spec.preferredParams.includes(param.id),
    );
    const fallback = candidates.find(({ node, param }) => !used.has(`${node.id}:${param.id}`));
    const match = preferred ?? fallback;
    if (!match) return { spec, node: null, param: null };
    used.add(`${match.node.id}:${match.param.id}`);
    return { spec, node: match.node, param: match.param };
  });
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (Math.abs(value) >= 10) return `${Math.round(value)}`;
  return `${Math.round(value * 100) / 100}`;
}

function formatParamValue(value: number, param: ForgeParamDef): string {
  if (param.unit === "Hz") return `${formatNumber(value)}Hz`;
  if (param.unit === "s") return `${formatNumber(value)}s`;
  if (param.id === "gain" || param.id === "level") return `${Math.round(value * 100)}%`;
  if (param.id === "ratio") return `${formatNumber(value)}x`;
  return formatNumber(value);
}

export function ForgeTab() {
  const groups = useMemo(presetsByCategory, []);
  const [cat, setCat] = useState<ForgePresetCategory>("kick");
  const list = groups[cat] ?? [];
  const [presetIdx, setPresetIdx] = useState(0);
  const preset: ForgePreset = list[presetIdx] ?? BUILTIN_FORGE_PRESETS[0];
  const parts = useGroove((s) => s.parts);
  const selectedPart = useGroove((s) => s.selectedPart);
  const selectPart = useGroove((s) => s.selectPart);
  const partName = parts[selectedPart]?.name ?? `Part ${selectedPart + 1}`;
  const [draft, setDraft] = useState<ForgePreset>(() => cloneForgePreset(preset));
  const [deepOpen, setDeepOpen] = useState(false);

  const byArea = useMemo(() => {
    const map = new Map<ForgeArea, { node: ForgeNodeState; label: string }[]>();
    for (const a of AREAS) map.set(a.key, []);
    for (const n of draft.nodes) {
      const desc = getForgeDescriptor(n.kind);
      const area: ForgeArea = desc?.area ?? "source";
      map.get(area)!.push({ node: n, label: desc?.label ?? n.kind });
    }
    return map;
  }, [draft]);

  const handleAudition = async () => {
    const ctx = await ensureAudio();
    const buf = renderPresetToAudioBuffer(ctx, draft);
    previewBuffer(buf, 0, 1);
  };

  const handleSendToPart = async () => {
    const ctx = await ensureAudio();
    const buf = renderPresetToAudioBuffer(ctx, draft);
    assignBufferToPart(selectedPart, buf);
    useGroove.getState().setPartSampleName(selectedPart, `forge:${draft.name}`);
    toast({ title: "Sent to part", description: `${draft.name} → ${partName}` });
  };

  const updateNodeParam = (nodeId: string, paramId: string, value: number) => {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, params: { ...node.params, [paramId]: value } }
          : node,
      ),
    }));
  };

  const chooseCategory = (nextCat: ForgePresetCategory) => {
    const nextPreset = groups[nextCat]?.[0] ?? BUILTIN_FORGE_PRESETS[0];
    setCat(nextCat);
    setPresetIdx(0);
    setDraft(cloneForgePreset(nextPreset));
  };

  const choosePreset = (nextIdx: number) => {
    const nextPreset = list[nextIdx] ?? BUILTIN_FORGE_PRESETS[0];
    setPresetIdx(nextIdx);
    setDraft(cloneForgePreset(nextPreset));
  };

  const bindings = useMemo(() => buildMacroBindings(draft), [draft]);

  return (
    <div className="space-y-3">
      {/* Instrument-first target picker — the rendered sound always has a destination. */}
      <section className="panel p-2">
        <div className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1.5">PART</div>
        <div className="no-scrollbar overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1 min-w-max">
            {parts.map((pt) => (
              <button
                key={pt.id}
                onClick={() => selectPart(pt.id)}
                className={cn(
                  "shrink-0 h-11 min-w-[3.5rem] px-2 rounded panel-inset flex flex-col items-center justify-center gap-0.5 touch-none",
                  pt.id === selectedPart && "neon-border text-primary",
                )}
              >
                <span className="text-[7px] text-muted-foreground font-mono">
                  {String(pt.id + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-[9px] truncate w-full text-center">{pt.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[8px] text-primary tracking-[0.22em]">SAMPLE FORGE · SOUND</p>
          <h2 className="font-display text-lg tracking-wide">FORGE PRESETS</h2>
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">{BUILTIN_FORGE_PRESETS.length} PRESETS</span>
      </header>

      {/* Category picker — one horizontal gesture, one filtering purpose. */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => chooseCategory(c.key)}
            className={cn(
              "shrink-0 h-8 px-3 rounded-full text-[9px] font-mono uppercase tracking-widest border whitespace-nowrap transition-colors",
              cat === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card/40 border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label} <span className="opacity-60">{groups[c.key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Preset rail keeps selection lightweight; the selected preset gets the hero treatment below. */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {list.map((p, i) => (
          <button
            key={p.name}
            onClick={() => choosePreset(i)}
            className={cn(
              "shrink-0 min-w-[8.5rem] px-2.5 py-2 rounded-md border text-left font-mono text-[10px] transition-colors",
              i === presetIdx
                ? "bg-accent/30 border-accent text-accent-foreground neon-border"
                : "bg-card/40 border-border hover:bg-card/70 text-muted-foreground",
            )}
          >
            <div className="truncate">{p.name}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {p.nodes.length} nodes · {(p.durationSec ?? 1).toFixed(2)}s
            </div>
          </button>
        ))}
      </div>

      {/* Hero — decision-ready information and the immediate audition action. */}
      <section className="panel p-3 relative overflow-hidden">
        <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[8px] text-muted-foreground tracking-widest mb-1">SELECTED PRESET</p>
            <h3 className="font-display text-xl text-primary truncate">{draft.name}</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[9px] text-muted-foreground">
              <span>{draft.durationSec?.toFixed(2) ?? "1.00"}s</span>
              <span>{draft.nodes.length} NODES</span>
              <span>{CATS.find((c) => c.key === draft.category)?.label ?? "CUSTOM"}</span>
            </div>
          </div>
          <Button size="sm" onClick={handleAudition} className="shrink-0 h-10 px-3">
            <Play className="h-3.5 w-3.5 mr-1.5" /> AUDITION
          </Button>
        </div>
      </section>

      {/* Primary 4×2 macro surface. Each knob targets a real node parameter in the draft graph. */}
      <section className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-display text-xs text-primary">MACRO · 8 PARAMS</div>
            <div className="font-mono text-[8px] text-muted-foreground mt-0.5">SHAPE THE SOUND, THEN SEND IT</div>
          </div>
          <span className="font-mono text-[8px] text-muted-foreground">DRAFT</span>
        </div>
        <div className="hairline mb-3" />
        <div className="grid grid-cols-4 gap-2">
          {bindings.map((binding) => {
            const value = binding.param && binding.node
              ? binding.node.params[binding.param.id] ?? binding.param.default
              : 0;
            return (
              <TactileKnob
                key={binding.spec.key}
                label={binding.spec.label}
                value={value}
                min={binding.param?.min ?? 0}
                max={binding.param?.max ?? 1}
                defaultValue={binding.param?.default}
                onChange={(next) => {
                  if (binding.node && binding.param) {
                    updateNodeParam(binding.node.id, binding.param.id, next);
                  }
                }}
                size="sm"
                color={binding.spec.color}
                display={binding.param ? formatParamValue(value, binding.param) : "—"}
                disabled={!binding.node || !binding.param}
              />
            );
          })}
        </div>
      </section>

      {/* Primary action stays in the compact flow and never hides behind the deep editor. */}
      <Button size="sm" onClick={handleSendToPart} className="w-full h-11">
        <Send className="h-4 w-4 mr-2" /> SEND TO {partName.toUpperCase()}
      </Button>

      {/* Full graph detail is intentionally secondary. */}
      <section className="panel p-3">
        <button
          onClick={() => setDeepOpen((open) => !open)}
          className="w-full flex items-center justify-between font-display text-xs text-muted-foreground"
          aria-expanded={deepOpen}
        >
          <span>DEEP EDITOR</span>
          {deepOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {deepOpen && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AREAS.map((a) => {
                const items = byArea.get(a.key) ?? [];
                return (
                  <section key={a.key} className="rounded-lg border border-border bg-card/40 p-2 min-h-[92px]">
                    <header className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{a.label}</span>
                      <span className="font-mono text-[9px] text-muted-foreground">{items.length}</span>
                    </header>
                    <ul className="space-y-1">
                      {items.length === 0 && (
                        <li className="text-[9px] font-mono text-muted-foreground/50 italic">empty</li>
                      )}
                      {items.map(({ node, label }) => (
                        <li key={node.id} className="rounded border border-border/60 bg-background/60 px-2 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px]">{label}</span>
                            <span className="font-mono text-[8px] text-muted-foreground">{node.id}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[8px] text-muted-foreground">
                            {Object.entries(node.params).map(([key, value]) => (
                              <span key={key}>{key} {formatNumber(value)}</span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
            <div className="rounded-md border border-border/60 bg-background/40 p-2">
              <div className="font-mono text-[8px] tracking-widest text-muted-foreground mb-1">GRAPH LINKS</div>
              <div className="flex flex-wrap gap-1.5">
                {draft.edges.map((edge) => (
                  <span key={`${edge.from}-${edge.to}-${edge.toPort}`} className="rounded panel-inset px-2 py-1 font-mono text-[8px]">
                    {edge.from} → {edge.to}
                  </span>
                ))}
              </div>
            </div>
            <details className="rounded-md border border-border/60 bg-background/30 p-2">
              <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                PRESET JSON
              </summary>
              <pre className="mt-2 text-[9px] font-mono overflow-auto max-h-64">
                {JSON.stringify(draft, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
