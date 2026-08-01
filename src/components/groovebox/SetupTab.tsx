// Sprint 6A — Setup Center
// Audio · MIDI · VibeSync · Performance · Graphics · Mobile · Debug · System Info

import { useEffect, useState } from "react";
import {
  Settings, Mic, Speaker, Music, Activity, Cpu, Sparkles, Smartphone, Bug, Info,
  RotateCw, Gauge, Power,
} from "lucide-react";
import {
  useSetup, estimateLatencyMs,
  type SampleRate, type BufferSize, type SyncSource, type CpuMode,
  type ParticleLevel, type AtmoQuality, type LandscapeMode,
} from "@/lib/setup/setupStore";
import { listAudioDevices, listMidiDevices, type AudioDeviceInfo, type MidiDeviceInfo } from "@/lib/setup/devices";
import { runLatencyTest } from "@/lib/setup/latencyTest";
import { runClockTest } from "@/lib/setup/clockTest";
import { getCtx, restartAudio } from "@/lib/audio/engine";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SetupTab() {
  const s = useSetup();
  const groove = useGroove();
  const [audioDevs, setAudioDevs] = useState<AudioDeviceInfo[]>([]);
  const [midi, setMidi] = useState<{ inputs: MidiDeviceInfo[]; outputs: MidiDeviceInfo[] }>({ inputs: [], outputs: [] });
  const [busyLat, setBusyLat] = useState(false);
  const [busyClk, setBusyClk] = useState(false);
  const [busyRestart, setBusyRestart] = useState(false);
  const [restartMsg, setRestartMsg] = useState<string | null>(null);

  const refreshAudio = async () => setAudioDevs(await listAudioDevices());
  const refreshMidi = async () => setMidi(await listMidiDevices());

  useEffect(() => { refreshAudio(); refreshMidi(); }, []);

  const outputs = audioDevs.filter((d) => d.kind === "output");
  const inputs = audioDevs.filter((d) => d.kind === "input");

  const ctx = getCtx();
  const liveSr = ctx?.sampleRate ?? s.sampleRate;
  const estLat = estimateLatencyMs(s.bufferSize, s.sampleRate);

  const onLat = async () => {
    setBusyLat(true);
    try { s.setLatency(await runLatencyTest()); } finally { setBusyLat(false); }
  };
  const onClk = async () => {
    setBusyClk(true);
    try { s.setClock(await runClockTest()); } finally { setBusyClk(false); }
  };

  return (
    <div className="space-y-3 pb-2">
      <Header icon={Settings} title="SETUP CENTER" subtitle="Audio · MIDI · Sync · Performance" />

      {/* AUDIO */}
      <Section icon={Speaker} title="AUDIO SETUP">
        <Field label="Audio Output">
          <Select
            value={s.audioOutputId}
            onChange={(v) => s.set("audioOutputId", v)}
            options={[{ value: "default", label: "Default Output" }, ...outputs.map((d) => ({ value: d.id, label: d.label }))]}
          />
        </Field>
        <Field label="Input Device">
          <Select
            value={s.audioInputId}
            onChange={(v) => s.set("audioInputId", v)}
            options={[{ value: "default", label: "Default Input" }, ...inputs.map((d) => ({ value: d.id, label: d.label }))]}
          />
        </Field>
        <ButtonRow>
          <Btn icon={RotateCw} label="RESCAN DEVICES" onClick={refreshAudio} />
        </ButtonRow>
        <Field label="Sample Rate">
          <Pills<SampleRate>
            value={s.sampleRate}
            onChange={(v) => s.set("sampleRate", v)}
            options={[
              { value: 44100, label: "44.1k" },
              { value: 48000, label: "48k" },
              { value: 96000, label: "96k" },
            ]}
          />
        </Field>
        <Field label="Buffer Size">
          <Pills<BufferSize>
            value={s.bufferSize}
            onChange={(v) => s.set("bufferSize", v)}
            options={[64, 128, 256, 512, 1024].map((n) => ({ value: n as BufferSize, label: String(n) }))}
          />
        </Field>
        <Info2 label="Estimated Latency" value={`${estLat.toFixed(2)} ms`} />
        <Info2 label="Live Context SR" value={`${liveSr} Hz`} />
        <div className="hairline" />
        <p className="font-mono text-[9px] text-muted-foreground">
          Sample Rate, Buffer Size und Output Device werden erst nach einem
          Audio Engine Restart übernommen. Laufende Wiedergabe wird gestoppt
          und geladene Samples werden geleert.
        </p>
        <ButtonRow>
          <Btn
            icon={Power}
            label={busyRestart ? "RESTARTING…" : "RESTART AUDIO ENGINE"}
            disabled={busyRestart}
            onClick={async () => {
              setBusyRestart(true);
              setRestartMsg(null);
              try {
                const c = await restartAudio();
                setRestartMsg(`OK — running @ ${c.sampleRate} Hz`);
              } catch (e) {
                setRestartMsg(`FAIL — ${(e as Error).message ?? "unknown"}`);
              } finally {
                setBusyRestart(false);
              }
            }}
          />
        </ButtonRow>
        {restartMsg && (
          <Info2
            label="Last Restart"
            value={restartMsg}
            tone={restartMsg.startsWith("OK") ? "ok" : "warn"}
          />
        )}
      </Section>

      {/* MIDI */}
      <Section icon={Music} title="MIDI SETUP">
        <Field label="MIDI Input">
          <Select
            value={s.midiInputId ?? ""}
            onChange={(v) => s.set("midiInputId", v || null)}
            options={[{ value: "", label: "— None —" }, ...midi.inputs.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </Field>
        <Field label="MIDI Output">
          <Select
            value={s.midiOutputId ?? ""}
            onChange={(v) => s.set("midiOutputId", v || null)}
            options={[{ value: "", label: "— None —" }, ...midi.outputs.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </Field>
        <ButtonRow>
          <Btn icon={RotateCw} label="RESCAN MIDI" onClick={refreshMidi} />
        </ButtonRow>
        <Toggle label="Clock Send" value={s.midiClockSend} onChange={(v) => s.set("midiClockSend", v)} />
        <Toggle label="Clock Receive" value={s.midiClockReceive} onChange={(v) => s.set("midiClockReceive", v)} />
        <Toggle label="Respond Start" value={s.midiStart} onChange={(v) => s.set("midiStart", v)} />
        <Toggle label="Respond Stop" value={s.midiStop} onChange={(v) => s.set("midiStop", v)} />
        <Toggle label="Respond Continue" value={s.midiContinue} onChange={(v) => s.set("midiContinue", v)} />
        {midi.inputs.length === 0 && midi.outputs.length === 0 && (
          <p className="font-mono text-[9px] text-muted-foreground">
            No MIDI devices detected. Connect a device and tap RESCAN MIDI.
          </p>
        )}
      </Section>

      {/* VIBESYNC */}
      <Section icon={Activity} title="VIBESYNC SETUP">
        <Field label="Sync Source">
          <Pills<SyncSource>
            value={s.syncSource}
            onChange={(v) => s.set("syncSource", v)}
            options={[
              { value: "internal", label: "INT" },
              { value: "external_audio", label: "EXT AUDIO" },
              { value: "midi", label: "MIDI" },
              { value: "auto", label: "AUTO" },
            ]}
          />
        </Field>
        <Slider label="Beat Sensitivity" value={s.beatSensitivity} onChange={(v) => s.set("beatSensitivity", v)} />
        <Slider label="Transient Sensitivity" value={s.transientSensitivity} onChange={(v) => s.set("transientSensitivity", v)} />
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Min BPM" value={s.bpmMin} min={20} max={s.bpmMax - 1} onChange={(v) => s.set("bpmMin", v)} />
          <NumField label="Max BPM" value={s.bpmMax} min={s.bpmMin + 1} max={300} onChange={(v) => s.set("bpmMax", v)} />
        </div>
      </Section>

      {/* LATENCY TEST */}
      <Section icon={Gauge} title="LATENCY TEST">
        <ButtonRow>
          <Btn icon={Mic} label={busyLat ? "TESTING…" : "TEST LATENCY"} onClick={onLat} disabled={busyLat} />
        </ButtonRow>
        {s.lastLatency && (
          <div className="space-y-1 font-mono text-[10px]">
            <Info2 label="Input Latency" value={`${s.lastLatency.inputMs.toFixed(2)} ms`} />
            <Info2 label="Output Latency" value={`${s.lastLatency.outputMs.toFixed(2)} ms`} />
            <Info2 label="Roundtrip" value={`${s.lastLatency.roundtripMs.toFixed(2)} ms`} />
          </div>
        )}
      </Section>

      {/* CLOCK TEST */}
      <Section icon={Activity} title="CLOCK TEST">
        <ButtonRow>
          <Btn icon={Activity} label={busyClk ? "MEASURING…" : "TEST CLOCK"} onClick={onClk} disabled={busyClk} />
        </ButtonRow>
        {s.lastClock && (
          <div className="space-y-1 font-mono text-[10px]">
            <Info2 label="Jitter" value={`${s.lastClock.jitterMs.toFixed(3)} ms`} />
            <Info2 label="Drift" value={`${s.lastClock.driftMs.toFixed(3)} ms`} />
            <Info2 label="Stability"
              value={`${(s.lastClock.stableRatio * 100).toFixed(1)} %`}
              tone={s.lastClock.stableRatio > 0.9 ? "ok" : "warn"} />
            <Info2 label="Verdict"
              value={s.lastClock.stableRatio > 0.9 ? "CLOCK STABLE" : "JITTERY"}
              tone={s.lastClock.stableRatio > 0.9 ? "ok" : "warn"} />
          </div>
        )}
      </Section>

      {/* PERFORMANCE */}
      <Section icon={Cpu} title="PERFORMANCE">
        <Field label="CPU Mode">
          <Pills<CpuMode>
            value={s.cpuMode}
            onChange={(v) => s.set("cpuMode", v)}
            options={[
              { value: "low", label: "LOW" },
              { value: "balanced", label: "BAL" },
              { value: "performance", label: "PERF" },
              { value: "ultra", label: "ULTRA" },
            ]}
          />
        </Field>
      </Section>

      {/* GRAPHICS */}
      <Section icon={Sparkles} title="GRAPHICS">
        <Toggle label="Bloom" value={s.bloom} onChange={(v) => s.set("bloom", v)} />
        <Field label="Particles">
          <Pills<ParticleLevel>
            value={s.particles}
            onChange={(v) => s.set("particles", v)}
            options={[
              { value: "low", label: "LOW" },
              { value: "medium", label: "MED" },
              { value: "high", label: "HIGH" },
              { value: "ultra", label: "ULTRA" },
            ]}
          />
        </Field>
        <Field label="Atmosphere">
          <Pills<AtmoQuality>
            value={s.atmosphere}
            onChange={(v) => s.set("atmosphere", v)}
            options={[
              { value: "low", label: "LOW" },
              { value: "medium", label: "MED" },
              { value: "high", label: "HIGH" },
            ]}
          />
        </Field>
      </Section>

      {/* MOBILE */}
      <Section icon={Smartphone} title="MOBILE">
        <Field label="Landscape Mode">
          <Pills<LandscapeMode>
            value={s.landscape}
            onChange={(v) => s.set("landscape", v)}
            options={[
              { value: "auto", label: "AUTO" },
              { value: "always", label: "ALWAYS" },
              { value: "off", label: "OFF" },
            ]}
          />
        </Field>
        <Toggle label="Compact Mixer" value={s.compactMixer} onChange={(v) => s.set("compactMixer", v)} />
        <Toggle label="Large Touch Controls" value={s.largeTouch} onChange={(v) => s.set("largeTouch", v)} />
      </Section>

      {/* DEBUG */}
      <Section icon={Bug} title="DEBUG PANEL">
        <Toggle label="Enable Debug Panel" value={s.debugPanel} onChange={(v) => s.set("debugPanel", v)} />
        {s.debugPanel && (
          <div className="space-y-1 font-mono text-[10px]">
            <Info2 label="BPM" value={groove.bpm.toFixed(2)} />
            <Info2 label="Pattern" value={String(groove.transport.currentPattern + 1)} />
            <Info2 label="Step" value={String((groove.playheads.step ?? 0) + 1)} />
            <Info2 label="Scene / Loop" value={`${(groove.playheads.sceneIdx ?? 0) + 1} / ${groove.playheads.sceneLoop ?? 0}`} />
            <Info2 label="Active Voices" value={String(groove.activeVoices)} />
            <Info2 label="CPU (est)" value={`${groove.cpu} %`} />
          </div>
        )}
      </Section>

      {/* SYSTEM INFO */}
      <Section icon={Info} title="SYSTEM INFORMATION">
        <Info2 label="Version" value="VibeCoreLiv3 · 0.6.0" />
        <Info2 label="Audio Output" value={outputs.find((d) => d.id === s.audioOutputId)?.label ?? "Default Output"} />
        <Info2 label="Sample Rate" value={`${liveSr} Hz`} />
        <Info2 label="Buffer Size" value={String(s.bufferSize)} />
        <Info2 label="CPU Mode" value={s.cpuMode.toUpperCase()} />
        <Info2 label="Sync Mode" value={s.syncSource.toUpperCase()} />
      </Section>

      <p className="font-mono text-[9px] text-muted-foreground text-center pt-1">
        Sample rate and buffer size apply on next audio engine start.
      </p>
    </div>
  );
}

// ----- helpers -----

function Header({ icon: Icon, title, subtitle }: { icon: typeof Settings; title: string; subtitle: string }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <div>
          <div className="font-display text-xs text-primary">{title}</div>
          <div className="font-mono text-[9px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Settings; title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-3 space-y-2">
      <div className="flex items-center gap-2 font-display text-[11px] text-neon-cyan">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="hairline" />
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full h-9 panel-inset rounded font-mono text-[11px] px-2 bg-background/40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Pills<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 px-3 panel-inset rounded font-mono text-[10px]",
            value === o.value ? "neon-border text-neon-cyan" : "text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "w-full h-9 panel-inset rounded font-mono text-[10px] flex items-center justify-between px-3",
        value ? "neon-border text-neon-cyan" : "text-muted-foreground"
      )}
    >
      <span>{label}</span>
      <span className={cn("hw-led", )} data-on={value} data-tone="cyan" />
    </button>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-muted-foreground uppercase tracking-widest text-[9px]">{label}</span>
        <span className="tabular-nums text-primary">{value} %</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function NumField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-full h-9 panel-inset rounded font-mono text-[11px] px-2 bg-background/40 tabular-nums"
      />
    </Field>
  );
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>;
}

function Btn({ icon: Icon, label, onClick, disabled }: { icon: typeof Settings; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-9 px-3 panel-inset rounded font-mono text-[10px] flex items-center gap-1.5 text-neon-cyan disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Info2({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between font-mono text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "tabular-nums",
        tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-neon-cyan" : "text-primary",
      )}>{value}</span>
    </div>
  );
}
