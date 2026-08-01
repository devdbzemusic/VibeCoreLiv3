import { useState } from "react";
import { useGroove } from "@/lib/store";
import { buildScene, type ScenebuildStyle } from "@/lib/audio/aiSceneBuild";
import type { PartCategory, Step } from "@/lib/model";
import { Sparkles, Bot } from "lucide-react";
import { AiCoAssistant } from "@/components/groovebox/AiCoAssistant";
import { cn } from "@/lib/utils";

const STYLES: ScenebuildStyle[] = ["fourFloor", "boomBap", "trap", "breaks", "techno", "ambient", "minimal"];
const LENGTHS = [4, 8, 16] as const;

type View = "co" | "part";

export function AiSceneTab() {
  const [view, setView] = useState<View>("co");

  return (
    <div className="p-3 space-y-3">
      {/* AI function toggle: Co-Assistant (groove/melody) vs single-Part builder. */}
      <div className="hw-bezel p-1.5 flex gap-1">
        <button onClick={() => setView("co")} data-active={view === "co"}
          className={cn(
            "tab-pill flex-1 flex items-center justify-center gap-1.5 py-2 font-display text-[11px] tracking-wider",
            view === "co" ? "text-primary" : "text-muted-foreground",
          )}>
          <Bot className="h-3.5 w-3.5" /> CO-ASSISTANT
        </button>
        <button onClick={() => setView("part")} data-active={view === "part"}
          className={cn(
            "tab-pill flex-1 flex items-center justify-center gap-1.5 py-2 font-display text-[11px] tracking-wider",
            view === "part" ? "text-primary" : "text-muted-foreground",
          )}>
          <Sparkles className="h-3.5 w-3.5" /> PART BUILDER
        </button>
      </div>

      {view === "co" ? <AiCoAssistant /> : <PartBuilder />}
    </div>
  );
}

function PartBuilder() {
  const { parts, patterns, selectedPattern, selectedSceneIdx, setPatternSteps } = useGroove();
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
    // Pattern scene length doesn't auto-change here — write up to current length
    setPatternSteps(part.id, steps);
  };

  const reroll = () => setSeed((s) => (s + 0x9e3779b1) >>> 0);

  return (
    <div className="space-y-3">
      <div className="hw-bezel p-3 flex items-center justify-between">
        <div>
          <div className="font-display text-sm text-primary tracking-widest">AI SCENEBUILD</div>
          <div className="font-mono text-[10px] text-muted-foreground">Deterministic · Variable length</div>
        </div>
        <button onClick={generate}
          className="hw-screen px-3 py-2 flex items-center gap-2 font-display text-[11px] text-primary">
          <Sparkles className="h-3.5 w-3.5" /> GENERATE
        </button>
      </div>

      <div className="hw-bezel p-3 space-y-3">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground mb-1 tracking-widest">PART (scene len {sceneLen})</div>
          <div className="flex flex-wrap gap-1">
            {parts.map((p) => (
              <button key={p.id}
                onClick={() => setPartId(p.id)}
                data-active={partId === p.id}
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
              <button key={L}
                onClick={() => setLength(L)}
                data-active={length === L}
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
              <button key={s}
                onClick={() => setStyle(s)}
                data-active={style === s}
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
          <div className="font-mono text-[10px] text-muted-foreground">SEED <span className="text-primary tabular-nums">{seed.toString(16).padStart(8, "0").toUpperCase()}</span></div>
          <button onClick={reroll} className="hw-screen px-2 py-1 font-mono text-[10px] text-primary">REROLL</button>
        </div>
      </div>

      {lastPreview.length > 0 && (
        <div className="hw-bezel p-3">
          <div className="font-mono text-[10px] text-muted-foreground mb-2 tracking-widest">PREVIEW · {lastPreview.length} steps</div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(lastPreview.length, 16)}, minmax(0, 1fr))` }}>
            {lastPreview.map((on, i) => (
              <div key={i}
                className={cn("h-6 rounded-sm border", on ? "bg-primary border-primary" : "bg-secondary border-border")} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}