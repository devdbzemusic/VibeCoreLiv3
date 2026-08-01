// VibeCoreLiv3 — ARP Module UI (Performance & Advanced redesign).
//
// 8-parameter rule: MODE · RATE · GATE · OCTAVE · ROOT · SCALE · CHANCE · HOLD
// 3-touch rule: (1) enable ARP → (2) tap mode → (3) toggle gate step
// Beat-sync: quarter-note pulse dots track playheads.step in real time.

import { useState, useEffect, useRef } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ARP_MODES, ARP_STATES, ARP_SCALES,
  type ArpMode, type ArpState, type ArpScale,
} from "@/lib/audio/arpEngine";
import { TactileKnob } from "@/components/controls/TactileKnob";
import { Power } from "lucide-react";
import { AiContextButton } from "./AiContextButton";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function noteLabel(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

// Cycling cell — same pattern as OscShapeCell in Synth3DPage.
function CycleCell<T extends string>({
  value, options, onChange, label, color = "text-neon-cyan",
}: { value: T; options: T[]; onChange: (v: T) => void; label: string; color?: string }) {
  const idx = options.indexOf(value);
  const next = () => onChange(options[(idx + 1) % options.length]);
  return (
    <button
      onClick={next}
      className="panel-inset rounded-lg flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95 transition-transform"
      style={{ minHeight: 56, minWidth: 56 }}
      aria-label={`${label}: ${value}`}
    >
      <span className="font-mono text-[8px] text-muted-foreground tracking-widest">{label}</span>
      <span className={cn("font-display text-[11px] font-bold tracking-wider", color)}>{value}</span>
    </button>
  );
}

export function ArpPanel() {
  const { arp, setArp, toggleArpStep, playheads, transport, addAiHistoryEntry } = useGroove();
  const currentStep = playheads.step;

  // Local UI-only params (pending engine wiring)

  // Beat-pulse: lights up one of 4 beat-dots on each quarter-note
  const beatIdx = Math.floor(currentStep / 4) % 4;
  const [pulsed, setPulsed] = useState(false);
  const prevBeat = useRef(-1);
  useEffect(() => {
    if (beatIdx !== prevBeat.current && transport.playing) {
      prevBeat.current = beatIdx;
      setPulsed(true);
      const t = setTimeout(() => setPulsed(false), 100);
      return () => clearTimeout(t);
    }
  }, [beatIdx, transport.playing]);

  const handleAiArp = async () => {
    // Randomise mode + gate pattern for a generative arp
    const modes: ArpMode[] = ARP_MODES as unknown as ArpMode[];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const gateSteps = Array.from({ length: 16 }, (_, i) =>
      i % 2 === 0 ? true : Math.random() > 0.4
    );
    setArp({ mode, gateSteps, complexity: 40 + Math.floor(Math.random() * 40) });
    addAiHistoryEntry({ action: "Generated arp pattern", module: "ARP" });
  };

  return (
    <div className="space-y-3">
      {/* ── Master enable + beat indicator ─── */}
      <div className="hw-bezel p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setArp({ enabled: !arp.enabled })}
            className={cn(
              "h-14 w-14 rounded-xl grid place-items-center shrink-0 touch-none active:scale-95 transition-transform",
              arp.enabled
                ? "bg-gradient-primary shadow-glow-primary text-primary-foreground"
                : "panel-inset text-muted-foreground",
            )}
            aria-pressed={arp.enabled}
            aria-label={arp.enabled ? "Disable arp" : "Enable arp"}
          >
            <Power className={cn("h-5 w-5", arp.enabled && "animate-pulse-neon")} />
          </button>

          <div className="flex-1 min-w-0">
            <div className={cn("font-display text-sm tracking-widest", arp.enabled ? "text-primary" : "text-muted-foreground")}>
              {arp.enabled ? "ARP ON" : "ARP OFF"} · {arp.mode}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              {[0, 1, 2, 3].map((b) => (
                <div
                  key={b}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all duration-75",
                    beatIdx === b && transport.playing
                      ? "bg-primary scale-125 shadow-glow-primary"
                      : "bg-muted-foreground/30",
                    beatIdx === b && pulsed && "opacity-100",
                  )}
                />
              ))}
              <span className="ml-2 font-mono text-[9px] text-muted-foreground">BEAT SYNC</span>
            </div>
          </div>

          <AiContextButton label="AI Arp" onAction={handleAiArp} />
        </div>
      </div>

      {/* ── 8 macro parameters ─── */}
      <div className="panel p-3">
        <div className="font-mono text-[9px] text-muted-foreground mb-2 tracking-widest">8 PARAMETERS</div>
        <div className="grid grid-cols-4 gap-2">
          {/* 1. MODE — cycling cell */}
          <CycleCell
            value={arp.mode}
            options={ARP_MODES as unknown as ArpMode[]}
            onChange={(m) => setArp({ mode: m })}
            label="MODE"
          />

          {/* 2. RATE — complexity drives note density */}
          <TactileKnob
            value={arp.complexity}
            min={0} max={100}
            onChange={(v) => setArp({ complexity: v })}
            label="RATE"
            display={`${arp.complexity}`}
            size="sm"
            color="cyan"
          />

          {/* 3. GATE — vibeControl drives gate length */}
          <TactileKnob
            value={arp.vibeControl}
            min={0} max={100}
            onChange={(v) => setArp({ vibeControl: v })}
            label="GATE"
            display={`${arp.vibeControl}`}
            size="sm"
            color="cyan"
          />

          {/* 4. OCTAVE */}
          <TactileKnob
            value={arp.octaves}
            min={1} max={4}
            onChange={(v) => setArp({ octaves: Math.round(v) })}
            label="OCTAVE"
            display={`${arp.octaves}`}
            size="sm"
            color="amber"
          />

          {/* 5. ROOT — rootNote */}
          <TactileKnob
            value={arp.rootNote}
            min={24} max={60}
            onChange={(v) => setArp({ rootNote: Math.round(v) })}
            label="ROOT"
            display={noteLabel(arp.rootNote)}
            size="sm"
            color="magenta"
          />

          {/* 6. SCALE — cycling cell */}
          <CycleCell
            value={arp.scale}
            options={ARP_SCALES as unknown as ArpScale[]}
            onChange={(s) => setArp({ scale: s })}
            label="SCALE"
            color="text-neon-magenta"
          />

          {/* 7. SWING — wired to arp.swing → generateArpEventsForStep */}
          <TactileKnob
            value={arp.swing ?? 40}
            min={0} max={100}
            onChange={(v) => setArp({ swing: v })}
            label="SWING"
            display={`${Math.round(arp.swing ?? 40)}%`}
            size="sm"
            color="lime"
          />

          {/* 8. CHANCE — wired to arp.chance → generateArpEventsForStep */}
          <TactileKnob
            value={arp.chance ?? 80}
            min={0} max={100}
            onChange={(v) => setArp({ chance: v })}
            label="CHANCE"
            display={`${Math.round(arp.chance ?? 80)}%`}
            size="sm"
            color="lime"
          />
        </div>
      </div>

      {/* ── HOLD / STATE selector ─── */}
      <div className="panel p-3">
        <div className="font-mono text-[9px] text-muted-foreground mb-2 tracking-widest">HOLD MODE</div>
        <div className="grid grid-cols-3 gap-1.5">
          {ARP_STATES.map((st: ArpState) => (
            <button
              key={st}
              onClick={() => setArp({ state: st })}
              data-active={arp.state === st}
              className={cn(
                "h-10 rounded-lg font-mono text-[10px] border border-border transition-all active:scale-95",
                arp.state === st
                  ? "text-primary neon-border bg-primary/10"
                  : "panel-inset text-muted-foreground",
              )}
            >
              {st === "Clean" ? "HOLD" : st === "Smart" ? "SMART" : "FREE"}
            </button>
          ))}
        </div>
        <div className="font-mono text-[8px] text-muted-foreground mt-1.5 leading-tight">
          HOLD: sustain notes · SMART: intelligent gate · FREE: tight chop
        </div>
      </div>

      {/* ── 16-step gate grid ─── */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[9px] text-muted-foreground tracking-widest">STEP GATE · 16</span>
          <div className="flex gap-1">
            <button
              onClick={() => setArp({ gateSteps: Array(16).fill(true) })}
              className="h-6 px-2 rounded panel-inset font-mono text-[9px] text-muted-foreground"
            >ALL</button>
            <button
              onClick={() => setArp({ gateSteps: Array(16).fill(false) })}
              className="h-6 px-2 rounded panel-inset font-mono text-[9px] text-muted-foreground"
            >CLR</button>
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {arp.gateSteps.map((on, i) => {
            const isPlaying = currentStep % 16 === i && transport.playing;
            const isAccent = i % 4 === 0;
            return (
              <button
                key={i}
                onClick={() => toggleArpStep(i)}
                data-active={on}
                data-playing={isPlaying}
                data-accent={isAccent}
                className={cn(
                  "step-cell h-10 transition-all",
                  isAccent && "border-primary/40",
                  isPlaying && "ring-1 ring-primary",
                )}
                aria-label={`Step ${i + 1} ${on ? "on" : "off"}`}
              />
            );
          })}
        </div>
      </div>

      {/* ── Target parts ─── */}
      <div className="panel p-3">
        <div className="font-mono text-[9px] text-muted-foreground mb-2">TARGET PARTS</div>
        <div className="flex flex-wrap gap-1.5">
          {useGroove.getState().parts
            .filter((p) => p.category === "bass" || p.category === "synth")
            .map((p) => {
              const on = arp.targetParts.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    const targetParts = on
                      ? arp.targetParts.filter((t) => t !== p.id)
                      : [...arp.targetParts, p.id];
                    setArp({ targetParts });
                  }}
                  data-active={on}
                  className={cn(
                    "tab-pill h-8 px-3 rounded-full font-mono text-[10px]",
                    on ? "text-primary neon-border" : "panel-inset text-muted-foreground",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
