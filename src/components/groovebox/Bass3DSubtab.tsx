// VibeCore 3D Bass — UI Subtab (Workflow-First).
//
// Follows the project-wide UX governance (UX_GOVERNANCE.md):
//   SOUND → OSC → FILTER → DRIVE → DYN → ENV → SPACE → FX → SAVE
// Advanced features (unison, LFOs, macros, mod matrix, performance) are collapsible.
//
// All controls wire to the audio engine via setBass3D → store → trigger3DBass.
// Channel strip (volume, pan, filter, sends) is real-time via applyAllParams.
// Voice params are read at note-on; the AUDITION button triggers a note to hear changes.

import { useState, type ReactNode } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ensureAudio, getCtx, triggerPart } from "@/lib/audio/engine";
import { defaultBass3D, type BassDriveType, type Bass3DParams } from "@/lib/bass3d/params";
import type { OscType3D, FilterType3D, SpatialMode3D } from "@/lib/synth3d/params";

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Knob({ label, value, min = 0, max = 100, step = 1, onChange, suffix }: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 panel-inset rounded-md p-2">
      <div className="font-mono text-[8px] text-muted-foreground tracking-widest">{label}</div>
      <div className="font-display text-[11px] text-primary">{Math.round(value)}{suffix ?? ""}</div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-primary touch-none" />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={cn("h-9 rounded-md panel-inset font-mono text-[10px] flex items-center justify-center gap-1 touch-none",
        value && "neon-border text-primary")}>
      {label}
    </button>
  );
}

function Section({ title, children, accent }: { title: string; children: ReactNode; accent?: boolean }) {
  return (
    <div className="panel p-3">
      <div className={cn("font-display text-xs mb-2", accent && "text-primary")}>{title}</div>
      <div className="hairline mb-2" />
      {children}
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel p-3">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between font-display text-xs text-muted-foreground touch-none">
        <span>{title}</span>
        <span className="font-mono text-[10px]">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

function Audition({ partId }: { partId: number }) {
  return (
    <button
      onClick={async () => { await ensureAudio(); triggerPart(partId, getCtx()!.currentTime, { velocity: 110, semitone: 0, gateSec: 0.8 }); }}
      className="w-full h-12 rounded-md bg-gradient-primary text-primary-foreground font-display text-[11px] tracking-widest touch-none"
    >
      ▶ AUDITION
    </button>
  );
}

// ── Workflow steps ───────────────────────────────────────────────────────────

type Step = "SOUND" | "OSC" | "FILTER" | "DRIVE" | "DYN" | "ENV" | "SPACE" | "FX" | "SAVE";
const STEPS: { key: Step; label: string }[] = [
  { key: "SOUND", label: "SOUND" },
  { key: "OSC", label: "OSC" },
  { key: "FILTER", label: "FILTER" },
  { key: "DRIVE", label: "DRIVE" },
  { key: "DYN", label: "DYN" },
  { key: "ENV", label: "ENV" },
  { key: "SPACE", label: "3D" },
  { key: "FX", label: "FX" },
  { key: "SAVE", label: "SAVE" },
];

const OSC_TYPES: OscType3D[] = ["sine", "saw", "square", "triangle", "noise"];
const FILTER_TYPES: FilterType3D[] = ["lp", "hp", "bp", "notch", "comb", "morph"];
const SPATIAL_MODES: SpatialMode3D[] = ["stereo", "ms", "binaural", "3d"];
const DRIVE_TYPES: BassDriveType[] = ["saturation", "tube", "tape", "softclip", "foldback", "drive"];
const DRIVE_LABELS: Record<BassDriveType, string> = {
  saturation: "SAT", tube: "TUBE", tape: "TAPE", softclip: "SOFT", foldback: "FOLD", drive: "DRIVE",
};
const NOISE_TYPES = ["white", "pink", "brown"] as const;
const ENV_TYPES = ["adsr", "ahdsr"] as const;
const LFO_WAVES = ["sine", "triangle", "saw", "square"] as const;
const LFO_SYNCS = ["off", "1/16", "1/8", "1/4", "1/2", "1"] as const;

// ── Presets ───────────────────────────────────────────────────────────────────

interface Preset { label: string; patch: Partial<Bass3DParams>; }
const PRESETS: Preset[] = [
  { label: "TECHNO", patch: {
    osc1: { ...defaultBass3D().osc1, type: "saw", level: 0.7 },
    sub: { ...defaultBass3D().sub, type: "sine", octave: -1, level: 0.6 },
    filter1: { ...defaultBass3D().filter1, type: "lp", freq: 800, q: 2 },
    drive: { ...defaultBass3D().drive, type: "saturation", amount: 0.3, bassStable: true },
    spatial: { ...defaultBass3D().spatial, monoCrossover: 120, monoEnabled: true },
    unison: { ...defaultBass3D().unison, count: 3, detune: 12 },
  }},
  { label: "ACID", patch: {
    osc1: { ...defaultBass3D().osc1, type: "saw", level: 0.8 },
    sub: { ...defaultBass3D().sub, enabled: false },
    filter1: { ...defaultBass3D().filter1, type: "bp", freq: 1000, q: 8 },
    acidResonance: 0.7, bassCompensation: 0.3,
    drive: { ...defaultBass3D().drive, type: "tube", amount: 0.5, bassStable: false },
    filterEnvAmount: 0.9,
  }},
  { label: "SUB", patch: {
    osc1: { ...defaultBass3D().osc1, enabled: false },
    sub: { ...defaultBass3D().sub, type: "sine", octave: -1, level: 0.9 },
    filter1: { ...defaultBass3D().filter1, type: "lp", freq: 200, q: 1 },
    drive: { ...defaultBass3D().drive, enabled: false },
    spatial: { ...defaultBass3D().spatial, monoCrossover: 200, monoEnabled: true },
    unison: { ...defaultBass3D().unison, count: 1, enabled: false },
  }},
  { label: "REESE", patch: {
    osc1: { ...defaultBass3D().osc1, type: "saw", level: 0.6 },
    osc2: { ...defaultBass3D().osc2, type: "saw", enabled: true, level: 0.5, fine: 8 },
    filter1: { ...defaultBass3D().filter1, type: "lp", freq: 1200, q: 3 },
    drive: { ...defaultBass3D().drive, type: "tape", amount: 0.4 },
    spatial: { ...defaultBass3D().spatial, mode: "stereo", width: 1.8, monoEnabled: true },
    unison: { ...defaultBass3D().unison, count: 5, detune: 20, enabled: true },
  }},
  { label: "HARD", patch: {
    osc1: { ...defaultBass3D().osc1, type: "square", level: 0.8 },
    sub: { ...defaultBass3D().sub, type: "sine", octave: -1, level: 0.7 },
    filter1: { ...defaultBass3D().filter1, type: "lp", freq: 500, q: 4 },
    drive: { ...defaultBass3D().drive, type: "foldback", amount: 0.6, bassStable: true },
    dynamics: { ...defaultBass3D().dynamics,
      bassPunch: { ...defaultBass3D().dynamics.bassPunch, amount: 0.6, enabled: true },
      compressor: { ...defaultBass3D().dynamics.compressor, threshold: -30, ratio: 6 },
    },
  }},
  { label: "WOBBLE", patch: {
    osc1: { ...defaultBass3D().osc1, type: "saw", level: 0.7 },
    filter1: { ...defaultBass3D().filter1, type: "lp", freq: 600, q: 10 },
    filterEnvAmount: 0.9,
    lfos: [ ...defaultBass3D().lfos,
      { ...defaultBass3D().lfos[0], waveform: "sine", rate: 2, depth: 1, syncDiv: "1/4", enabled: true },
    ],
    spatial: { ...defaultBass3D().spatial, mode: "stereo", width: 1.5, monoEnabled: true },
  }},
];

// ── Main component ─────────────────────────────────────────────────────────────

export function Bass3DSubtab() {
  const { parts, selectedPart, setBass3D, setSend, fx } = useGroove();
  const p = parts[selectedPart];
  const s3d = p.bass3d ?? defaultBass3D();
  const [step, setStep] = useState<Step>("SOUND");

  const set = (patch: Partial<Bass3DParams>) => setBass3D(p.id, patch);

  return (
    <div className="space-y-3">
      {/* ── Step selector ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-9 gap-1">
        {STEPS.map(({ key, label }) => (
          <button key={key} onClick={() => setStep(key)}
            className={cn("h-9 panel-inset rounded font-mono text-[8px] flex items-center justify-center touch-none",
              step === key && "neon-border text-primary")}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SOUND: Preset selection ───────────────────────────────────────── */}
      {step === "SOUND" && (
        <div className="space-y-3">
          <Section title="PRESETS" accent>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((pr) => (
                <button key={pr.label} onClick={() => set(pr.patch)}
                  className="h-12 panel-inset rounded font-display text-[10px] text-primary active:bg-primary/20 touch-none">
                  {pr.label}
                </button>
              ))}
            </div>
          </Section>
          <Audition partId={p.id} />
        </div>
      )}

      {/* ── OSC: Oscillator settings ───────────────────────────────────────── */}
      {step === "OSC" && (
        <div className="space-y-3">
          <Section title="OSCILLATOR 1" accent>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {OSC_TYPES.map((t) => (
                <button key={t} onClick={() => set({ osc1: { ...s3d.osc1, type: t } })}
                  className={cn("h-9 panel-inset rounded font-mono text-[8px] uppercase touch-none",
                    s3d.osc1.type === t && "neon-border text-primary")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Knob label="OCT" value={s3d.osc1.octave} min={-3} max={3} step={1} onChange={(v) => set({ osc1: { ...s3d.osc1, octave: v } })} />
              <Knob label="SEMI" value={s3d.osc1.semitone} min={-12} max={12} step={1} onChange={(v) => set({ osc1: { ...s3d.osc1, semitone: v } })} />
              <Knob label="FINE" value={s3d.osc1.fine} min={-50} max={50} onChange={(v) => set({ osc1: { ...s3d.osc1, fine: v } })} suffix="c" />
              <Knob label="LEVEL" value={Math.round(s3d.osc1.level * 100)} onChange={(v) => set({ osc1: { ...s3d.osc1, level: v / 100 } })} suffix="%" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <Knob label="PAN" value={Math.round(s3d.osc1.pan * 50)} min={-50} max={50} onChange={(v) => set({ osc1: { ...s3d.osc1, pan: v / 50 } })} />
              <Toggle label={`OSC1 ${s3d.osc1.enabled ? "ON" : "OFF"}`} value={s3d.osc1.enabled} onChange={(v) => set({ osc1: { ...s3d.osc1, enabled: v } })} />
            </div>
          </Section>

          <Section title="OSCILLATOR 2">
            <Toggle label={s3d.osc2.enabled ? "ENABLED" : "BYPASSED"} value={s3d.osc2.enabled} onChange={(v) => set({ osc2: { ...s3d.osc2, enabled: v } })} />
            {s3d.osc2.enabled && (
              <>
                <div className="grid grid-cols-5 gap-1 mb-2 mt-2">
                  {OSC_TYPES.map((t) => (
                    <button key={t} onClick={() => set({ osc2: { ...s3d.osc2, type: t } })}
                      className={cn("h-9 panel-inset rounded font-mono text-[8px] uppercase touch-none",
                        s3d.osc2.type === t && "neon-border text-primary")}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <Knob label="OCT" value={s3d.osc2.octave} min={-3} max={3} step={1} onChange={(v) => set({ osc2: { ...s3d.osc2, octave: v } })} />
                  <Knob label="SEMI" value={s3d.osc2.semitone} min={-12} max={12} step={1} onChange={(v) => set({ osc2: { ...s3d.osc2, semitone: v } })} />
                  <Knob label="FINE" value={s3d.osc2.fine} min={-50} max={50} onChange={(v) => set({ osc2: { ...s3d.osc2, fine: v } })} suffix="c" />
                  <Knob label="LEVEL" value={Math.round(s3d.osc2.level * 100)} onChange={(v) => set({ osc2: { ...s3d.osc2, level: v / 100 } })} suffix="%" />
                </div>
              </>
            )}
          </Section>

          <Section title="SUB OSCILLATOR">
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {(["sine", "triangle", "square"] as OscType3D[]).map((t) => (
                <button key={t} onClick={() => set({ sub: { ...s3d.sub, type: t } })}
                  className={cn("h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
                    s3d.sub.type === t && "neon-border text-primary")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob label="OCT" value={s3d.sub.octave} min={-3} max={0} step={1} onChange={(v) => set({ sub: { ...s3d.sub, octave: v } })} />
              <Knob label="LEVEL" value={Math.round(s3d.sub.level * 100)} onChange={(v) => set({ sub: { ...s3d.sub, level: v / 100 } })} suffix="%" />
              <Knob label="PAN" value={Math.round(s3d.sub.pan * 50)} min={-50} max={50} onChange={(v) => set({ sub: { ...s3d.sub, pan: v / 50 } })} />
            </div>
          </Section>

          <Section title="NOISE">
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {NOISE_TYPES.map((t) => (
                <button key={t} onClick={() => set({ noise: { ...s3d.noise, type: t } })}
                  className={cn("h-9 panel-inset rounded font-mono text-[8px] uppercase touch-none",
                    s3d.noise.type === t && "neon-border text-primary")}>
                  {t}
                </button>
              ))}
            </div>
            <Knob label="NOISE LEVEL" value={Math.round(s3d.noise.level * 100)} onChange={(v) => set({ noise: { ...s3d.noise, level: v / 100 } })} suffix="%" />
          </Section>

          <Audition partId={p.id} />
        </div>
      )}

      {/* ── FILTER ─────────────────────────────────────────────────────────── */}
      {step === "FILTER" && (
        <div className="space-y-3">
          <Section title="FILTER 1" accent>
            <div className="grid grid-cols-6 gap-1 mb-2">
              {FILTER_TYPES.map((t) => (
                <button key={t} onClick={() => set({ filter1: { ...s3d.filter1, type: t } })}
                  className={cn("h-9 panel-inset rounded font-mono text-[8px] uppercase touch-none",
                    s3d.filter1.type === t && "neon-border text-primary")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob label="FREQ" value={s3d.filter1.freq} min={20} max={20000} step={10} onChange={(v) => set({ filter1: { ...s3d.filter1, freq: v } })} suffix="Hz" />
              <Knob label="Q" value={s3d.filter1.q} min={0.1} max={20} step={0.1} onChange={(v) => set({ filter1: { ...s3d.filter1, q: v } })} />
              <Knob label="ENV AMT" value={Math.round(s3d.filterEnvAmount * 100)} min={-100} max={100} onChange={(v) => set({ filterEnvAmount: v / 100 })} suffix="%" />
            </div>
          </Section>

          <Section title="FILTER 2">
            <Toggle label={s3d.filter2.enabled ? "ENABLED" : "BYPASSED"} value={s3d.filter2.enabled} onChange={(v) => set({ filter2: { ...s3d.filter2, enabled: v } })} />
            {s3d.filter2.enabled && (
              <>
                <div className="grid grid-cols-4 gap-1 mb-2 mt-2">
                  {(["lp", "hp", "bp", "notch"] as FilterType3D[]).map((t) => (
                    <button key={t} onClick={() => set({ filter2: { ...s3d.filter2, type: t } })}
                      className={cn("h-9 panel-inset rounded font-mono text-[8px] uppercase touch-none",
                        s3d.filter2.type === t && "neon-border text-primary")}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <Knob label="FREQ" value={s3d.filter2.freq} min={20} max={20000} step={10} onChange={(v) => set({ filter2: { ...s3d.filter2, freq: v } })} suffix="Hz" />
                  <Knob label="Q" value={s3d.filter2.q} min={0.1} max={20} step={0.1} onChange={(v) => set({ filter2: { ...s3d.filter2, q: v } })} />
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {(["serial", "parallel"] as const).map((r) => (
                    <button key={r} onClick={() => set({ filterRouting: r })}
                      className={cn("h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
                        s3d.filterRouting === r && "neon-border text-primary")}>
                      {r}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section title="BASS CHARACTER">
            <div className="grid grid-cols-2 gap-1.5">
              <Knob label="ACID RESO" value={Math.round(s3d.acidResonance * 100)} onChange={(v) => set({ acidResonance: v / 100 })} suffix="%" />
              <Knob label="BASS COMP" value={Math.round(s3d.bassCompensation * 100)} onChange={(v) => set({ bassCompensation: v / 100 })} suffix="%" />
            </div>
          </Section>

          <Audition partId={p.id} />
        </div>
      )}

      {/* ── DRIVE ──────────────────────────────────────────────────────────── */}
      {step === "DRIVE" && (
        <div className="space-y-3">
          <Section title="DRIVE" accent>
            <Toggle label={s3d.drive.enabled ? "ENABLED" : "BYPASSED"} value={s3d.drive.enabled} onChange={(v) => set({ drive: { ...s3d.drive, enabled: v } })} />
            {s3d.drive.enabled && (
              <>
                <div className="grid grid-cols-6 gap-1 mb-2 mt-2">
                  {DRIVE_TYPES.map((t) => (
                    <button key={t} onClick={() => set({ drive: { ...s3d.drive, type: t } })}
                      className={cn("h-9 panel-inset rounded font-mono text-[8px] touch-none",
                        s3d.drive.type === t && "neon-border text-primary")}>
                      {DRIVE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Knob label="AMOUNT" value={Math.round(s3d.drive.amount * 100)} max={200} onChange={(v) => set({ drive: { ...s3d.drive, amount: v / 100 } })} suffix="%" />
                  <Knob label="PRE GAIN" value={s3d.drive.preGain} min={-12} max={24} onChange={(v) => set({ drive: { ...s3d.drive, preGain: v } })} suffix="dB" />
                  <Knob label="POST GAIN" value={s3d.drive.postGain} min={-24} max={12} onChange={(v) => set({ drive: { ...s3d.drive, postGain: v } })} suffix="dB" />
                </div>
                <div className="mt-2">
                  <Toggle label={`BASS STABLE ${s3d.drive.bassStable ? "ON" : "OFF"}`} value={s3d.drive.bassStable} onChange={(v) => set({ drive: { ...s3d.drive, bassStable: v } })} />
                </div>
              </>
            )}
          </Section>
          <Audition partId={p.id} />
        </div>
      )}

      {/* ── DYN: Dynamics ───────────────────────────────────────────────────── */}
      {step === "DYN" && (
        <div className="space-y-3">
          <Section title="COMPRESSOR" accent>
            <Toggle label={s3d.dynamics.compressor.enabled ? "ENABLED" : "BYPASSED"} value={s3d.dynamics.compressor.enabled}
              onChange={(v) => set({ dynamics: { ...s3d.dynamics, compressor: { ...s3d.dynamics.compressor, enabled: v } } })} />
            {s3d.dynamics.compressor.enabled && (
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                <Knob label="THRESH" value={s3d.dynamics.compressor.threshold} min={-100} max={0} onChange={(v) => set({ dynamics: { ...s3d.dynamics, compressor: { ...s3d.dynamics.compressor, threshold: v } } })} suffix="dB" />
                <Knob label="RATIO" value={s3d.dynamics.compressor.ratio} min={1} max={20} step={0.5} onChange={(v) => set({ dynamics: { ...s3d.dynamics, compressor: { ...s3d.dynamics.compressor, ratio: v } } })} />
                <Knob label="ATTACK" value={Math.round(s3d.dynamics.compressor.attack * 1000)} min={1} max={100} onChange={(v) => set({ dynamics: { ...s3d.dynamics, compressor: { ...s3d.dynamics.compressor, attack: v / 1000 } } })} suffix="ms" />
                <Knob label="RELEASE" value={Math.round(s3d.dynamics.compressor.release * 1000)} min={10} max={600} onChange={(v) => set({ dynamics: { ...s3d.dynamics, compressor: { ...s3d.dynamics.compressor, release: v / 1000 } } })} suffix="ms" />
                <Knob label="MAKEUP" value={s3d.dynamics.compressor.makeup} min={0} max={24} onChange={(v) => set({ dynamics: { ...s3d.dynamics, compressor: { ...s3d.dynamics.compressor, makeup: v } } })} suffix="dB" />
              </div>
            )}
          </Section>

          <Section title="LIMITER">
            <Toggle label={s3d.dynamics.limiter.enabled ? "ENABLED" : "BYPASSED"} value={s3d.dynamics.limiter.enabled}
              onChange={(v) => set({ dynamics: { ...s3d.dynamics, limiter: { ...s3d.dynamics.limiter, enabled: v } } })} />
            {s3d.dynamics.limiter.enabled && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <Knob label="THRESH" value={s3d.dynamics.limiter.threshold} min={-24} max={0} onChange={(v) => set({ dynamics: { ...s3d.dynamics, limiter: { ...s3d.dynamics.limiter, threshold: v } } })} suffix="dB" />
                <Knob label="RELEASE" value={Math.round(s3d.dynamics.limiter.release * 1000)} min={10} max={300} onChange={(v) => set({ dynamics: { ...s3d.dynamics, limiter: { ...s3d.dynamics.limiter, release: v / 1000 } } })} suffix="ms" />
              </div>
            )}
          </Section>

          <Section title="BASS PUNCH">
            <Toggle label={s3d.dynamics.bassPunch.enabled ? "ENABLED" : "BYPASSED"} value={s3d.dynamics.bassPunch.enabled}
              onChange={(v) => set({ dynamics: { ...s3d.dynamics, bassPunch: { ...s3d.dynamics.bassPunch, enabled: v } } })} />
            {s3d.dynamics.bassPunch.enabled && (
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <Knob label="AMOUNT" value={Math.round(s3d.dynamics.bassPunch.amount * 100)} onChange={(v) => set({ dynamics: { ...s3d.dynamics, bassPunch: { ...s3d.dynamics.bassPunch, amount: v / 100 } } })} suffix="%" />
                <Knob label="ATTACK" value={Math.round(s3d.dynamics.bassPunch.attack * 1000)} min={1} max={50} onChange={(v) => set({ dynamics: { ...s3d.dynamics, bassPunch: { ...s3d.dynamics.bassPunch, attack: v / 1000 } } })} suffix="ms" />
                <Knob label="RELEASE" value={Math.round(s3d.dynamics.bassPunch.release * 1000)} min={10} max={500} onChange={(v) => set({ dynamics: { ...s3d.dynamics, bassPunch: { ...s3d.dynamics.bassPunch, release: v / 1000 } } })} suffix="ms" />
              </div>
            )}
          </Section>

          <Audition partId={p.id} />
        </div>
      )}

      {/* ── ENV: Envelopes ──────────────────────────────────────────────────── */}
      {step === "ENV" && (
        <div className="space-y-3">
          <Section title="AMPLIFIER ENVELOPE" accent>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {ENV_TYPES.map((t) => (
                <button key={t} onClick={() => set({ ampEnv: { ...s3d.ampEnv, type: t } })}
                  className={cn("h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
                    s3d.ampEnv.type === t && "neon-border text-primary")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <Knob label="ATTACK" value={Math.round(s3d.ampEnv.attack * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ ampEnv: { ...s3d.ampEnv, attack: v / 1000 } })} suffix="ms" />
              <Knob label="DECAY" value={Math.round(s3d.ampEnv.decay * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ ampEnv: { ...s3d.ampEnv, decay: v / 1000 } })} suffix="ms" />
              <Knob label="SUSTAIN" value={Math.round(s3d.ampEnv.sustain * 100)} onChange={(v) => set({ ampEnv: { ...s3d.ampEnv, sustain: v / 100 } })} suffix="%" />
              <Knob label="RELEASE" value={Math.round(s3d.ampEnv.release * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ ampEnv: { ...s3d.ampEnv, release: v / 1000 } })} suffix="ms" />
            </div>
          </Section>

          <Section title="FILTER ENVELOPE">
            <div className="grid grid-cols-4 gap-1.5">
              <Knob label="ATTACK" value={Math.round(s3d.filterEnv.attack * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ filterEnv: { ...s3d.filterEnv, attack: v / 1000 } })} suffix="ms" />
              <Knob label="DECAY" value={Math.round(s3d.filterEnv.decay * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ filterEnv: { ...s3d.filterEnv, decay: v / 1000 } })} suffix="ms" />
              <Knob label="SUSTAIN" value={Math.round(s3d.filterEnv.sustain * 100)} onChange={(v) => set({ filterEnv: { ...s3d.filterEnv, sustain: v / 100 } })} suffix="%" />
              <Knob label="RELEASE" value={Math.round(s3d.filterEnv.release * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ filterEnv: { ...s3d.filterEnv, release: v / 1000 } })} suffix="ms" />
            </div>
          </Section>

          <Section title="MOD ENVELOPE">
            <div className="grid grid-cols-4 gap-1.5">
              <Knob label="ATTACK" value={Math.round(s3d.modEnv.attack * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ modEnv: { ...s3d.modEnv, attack: v / 1000 } })} suffix="ms" />
              <Knob label="DECAY" value={Math.round(s3d.modEnv.decay * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ modEnv: { ...s3d.modEnv, decay: v / 1000 } })} suffix="ms" />
              <Knob label="SUSTAIN" value={Math.round(s3d.modEnv.sustain * 100)} onChange={(v) => set({ modEnv: { ...s3d.modEnv, sustain: v / 100 } })} suffix="%" />
              <Knob label="RELEASE" value={Math.round(s3d.modEnv.release * 1000)} min={1} max={10000} step={1} onChange={(v) => set({ modEnv: { ...s3d.modEnv, release: v / 1000 } })} suffix="ms" />
            </div>
          </Section>

          <Audition partId={p.id} />
        </div>
      )}

      {/* ── SPACE: Spatial + Mono Compat ────────────────────────────────────── */}
      {step === "SPACE" && (
        <div className="space-y-3">
          <Section title="3D SPATIAL" accent>
            <div className="grid grid-cols-4 gap-1 mb-2">
              {SPATIAL_MODES.map((m) => (
                <button key={m} onClick={() => set({ spatial: { ...s3d.spatial, mode: m } })}
                  className={cn("h-10 panel-inset rounded font-display text-[10px] uppercase touch-none",
                    s3d.spatial.mode === m && "neon-border text-primary")}>
                  {m}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob label="WIDTH" value={Math.round(s3d.spatial.width * 50)} min={0} max={200} onChange={(v) => set({ spatial: { ...s3d.spatial, width: v / 50 } })} suffix="%" />
              <Knob label="AZIMUTH" value={s3d.spatial.azimuth} min={-90} max={90} step={1} onChange={(v) => set({ spatial: { ...s3d.spatial, azimuth: v } })} suffix="°" />
              <Knob label="ELEVATION" value={s3d.spatial.elevation} min={-45} max={45} step={1} onChange={(v) => set({ spatial: { ...s3d.spatial, elevation: v } })} suffix="°" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <Knob label="DISTANCE" value={Math.round(s3d.spatial.distance * 100)} onChange={(v) => set({ spatial: { ...s3d.spatial, distance: v / 100 } })} suffix="%" />
              <Knob label="ROTATION" value={Math.round(s3d.spatial.rotation * 100)} min={0} max={500} onChange={(v) => set({ spatial: { ...s3d.spatial, rotation: v / 100 } })} suffix="Hz" />
            </div>
          </Section>

          <Section title="MONO COMPAT (Sub Protection)">
            <Toggle label={`MONO SPLIT ${s3d.spatial.monoEnabled ? "ON" : "OFF"}`} value={s3d.spatial.monoEnabled}
              onChange={(v) => set({ spatial: { ...s3d.spatial, monoEnabled: v } })} />
            {s3d.spatial.monoEnabled && (
              <div className="mt-2">
                <Knob label="CROSSOVER" value={s3d.spatial.monoCrossover} min={20} max={500} step={5} onChange={(v) => set({ spatial: { ...s3d.spatial, monoCrossover: v } })} suffix="Hz" />
              </div>
            )}
            <div className="font-mono text-[9px] text-muted-foreground mt-2">
              Sub below crossover is summed to mono and bypasses spatial processing.
            </div>
          </Section>

          <Audition partId={p.id} />
        </div>
      )}

      {/* ── FX: Sends ────────────────────────────────────────────────────────── */}
      {step === "FX" && (
        <div className="space-y-3">
          <Section title="FX SENDS" accent>
            <div className="grid grid-cols-3 gap-1.5">
              {fx.map((f, i) => (
                <div key={i} className="panel-inset rounded p-2">
                  <div className="font-mono text-[8px] text-muted-foreground">SEND {f.slot}</div>
                  <div className="font-display text-[9px] truncate">{f.type ?? "—"}</div>
                  <input type="range" min={0} max={100} value={p.sends[i]}
                    onChange={(e) => setSend(p.id, i, Number(e.target.value))}
                    className="w-full mt-1 accent-primary touch-none" />
                  <div className="font-mono text-[9px] text-primary text-right">{p.sends[i]}</div>
                </div>
              ))}
            </div>
          </Section>
          <Audition partId={p.id} />
        </div>
      )}

      {/* ── SAVE: Snapshot ───────────────────────────────────────────────────── */}
      {step === "SAVE" && (
        <div className="space-y-3">
          <Section title="SNAPSHOT" accent>
            <div className="font-mono text-[10px] text-muted-foreground mb-2">
              Save the current patch (all parameters including macros) as a named snapshot.
            </div>
            <button
              onClick={() => {
                const snap = { name: `Bass ${new Date().toLocaleTimeString().slice(0, 5)}`, params: s3d };
                try { localStorage.setItem(`bass3d_snap_${p.id}`, JSON.stringify(snap)); } catch { /* ignore */ }
              }}
              className="w-full h-11 rounded-md bg-gradient-primary text-primary-foreground font-display text-[11px] tracking-widest touch-none">
              💾 SAVE SNAPSHOT
            </button>
          </Section>
          <Audition partId={p.id} />
        </div>
      )}

      {/* ── Advanced (collapsible) ───────────────────────────────────────────── */}
      <Collapsible title="UNISON & PERFORMANCE">
        <div className="grid grid-cols-4 gap-1.5">
          <Knob label="UNISON" value={s3d.unison.count} min={1} max={5} step={1} onChange={(v) => set({ unison: { ...s3d.unison, count: v } })} />
          <Knob label="DETUNE" value={s3d.unison.detune} min={0} max={100} onChange={(v) => set({ unison: { ...s3d.unison, detune: v } })} suffix="c" />
          <Knob label="SPREAD" value={Math.round(s3d.unison.spread * 100)} onChange={(v) => set({ unison: { ...s3d.unison, spread: v / 100 } })} suffix="%" />
          <Knob label="DRIFT" value={Math.round(s3d.unison.drift * 100)} onChange={(v) => set({ unison: { ...s3d.unison, drift: v / 100 } })} suffix="Hz" />
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <Toggle label={`PHASE RND ${s3d.unison.phaseRandom ? "ON" : "OFF"}`} value={s3d.unison.phaseRandom} onChange={(v) => set({ unison: { ...s3d.unison, phaseRandom: v } })} />
          <Toggle label={`UNISON ${s3d.unison.enabled ? "ON" : "OFF"}`} value={s3d.unison.enabled} onChange={(v) => set({ unison: { ...s3d.unison, enabled: v } })} />
          <div className="panel-inset rounded p-2 flex items-center justify-between">
            <span className="font-mono text-[8px] text-muted-foreground">MODE</span>
            <select value={s3d.performance.mode}
              onChange={(e) => set({ performance: { ...s3d.performance, mode: e.target.value as typeof s3d.performance.mode } })}
              className="bg-transparent font-mono text-[10px] text-primary outline-none">
              <option value="poly">POLY</option>
              <option value="mono">MONO</option>
              <option value="legato">LEGATO</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <Knob label="POLYPHONY" value={s3d.performance.polyphony} min={1} max={32} step={1} onChange={(v) => set({ performance: { ...s3d.performance, polyphony: v } })} />
          <Knob label="GLIDE ms" value={Math.round(s3d.performance.glideTime * 1000)} min={0} max={2000} step={10} onChange={(v) => set({ performance: { ...s3d.performance, glideTime: v / 1000 } })} suffix="ms" />
          <div className="panel-inset rounded p-2 flex items-center justify-between">
            <span className="font-mono text-[8px] text-muted-foreground">GLIDE</span>
            <select value={s3d.performance.glideMode}
              onChange={(e) => set({ performance: { ...s3d.performance, glideMode: e.target.value as typeof s3d.performance.glideMode } })}
              className="bg-transparent font-mono text-[10px] text-primary outline-none">
              <option value="off">OFF</option>
              <option value="auto">AUTO</option>
            </select>
          </div>
        </div>
      </Collapsible>

      <Collapsible title="LFOS (4)">
        {s3d.lfos.map((lfo, i) => (
          <div key={i} className="panel-inset rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[8px] text-muted-foreground">LFO {i + 1}</span>
              <Toggle label={lfo.enabled ? "ON" : "OFF"} value={lfo.enabled} onChange={(v) => {
                const lfos = s3d.lfos.slice(); lfos[i] = { ...lfo, enabled: v }; set({ lfos });
              }} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob label="RATE" value={lfo.rate} min={0.01} max={20} step={0.01} onChange={(v) => {
                const lfos = s3d.lfos.slice(); lfos[i] = { ...lfo, rate: v }; set({ lfos });
              }} suffix="Hz" />
              <Knob label="DEPTH" value={Math.round(lfo.depth * 100)} onChange={(v) => {
                const lfos = s3d.lfos.slice(); lfos[i] = { ...lfo, depth: v / 100 }; set({ lfos });
              }} suffix="%" />
              <Knob label="PHASE" value={Math.round(lfo.phase * 100)} onChange={(v) => {
                const lfos = s3d.lfos.slice(); lfos[i] = { ...lfo, phase: v / 100 }; set({ lfos });
              }} suffix="%" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <select value={lfo.waveform} onChange={(e) => {
                const lfos = s3d.lfos.slice(); lfos[i] = { ...lfo, waveform: e.target.value as typeof lfo.waveform }; set({ lfos });
              }} className="bg-transparent font-mono text-[9px] text-primary outline-none panel-inset rounded p-1">
                {LFO_WAVES.map((w) => <option key={w} value={w}>{w.toUpperCase()}</option>)}
              </select>
              <select value={lfo.syncDiv} onChange={(e) => {
                const lfos = s3d.lfos.slice(); lfos[i] = { ...lfo, syncDiv: e.target.value as typeof lfo.syncDiv }; set({ lfos });
              }} className="bg-transparent font-mono text-[9px] text-primary outline-none panel-inset rounded p-1">
                {LFO_SYNCS.map((d) => <option key={d} value={d}>{d === "off" ? "FREE" : d}</option>)}
              </select>
            </div>
          </div>
        ))}
      </Collapsible>

      <Collapsible title="MACROS (8)">
        <div className="grid grid-cols-4 gap-1.5">
          {s3d.macros.map((m, i) => (
            <div key={i} className="panel-inset rounded p-2">
              <div className="font-mono text-[8px] text-muted-foreground">MACRO {i + 1}</div>
              <input type="range" min={0} max={100} value={Math.round(m.value * 100)}
                onChange={(e) => {
                  const macros = s3d.macros.slice();
                  macros[i] = { ...m, value: Number(e.target.value) / 100 };
                  set({ macros });
                }}
                className="w-full mt-1 accent-primary touch-none" />
              <div className="font-mono text-[9px] text-primary text-right">{Math.round(m.value * 100)}</div>
              {m.cc != null && <div className="font-mono text-[7px] text-muted-foreground">CC{m.cc}</div>}
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="MODULATION MATRIX">
        <div className="font-mono text-[10px] text-muted-foreground">
          {s3d.modRoutes.length === 0
            ? "No modulation routes. Add routes via the MOD tab to connect LFOs, envelopes, velocity, macros, and more to any destination — including bass-specific targets (drive amount, comp threshold, bass punch, mono crossover, acid resonance)."
            : `${s3d.modRoutes.length} route(s) active`}
        </div>
      </Collapsible>
    </div>
  );
}