// Phase 3 — Adaptive Sync + MIDI Clock UI.
// Choose external audio source (Adaptive) or MIDI clock as the timing authority.

import { useEffect, useRef, useState } from "react";
import { Mic, FileAudio, MonitorSpeaker, Square, Activity, Music, Unplug } from "lucide-react";
import {
  startMidiSync, stopMidiSync, getMidiSyncStatus,
  type MidiSyncStatus,
} from "@/lib/clock/sources/midiSync";
import {
  startAdaptiveFromMic, startAdaptiveFromFile, startAdaptiveFromLoopback,
  stopAdaptive, subscribeAdaptive, getAdaptiveStatus, type AdaptiveStatus,
} from "@/lib/sync/adaptiveSync";
import { masterClock } from "@/lib/clock/masterClock";
import { getCtx } from "@/lib/audio/engine";
import { cn } from "@/lib/utils";

export function SyncTab() {
  const [s, setS] = useState<AdaptiveStatus>(getAdaptiveStatus());
  const [clockBpm, setClockBpm] = useState(masterClock.getState().bpm);
  const [clockSrc, setClockSrc] = useState(masterClock.getState().source);
  const [clockLat, setClockLat] = useState(masterClock.getOutputLatency() * 1000);
  const [clockBeat, setClockBeat] = useState(0);
  const [clockPhase, setClockPhase] = useState(0);
  const [midi, setMidi] = useState<MidiSyncStatus>(getMidiSyncStatus());
  const [midiError, setMidiError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const u = subscribeAdaptive(setS); return () => { u(); }; }, []);
  useEffect(() => {
    const unsub = masterClock.subscribe((cs) => {
      setClockBpm(cs.bpm);
      setClockSrc(cs.source);
      setClockLat(masterClock.getOutputLatency() * 1000);
    });
    return () => unsub();
  }, []);

  // Live phase-lock feedback: pull the audible clock position at ~20 fps so
  // the BEAT / PHASE readouts animate while the transport runs and freeze
  // when it stops (MasterClock handles the freeze for internal source).
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last >= 50) {
        last = now;
        const c = getCtx();
        if (c) {
          const cs = masterClock.getStateAt(c.currentTime);
          setClockBeat(cs.beat);
          setClockPhase(cs.phase01);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const doMic = async () => { try { await startAdaptiveFromMic(); } catch (e) { console.warn(e); } };
  const doLoop = async () => { try { await startAdaptiveFromLoopback(); } catch (e) { console.warn(e); } };
  const doFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) startAdaptiveFromFile(f).catch(console.warn);
  };

  const doStartMidi = async () => {
    setMidiError(null);
    const status = await startMidiSync();
    setMidi(status);
    if (status.error) setMidiError(status.error);
  };
  const doStopMidi = () => {
    stopMidiSync();
    setMidi(getMidiSyncStatus());
    setMidiError(null);
  };

  const Src = ({ icon: Icon, label, kind, onClick }: { icon: typeof Mic; label: string; kind: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={cn(
        "h-14 panel-inset rounded flex flex-col items-center justify-center gap-1 font-mono text-[10px]",
        s.inputKind === kind ? "neon-border text-neon-cyan" : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" /> ADAPTIVE SYNC ENGINE
        </div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-3 gap-1">
          <Src icon={Mic} label="MIC" kind="mic" onClick={doMic} />
          <Src icon={FileAudio} label="FILE" kind="file" onClick={() => fileRef.current?.click()} />
          <Src icon={MonitorSpeaker} label="LOOPBACK" kind="loopback" onClick={doLoop} />
        </div>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={doFile} />
        <button
          onClick={() => stopAdaptive()}
          disabled={!s.running}
          className="mt-2 w-full h-9 panel-inset rounded font-mono text-[10px] flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <Square className="h-3 w-3" /> STOP
        </button>
      </div>

      <div className="panel p-3 space-y-1.5 font-mono text-[10px]">
        <Row label="STATUS" value={s.running ? `RUNNING · ${s.inputKind?.toUpperCase()}` : "IDLE"} />
        <Row label="DETECTED BPM" value={s.bpm ? s.bpm.toFixed(1) : "—"} />
        <Row label="CONFIDENCE" value={`${Math.round(s.confidence * 100)} %`} />
        <Row label="BEATS" value={String(s.beats)} />
        <Row label="LEVEL" value={`${Math.round(s.level * 100)} %`} />
        {s.error && <Row label="ERROR" value={s.error} tone="error" />}
      </div>

      <div className="panel p-3 space-y-1.5 font-mono text-[10px]">
        <div className="font-display text-[11px] text-neon-magenta mb-1">MASTER CLOCK</div>
        <Row label="SOURCE" value={clockSrc.toUpperCase()} />
        <Row label="BPM" value={clockBpm.toFixed(2)} />
        <Row label="LAT COMP" value={`${clockLat.toFixed(1)} ms`} />
        <Row label="BEAT" value={clockBeat.toFixed(2)} />
        <Row label="PHASE" value={`${Math.round(clockPhase * 100)} %`} />
        <Row
          label="LOCK"
          value={
            clockSrc === "internal"
              ? "INTERNAL"
              : clockSrc === "adaptive"
                ? (s.confidence >= 0.5 ? "ADAPTIVE" : "SEEKING")
                : clockSrc.toUpperCase()
          }
        />
        <div className="h-1.5 w-full bg-surface-0 rounded overflow-hidden mt-1">
          <div
            className="h-full transition-all"
            style={{ width: `${clockPhase * 100}%`, background: "var(--gradient-neon)" }}
          />
        </div>
      </div>

      {/* ── MIDI Clock ──────────────────────────────────────────────────── */}
      <div className="panel p-3">
        <div className="font-display text-xs text-primary mb-2 flex items-center gap-2">
          <Music className="h-3.5 w-3.5" /> MIDI CLOCK (24 PPQ)
        </div>
        <div className="hairline mb-2" />
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={doStartMidi}
            disabled={midi.connected}
            className={cn(
              "h-12 panel-inset rounded flex flex-col items-center justify-center gap-1 font-mono text-[10px]",
              midi.connected ? "neon-border text-neon-cyan" : "text-muted-foreground disabled:opacity-40"
            )}
          >
            <Music className="h-4 w-4" />
            {midi.connected ? "LOCKED" : "START"}
          </button>
          <button
            onClick={doStopMidi}
            disabled={!midi.connected}
            className="h-12 panel-inset rounded flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-muted-foreground disabled:opacity-40"
          >
            <Unplug className="h-4 w-4" />
            STOP
          </button>
        </div>
        <div className="mt-2 space-y-1 font-mono text-[10px]">
          <Row label="MIDI AVAILABLE" value={midi.available ? "YES" : "NO (HTTPS/CHROME)"} />
          <Row label="INPUT" value={midi.inputName ?? "—"} />
          <Row label="STATUS" value={midi.connected ? "FOLLOWING" : "IDLE"} />
          {midiError && <Row label="ERROR" value={midiError} tone="error" />}
        </div>
        <p className="mt-2 font-mono text-[9px] text-muted-foreground">
          Receives 0xF8 clock · Start/Stop/Continue · Song Position Pointer.
          Requires HTTPS + browser MIDI permission.
        </p>
      </div>

      <div className="font-mono text-[9px] text-muted-foreground text-center">
        Adaptive · spectral-flux onset → autocorrelated tempo → PLL phase lock.
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", tone === "error" ? "text-destructive" : "text-primary")}>{value}</span>
    </div>
  );
}