// VibeCore 3D Synth — UI Subtab (Workflow-First).
//
// Follows the project-wide UX governance (UX_GOVERNANCE.md):
//   SOUND → OSC → FILTER → ENV → 3D → FX → SAVE
// Advanced features (unison, mod matrix, macros, performance) are collapsible.

import { useState, type ReactNode } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ensureAudio, getCtx, triggerPart } from "@/lib/audio/engine";
import { defaultSynth3D, type OscType3D, type FilterType3D, type SpatialMode3D } from "@/lib/synth3d/params";

// ── Shared UI primitives (matching SoundTab style) ────────────────────────────

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

type Step = "SOUND" | "OSC" | "FILTER" | "ENV" | "SPACE" | "FX" | "SAVE";
const STEPS: { key: Step; label: string }[] = [
  { key: "SOUND", label: "SOUND" },
  { key: "OSC", label: "OSC" },
  { key: "FILTER", label: "FILTER" },
  { key: "ENV", label: "ENV" },
  { key: "SPACE", label: "3D" },
  { key: "FX", label: "FX" },
  { key: "SAVE", label: "SAVE" },
];

const OSC_TYPES: OscType3D[] = ["sine", "saw", "square", "triangle", "noise", "wavetable"];
const FILTER_TYPES: FilterType3D[] = ["lp", "hp", "bp", "notch", "comb", "morph"];
const SPATIAL_MODES: SpatialMode3D[] = ["stereo", "ms", "binaural", "3d"];

// ── Presets ───────────────────────────────────────────────────────────────────

interface Preset { label: string; patch: Partial<ReturnType<typeof defaultSynth3D>>; }
const PRESETS: Preset[] = [
  { label: "TECHNO LEAD", patch: { osc1: { ...defaultSynth3D().osc1, type: "saw", level: 0.8 }, filter1: { ...defaultSynth3D().filter1, type: "lp", freq: 3000, q: 2 }, unison: { ...defaultSynth3D().unison, count: 3, detune: 15 } } },
  { label: "DARK PAD", patch: { osc1: { ...defaultSynth3D().osc1, type: "triangle", level: 0.6 }, osc2: { ...defaultSynth3D().osc2, type: "saw", enabled: true, level: 0.4 }, filter1: { ...defaultSynth3D().filter1, freq: 1500, q: 3 }, spatial: { ...defaultSynth3D().spatial, mode: "binaural", width: 1.5, azimuth: 30 }, ampEnv: { ...defaultSynth3D().ampEnv, attack: 0.8, release: 1.2 } } },
  { label: "INDUSTRIAL", patch: { osc1: { ...defaultSynth3D().osc1, type: "square", level: 0.9 }, filter1: { ...defaultSynth3D().filter1, type: "bp", freq: 800, q: 5 }, filterEnvAmount: 0.8, unison: { ...defaultSynth3D().unison, count: 5, detune: 40 } } },
  { label: "CINEMATIC", patch: { osc1: { ...defaultSynth3D().osc1, type: "saw", level: 0.5 }, osc2: { ...defaultSynth3D().osc2, type: "saw", enabled: true, level: 0.5, octave: 1 }, sub: { ...defaultSynth3D().sub, type: "sine", octave: -2, level: 0.6 }, spatial: { ...defaultSynth3D().spatial, mode: "3d", width: 2, azimuth: 45 }, ampEnv: { ...defaultSynth3D().ampEnv, attack: 1.5, release: 2.0 } } },
  { label: "DnB STAB", patch: { osc1: { ...defaultSynth3D().osc1, type: "saw", level: 0.9 }, filter1: { ...defaultSynth3D().filter1, freq: 4000, q: 1 }, ampEnv: { ...defaultSynth3D().ampEnv, attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.1 }, unison: { ...defaultSynth3D().unison, count: 2, detune: 8 } } },
  { label: "EXPERIMENT", patch: { osc1: { ...defaultSynth3D().osc1, type: "noise", level: 0.5 }, filter1: { ...defaultSynth3D().filter1, type: "bp", freq: 500, q: 10 }, spatial: { ...defaultSynth3D().spatial, mode: "binaural", rotation: 0.5 } } },
];

// ── Main component ─────────────────────────────────────────────────────────────

export function Synth3DSubtab() {
  const { parts, selectedPart, setSynth3D, setSend, fx } = useGroove();
  const p = parts[selectedPart];
  const s3d = p.synth3d ?? defaultSynth3D();
  const [step, setStep] = useState<Step>("SOUND");

  const set = (patch: Partial<ReturnType<typeof defaultSynth3D>>) => setSynth3D(p.id, patch);

  return (
    <div className="space-y-3">
      {/* ── Step selector ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-1">
        {STEPS.map(({ key, label }, i) => (
          <button key={key} onClick={() => setStep(key)}
            className={cn("h-9 panel-inset rounded font-mono text-[8px] flex items-center justify-center touch-none",
              step === key && "neon-border text-primary",
              i < STEPS.findIndex((s) => s.key === step) && "text-neon-cyan/50")}>
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
            <div className="grid grid-cols-3 gap-1 mb-2">
              {OSC_TYPES.slice(0, 5).map((t) => (
                <button key={t} onClick={() => set({ osc1: { ...s3d.osc1, type: t } })}
                  className={cn("h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
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
            <div className="grid grid-cols-1 gap-1.5 mt-2">
              <Knob label="PAN" value={Math.round(s3d.osc1.pan * 50)} min={-50} max={50} onChange={(v) => set({ osc1: { ...s3d.osc1, pan: v / 50 } })} />
            </div>
          </Section>

          <Section title="OSCILLATOR 2">
            <Toggle label={s3d.osc2.enabled ? "ENABLED" : "BYPASSED"} value={s3d.osc2.enabled} onChange={(v) => set({ osc2: { ...s3d.osc2, enabled: v } })} />
            {s3d.osc2.enabled && (
              <>
                <div className="grid grid-cols-3 gap-1 mb-2 mt-2">
                  {OSC_TYPES.slice(0, 5).map((t) => (
                    <button key={t} onClick={() => set({ osc2: { ...s3d.osc2, type: t } })}
                      className={cn("h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
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
            <div className="grid grid-cols-3 gap-1.5">
              {(["sine", "triangle", "square"] as OscType3D[]).map((t) => (
                <button key={t} onClick={() => set({ sub: { ...s3d.sub, type: t } })}
                  className={cn("h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
                    s3d.sub.type === t && "neon-border text-primary")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <Knob label="OCT" value={s3d.sub.octave} min={-3} max={0} step={1} onChange={(v) => set({ sub: { ...s3d.sub, octave: v } })} />
              <Knob label="LEVEL" value={Math.round(s3d.sub.level * 100)} onChange={(v) => set({ sub: { ...s3d.sub, level: v / 100 } })} suffix="%" />
              <Knob label="NOISE" value={Math.round(s3d.noise.level * 100)} onChange={(v) => set({ noise: { ...s3d.noise, level: v / 100 } })} suffix="%" />
            </div>
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
              <Knob label="Q" value={Math.round(s3d.filter1.q * 10) / 10} min={1} max={200} step={1} onChange={(v) => set({ filter1: { ...s3d.filter1, q: v / 10 } })} />
              <Knob label="ENV AMT" value={Math.round(s3d.filterEnvAmount * 100)} min={-100} max={100} onChange={(v) => set({ filterEnvAmount: v / 100 })} suffix="%" />
            </div>
          </Section>

          <Section title="FILTER 2">
            <Toggle label={s3d.filter2.enabled ? "ENABLED" : "BYPASSED"} value={s3d.filter2.enabled} onChange={(v) => set({ filter2: { ...s3d.filter2, enabled: v } })} />
            {s3d.filter2.enabled && (
              <>
                <div className="grid grid-cols-3 gap-1 mb-2 mt-2">
                  {(["lp", "hp", "bp"] as FilterType3D[]).map((t) => (
                    <button key={t} onClick={() => set({ filter2: { ...s3d.filter2, type: t } })}
                      className={cn("h-9 panel-inset rounded font-mono text-[9px] uppercase touch-none",
                        s3d.filter2.type === t && "neon-border text-primary")}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <Knob label="FREQ" value={s3d.filter2.freq} min={20} max={20000} step={10} onChange={(v) => set({ filter2: { ...s3d.filter2, freq: v } })} suffix="Hz" />
                  <Knob label="Q" value={Math.round(s3d.filter2.q * 10) / 10} min={1} max={200} step={1} onChange={(v) => set({ filter2: { ...s3d.filter2, q: v / 10 } })} />
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

          <Audition partId={p.id} />
        </div>
      )}

      {/* ── ENV: Envelope ───────────────────────────────────────────────────── */}
      {step === "ENV" && (
        <div className="space-y-3">
          <Section title="AMPLIFIER ENVELOPE" accent>
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

          <Audition partId={p.id} />
        </div>
      )}

      {/* ── 3D: Spatial ─────────────────────────────────────────────────────── */}
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
              <Knob label="WIDTH" value={Math.round(s3d.spatial.width * 50)} min={0} max={200} onChange={(v) => set({ spatial: { ...s3d.spatial, width: v / 50 } })} />
              <Knob label="AZIMUTH" value={s3d.spatial.azimuth} min={-90} max={90} step={1} onChange={(v) => set({ spatial: { ...s3d.spatial, azimuth: v } })} suffix="°" />
              <Knob label="ELEVATION" value={s3d.spatial.elevation} min={-45} max={45} step={1} onChange={(v) => set({ spatial: { ...s3d.spatial, elevation: v } })} suffix="°" />
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <Knob label="DISTANCE" value={Math.round(s3d.spatial.distance * 100)} onChange={(v) => set({ spatial: { ...s3d.spatial, distance: v / 100 } })} suffix="%" />
              <Knob label="ROTATION" value={Math.round(s3d.spatial.rotation * 100)} min={0} max={500} onChange={(v) => set({ spatial: { ...s3d.spatial, rotation: v / 100 } })} suffix="Hz" />
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
                const snap = { name: `Patch ${new Date().toLocaleTimeString().slice(0, 5)}`, params: s3d, macros: s3d.macros };
                try { localStorage.setItem(`synth3d_snap_${p.id}`, JSON.stringify(snap)); } catch { /* ignore */ }
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
          <Knob label="UNISON" value={s3d.unison.count} min={1} max={7} step={1} onChange={(v) => set({ unison: { ...s3d.unison, count: v } })} />
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
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <Knob label="POLYPHONY" value={s3d.performance.polyphony} min={1} max={32} step={1} onChange={(v) => set({ performance: { ...s3d.performance, polyphony: v } })} />
          <Knob label="GLIDE ms" value={Math.round(s3d.performance.glideTime * 1000)} min={0} max={2000} step={10} onChange={(v) => set({ performance: { ...s3d.performance, glideTime: v / 1000 } })} suffix="ms" />
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
                {["sine", "triangle", "saw", "square"].map((w) => <option key={w} value={w}>{w.toUpperCase()}</option>)}
              </select>
              <select value={lfo.syncDiv} onChange={(e) => {
                const lfos = s3d.lfos.slice(); lfos[i] = { ...lfo, syncDiv: e.target.value as typeof lfo.syncDiv }; set({ lfos });
              }} className="bg-transparent font-mono text-[9px] text-primary outline-none panel-inset rounded p-1">
                {["off", "1/16", "1/8", "1/4", "1/2", "1"].map((d) => <option key={d} value={d}>{d === "off" ? "FREE" : d}</option>)}
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
            ? "No modulation routes. Add routes via the MOD tab to connect LFOs, envelopes, velocity, macros, and more to any destination."
            : `${s3d.modRoutes.length} route(s) active`}
        </div>
      </Collapsible>
    </div>
  );
}