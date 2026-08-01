// VibeCoreLiv3 — ArpEngine control panel (SceneStep-based shared arpeggiator).
//
// UI for the single shared ArpEngine that feeds Bass, 3D Synth and later
// modules. The engine itself lives in `@/lib/audio/arpEngine.ts` and is
// driven by the scheduler; this panel only edits the persisted ArpConfig.

import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ARP_MODES, ARP_STATES, ARP_SCALES,
  type ArpMode, type ArpState, type ArpScale,
} from "@/lib/audio/arpEngine";
import { Power, Repeat, ChevronUp, ChevronDown } from "lucide-react";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function noteLabel(midi: number): string {
  const n = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[n]}${oct}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="font-mono text-[9px] text-muted-foreground w-20 shrink-0">{label}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function ArpPanel() {
  const { arp, setArp, toggleArpStep, parts, playheads, patterns, transport } = useGroove();
  const pat = patterns[transport.currentPattern];
  const sceneSteps = pat?.scenes[transport.currentSceneIdx ?? 0]?.length ?? 16;
  const currentStep = playheads.step ?? 0;

  const toggleTarget = (id: number) => {
    const has = arp.targetParts.includes(id);
    const targetParts = has
      ? arp.targetParts.filter((t) => t !== id)
      : [...arp.targetParts, id];
    setArp({ targetParts });
  };

  return (
    <div className="space-y-3">
      {/* Header + enable */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 mb-2">
          <Repeat className="h-4 w-4 text-primary" />
          <div className="font-display text-sm text-primary tracking-wider">ARP ENGINE</div>
          <span className="ml-auto font-mono text-[9px] text-muted-foreground">
            SceneStep · {sceneSteps} steps
          </span>
          <button
            onClick={() => setArp({ enabled: !arp.enabled })}
            className={cn(
              "tab-pill px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono text-[10px]",
              arp.enabled ? "text-primary neon-border" : "text-muted-foreground panel-inset",
            )}
            aria-pressed={arp.enabled}
          >
            <Power className="h-3 w-3" />
            {arp.enabled ? "ON" : "OFF"}
          </button>
        </div>
        <div className="hairline mb-3" />

        {/* ARP COMPLEXITY macro */}
        <div className="panel-inset rounded p-2.5 mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="font-display text-[11px] text-primary">ARP COMPLEXITY</div>
            <div className="font-mono text-sm tabular-nums text-primary">{arp.complexity}</div>
          </div>
          <input
            type="range" min={0} max={100} value={arp.complexity}
            onChange={(e) => setArp({ complexity: Number(e.target.value) })}
            className="w-full accent-primary h-1.5"
            aria-label="Arp complexity"
          />
          <div className="font-mono text-[8px] text-muted-foreground mt-1 leading-tight">
            drives note density · octave jumps · ratchets · probability · DNA variation
          </div>
        </div>

        {/* Mode selector */}
        <Row label="MODE">
          <div className="flex flex-wrap gap-1">
            {ARP_MODES.map((m: ArpMode) => (
              <button key={m} onClick={() => setArp({ mode: m })}
                data-active={arp.mode === m}
                className={cn(
                  "tab-pill px-2 py-1 rounded font-mono text-[9px] border border-border",
                  arp.mode === m ? "text-primary" : "text-muted-foreground",
                )}>
                {m}
              </button>
            ))}
          </div>
        </Row>
      </div>

      {/* Pitch + scale + state */}
      <div className="panel p-3 space-y-2">
        <Row label="ROOT">
          <div className="flex items-center gap-1">
            <button onClick={() => setArp({ rootNote: arp.rootNote - 1 })}
              className="h-7 w-7 grid place-items-center panel-inset rounded">
              <ChevronDown className="h-3 w-3" />
            </button>
            <div className="hw-screen px-2 py-1 flex-1 text-center font-display text-sm">{noteLabel(arp.rootNote)}</div>
            <button onClick={() => setArp({ rootNote: arp.rootNote + 1 })}
              className="h-7 w-7 grid place-items-center panel-inset rounded">
              <ChevronUp className="h-3 w-3" />
            </button>
          </div>
        </Row>

        <Row label="SCALE">
          <div className="flex flex-wrap gap-1">
            {ARP_SCALES.map((s: ArpScale) => (
              <button key={s} onClick={() => setArp({ scale: s })}
                data-active={arp.scale === s}
                className={cn(
                  "tab-pill px-2 py-1 rounded font-mono text-[9px] border border-border",
                  arp.scale === s ? "text-primary" : "text-muted-foreground",
                )}>
                {s}
              </button>
            ))}
          </div>
        </Row>

        <Row label="OCTAVES">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((o) => (
              <button key={o} onClick={() => setArp({ octaves: o })}
                data-active={arp.octaves === o}
                className={cn(
                  "tab-pill flex-1 py-1 rounded font-mono text-[10px] border border-border",
                  arp.octaves === o ? "text-primary" : "text-muted-foreground",
                )}>
                {o}
              </button>
            ))}
          </div>
        </Row>

        <Row label="STATE">
          <div className="flex gap-1">
            {ARP_STATES.map((st: ArpState) => (
              <button key={st} onClick={() => setArp({ state: st })}
                data-active={arp.state === st}
                className={cn(
                  "tab-pill flex-1 py-1 rounded font-mono text-[9px] border border-border",
                  arp.state === st ? "text-primary" : "text-muted-foreground",
                )}>
                {st}
              </button>
            ))}
          </div>
        </Row>

        <Row label="VIBE">
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} value={arp.vibeControl}
              onChange={(e) => setArp({ vibeControl: Number(e.target.value) })}
              className="flex-1 accent-primary h-1.5" aria-label="Vibe control" />
            <div className="font-mono text-[10px] tabular-nums w-7 text-right">{arp.vibeControl}</div>
          </div>
        </Row>
      </div>

      {/* Target modules — the shared engine feeds these */}
      <div className="panel p-3">
        <div className="font-mono text-[9px] text-muted-foreground mb-2">
          TARGET MODULES · shared engine feeds
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {parts.filter((p) => p.category === "bass" || p.category === "synth").map((p) => {
            const on = arp.targetParts.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggleTarget(p.id)}
                data-active={on}
                className={cn(
                  "panel-inset rounded p-1.5 flex items-center gap-1.5 text-left",
                  on ? "neon-border" : "",
                )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-primary glow-dot" : "bg-muted-foreground")} />
                <span className={cn("font-display text-[10px]", on ? "text-primary" : "text-muted-foreground")}>
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 16-step gate grid */}
      <div className="panel p-3">
        <div className="font-mono text-[9px] text-muted-foreground mb-2">STEP GATE · 16</div>
        <div className="grid grid-cols-8 gap-1.5">
          {arp.gateSteps.map((on, i) => (
            <button key={i} onClick={() => toggleArpStep(i)}
              data-active={on}
              data-playing={currentStep === i}
              data-accent={i % 4 === 0}
              className={cn(
                "step-cell h-9",
                i % 4 === 0 && "border-primary/40",
              )}
              aria-label={`Arp step ${i + 1}`}
            />
          ))}
        </div>
        <div className="font-mono text-[8px] text-muted-foreground mt-2 leading-tight">
          A step spawns E_ARP_NOTE only when its cell is on. Density auto-scales with scene length.
        </div>
      </div>
    </div>
  );
}