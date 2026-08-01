import { useEffect, useMemo, useRef, useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Folder, Scissors, Repeat, Rewind, Snowflake, Upload, Play, Wand2, Volume2, Loader2, Download, FileUp, Crop, Music2, Clock, Zap, Sparkles } from "lucide-react";
import {
  ensureAudio, getBuffer, assignBufferToPart, previewBuffer, decodeSampleFile,
  triggerPart, triggerSampleRegion, normalizeBuffer, reverseBuffer,
} from "@/lib/audio/engine";
import {
  trimBufferRegion, applyFadeBuffer, pitchShiftAudioBuffer, timeStretchAudioBuffer,
  spectralFreezeAudioBuffer, autoChopBuffer,
} from "@/lib/audio/sampleForge";
import type { WaveEdit } from "@/lib/model";

interface LoadedSample {
  name: string;
  buffer: AudioBuffer;
  dur: string;
}

const SLICE_OPTIONS = [2, 4, 8, 16, 32, 64] as const;

export function SmplTab() {
  const { parts, selectedPart, selectPart, setPartSampleName, setWaveEdit } = useGroove();
  const part = parts[selectedPart];
  const wave = part.wave;

  const [library, setLibrary] = useState<LoadedSample[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const presetRef = useRef<HTMLInputElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);

  const partBuffer = getBuffer(selectedPart);
  const sample = library[selected];
  // Editor always edits the part's assigned buffer if it exists, else preview the browser-selected one.
  const editorBuffer = partBuffer ?? sample?.buffer ?? null;

  const wavePeaks = useMemo(() => {
    if (!editorBuffer) return Array.from({ length: 192 }, (_, i) => Math.abs(Math.sin(i * 0.21)) * 0.5);
    const data = editorBuffer.getChannelData(0);
    const bins = 192;
    const block = Math.max(1, Math.floor(data.length / bins));
    const out: number[] = [];
    for (let i = 0; i < bins; i++) {
      let peak = 0;
      const start = i * block;
      for (let j = 0; j < block; j += 4) {
        const a = Math.abs(data[start + j] || 0);
        if (a > peak) peak = a;
      }
      out.push(Math.min(1, peak * 1.2));
    }
    return out;
  }, [editorBuffer]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    await ensureAudio();
    for (const f of Array.from(files)) {
      try {
        setStatus(`Decoding ${f.name}…`);
        const buf = await decodeSampleFile(f);
        setLibrary((l) => [...l, { name: f.name, buffer: buf, dur: `${buf.duration.toFixed(2)}s` }]);
        setStatus(`Loaded ${f.name}`);
      } catch {
        setStatus(`Failed: ${f.name}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const assignToSelected = async () => {
    if (!sample) return;
    await ensureAudio();
    assignBufferToPart(selectedPart, sample.buffer);
    setPartSampleName(selectedPart, sample.name);
    // reset markers
    setWaveEdit(selectedPart, { start: 0, end: 1 });
    setStatus(`Assigned ${sample.name} → ${part.name}`);
  };

  // ─── marker drag ─────────────────────────────────────────────
  const dragRef = useRef<"start" | "end" | null>(null);
  const onPointerDown = (e: React.PointerEvent, which: "start" | "end") => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = which;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !waveRef.current) return;
    const rect = waveRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (dragRef.current === "start") {
      setWaveEdit(selectedPart, { start: Math.min(t, wave.end - 0.005) });
    } else {
      setWaveEdit(selectedPart, { end: Math.max(t, wave.start + 0.005) });
    }
  };
  const onPointerUp = () => { dragRef.current = null; };

  // ─── actions ─────────────────────────────────────────────────
  const doPreview = async () => {
    await ensureAudio();
    if (editorBuffer) previewBuffer(editorBuffer, wave.start, wave.end);
  };

  const doNormalize = async () => {
    if (!partBuffer) { setStatus("No sample assigned to part"); return; }
    setBusy(true);
    await ensureAudio();
    const norm = normalizeBuffer(partBuffer);
    assignBufferToPart(selectedPart, norm);
    setWaveEdit(selectedPart, { normalize: true });
    setStatus("Normalized ✓");
    setBusy(false);
  };

  const doReverseBuffer = async () => {
    if (!partBuffer) { setStatus("No sample assigned to part"); return; }
    setBusy(true);
    await ensureAudio();
    const rev = reverseBuffer(partBuffer);
    assignBufferToPart(selectedPart, rev);
    setStatus("Reversed buffer ✓");
    setBusy(false);
  };

  // ─── Phase 4 — Sample Forge offline DSP ──────────────────────
  const withBusy = async (label: string, op: () => AudioBuffer) => {
    if (!partBuffer) { setStatus("No sample assigned to part"); return; }
    setBusy(true);
    try {
      await ensureAudio();
      // Yield so spinner can paint before sync DSP work.
      await new Promise((r) => setTimeout(r, 16));
      const out = op();
      assignBufferToPart(selectedPart, out);
      setStatus(`${label} ✓`);
    } catch (e) {
      setStatus(`${label} failed`);
    } finally {
      setBusy(false);
    }
  };

  const doTrim = () => withBusy("Trimmed to S/E", () => trimBufferRegion(partBuffer!, wave.start, wave.end));
  const doFade = () => withBusy("Fades applied", () => applyFadeBuffer(partBuffer!, wave.fadeIn, wave.fadeOut));
  const doPitch = () => withBusy(`Pitched ${wave.pitchShift > 0 ? "+" : ""}${wave.pitchShift}st`,
    () => pitchShiftAudioBuffer(partBuffer!, wave.pitchShift));
  const doStretch = () => withBusy(`Stretched ${wave.timeStretch}%`,
    () => timeStretchAudioBuffer(partBuffer!, wave.timeStretch / 100));
  const doSpectralFreeze = () => withBusy("Spectral freeze rendered",
    () => spectralFreezeAudioBuffer(partBuffer!, wave.freezePos / 100, Math.max(0.5, wave.freezeSize / 1000 * 4)));
  const doAutoChop = async () => {
    if (!partBuffer) { setStatus("No sample assigned"); return; }
    setBusy(true);
    try {
      const slices = autoChopBuffer(partBuffer, 0.6, 16);
      const n = Math.max(2, Math.min(16, slices.length));
      // Round count down to a supported slice option.
      const supported = [2, 4, 8, 16];
      const chosen = supported.reverse().find((v) => v <= n) ?? 2;
      setWaveEdit(selectedPart, { slices: chosen });
      setStatus(`Auto-chop: ${slices.length} transients → ${chosen} slices`);
    } finally {
      setBusy(false);
    }
  };

  const triggerSlice = async (i: number) => {
    await ensureAudio();
    if (!partBuffer) return;
    const s = i / wave.slices;
    const e = (i + 1) / wave.slices;
    triggerSampleRegion(selectedPart, s, e, 110);
  };

  // ─── Sample-editor preset export / import ──────────────────
  const exportPreset = (scope: "part" | "all") => {
    const payload =
      scope === "part"
        ? {
            kind: "vibecore-wave-preset",
            version: 1,
            scope: "part" as const,
            partId: selectedPart,
            partName: part.name,
            sampleName: part.sampleName,
            wave: part.wave,
          }
        : {
            kind: "vibecore-wave-preset",
            version: 1,
            scope: "all" as const,
            waves: parts.map((p) => ({
              partId: p.id,
              partName: p.name,
              sampleName: p.sampleName,
              wave: p.wave,
            })),
          };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      scope === "part"
        ? `vibecore-wave-${part.name.replace(/\s+/g, "_")}.json`
        : `vibecore-wave-all.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(scope === "part" ? `Exported ${part.name}` : "Exported all 16 parts");
  };

  const sanitizeWave = (raw: unknown, fallback: WaveEdit): WaveEdit => {
    if (!raw || typeof raw !== "object") return fallback;
    const r = raw as Record<string, unknown>;
    const num = (v: unknown, def: number, lo: number, hi: number) =>
      typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
    const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
    const oneOf = <T extends string>(v: unknown, opts: readonly T[], def: T): T =>
      (typeof v === "string" && (opts as readonly string[]).includes(v) ? v as T : def);

    return {
      ...fallback,
      start: num(r.start, fallback.start, 0, 1),
      end: num(r.end, fallback.end, 0, 1),
      loop: bool(r.loop, fallback.loop),
      xfade: num(r.xfade, fallback.xfade, 0, 100),
      reverse: bool(r.reverse, fallback.reverse),
      playMode: oneOf(r.playMode, ["forward", "reverse", "pingpong"] as const, fallback.playMode),
      normalize: bool(r.normalize, fallback.normalize),
      fadeIn: num(r.fadeIn, fallback.fadeIn, 0, 100),
      fadeOut: num(r.fadeOut, fallback.fadeOut, 0, 100),
      slices: num(r.slices, fallback.slices, 2, 64),
      grainSize: num(r.grainSize, fallback.grainSize, 0, 100),
      grainDensity: num(r.grainDensity, fallback.grainDensity, 0, 100),
      grainPos: num(r.grainPos, fallback.grainPos, 0, 100),
      grainSpray: num(r.grainSpray, fallback.grainSpray, 0, 50),
      freeze: bool(r.freeze, fallback.freeze),
      pitchShift: num(r.pitchShift, fallback.pitchShift, -24, 24),
      timeStretch: num(r.timeStretch, fallback.timeStretch, 25, 400),
      granEnabled: bool(r.granEnabled, fallback.granEnabled),
      granDir: oneOf(r.granDir, ["fwd", "rev", "rnd"] as const, fallback.granDir),
      granPitch: num(r.granPitch, fallback.granPitch, -24, 24),
      granRandPitch: num(r.granRandPitch, fallback.granRandPitch, 0, 25),
      granRandPan: num(r.granRandPan, fallback.granRandPan, 0, 25),
      granWidth: num(r.granWidth, fallback.granWidth, 0, 200),
      granGain: num(r.granGain, fallback.granGain, -24, 12),
      granFreeze: bool(r.granFreeze, fallback.granFreeze),
      stretchMode: oneOf(r.stretchMode, ["tape", "dj", "granular", "hybrid"] as const, fallback.stretchMode),
      formant: bool(r.formant, fallback.formant),
      stretchQuality: oneOf(r.stretchQuality, ["low", "medium", "high"] as const, fallback.stretchQuality),
      freezePos: num(r.freezePos, fallback.freezePos, 0, 100),
      freezeSize: num(r.freezeSize, fallback.freezeSize, 10, 5000),
      freezeFb: num(r.freezeFb, fallback.freezeFb, 0, 100),
      freezeMix: num(r.freezeMix, fallback.freezeMix, 0, 100),
    };
  };

  const handlePresetImport = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const text = await files[0].text();
      const data = JSON.parse(text);
      if (data?.kind !== "vibecore-wave-preset") {
        setStatus("Invalid preset file");
        return;
      }
      if (data.scope === "all" && Array.isArray(data.waves)) {
        let n = 0;
        (data.waves as Array<{ partId?: number; wave?: unknown }>).forEach((entry) => {
          const pid = typeof entry?.partId === "number" ? entry.partId : -1;
          if (pid < 0 || pid >= parts.length) return;
          const clean = sanitizeWave(entry.wave, parts[pid].wave);
          setWaveEdit(pid, clean);
          n++;
        });
        setStatus(`Imported wave settings for ${n} parts`);
      } else if (data.scope === "part" && data.wave) {
        const clean = sanitizeWave(data.wave, part.wave);
        setWaveEdit(selectedPart, clean);
        setStatus(`Imported preset → ${part.name}`);
      } else {
        setStatus("Unrecognized preset structure");
      }
    } catch (e) {
      setStatus("Failed to read preset JSON");
    } finally {
      if (presetRef.current) presetRef.current.value = "";
    }
  };

  useEffect(() => {
    // Clear any transient status message and release any active waveform drag
    // handle when the selected part changes. Without this, a mid-drag pointer
    // event or a stale "Normalized ✓" from the previous part would show under
    // the new part — confusing the user about which part was just edited.
    setStatus("");
    dragRef.current = null;
  }, [selectedPart]);

  return (
    <div className="space-y-3" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {/* ─── Library ─────────────────────────────── */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary flex items-center gap-2">
            <Folder className="h-3.5 w-3.5" /> SAMPLE BROWSER
          </div>
          <label className="h-7 px-2 rounded panel-inset font-mono text-[10px] flex items-center gap-1 cursor-pointer">
            <Upload className="h-3 w-3" /> IMPORT
            <input ref={fileRef} type="file" accept="audio/*,.wav,.aif,.aiff,.flac,.ogg,.mp3" multiple className="hidden"
              onChange={(e) => handleFiles(e.target.files)} />
          </label>
        </div>
        <div className="hairline mb-2" />
        {library.length === 0 && (
          <div className="font-mono text-[10px] text-muted-foreground py-3 text-center">
            Tap IMPORT to load WAV / AIFF / FLAC / OGG / MP3
          </div>
        )}
        <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
          {library.map((s, i) => (
            <div key={i} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded panel-inset", selected === i && "neon-border")}>
              <button onClick={() => setSelected(i)} className="flex-1 flex items-center gap-2 text-left">
                <span className="font-mono text-[9px] w-5 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display text-[11px] flex-1 truncate">{s.name}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{s.dur}</span>
              </button>
              <button onClick={async () => { await ensureAudio(); previewBuffer(s.buffer); }}
                className="h-6 w-6 grid place-items-center rounded panel-inset text-primary" aria-label="Preview">
                <Play className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        {status && <div className="mt-2 font-mono text-[9px] text-neon-cyan">{status}</div>}
      </div>

      {/* ─── Waveform editor ─────────────────────── */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="font-display text-xs truncate flex-1">
            {part.name} <span className="text-muted-foreground">·</span> {part.sampleName ?? sample?.name ?? "—"}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => exportPreset("part")}
              className="h-7 px-2 rounded panel-inset font-mono text-[9px] flex items-center gap-1 text-neon-cyan"
              title="Export this part's wave settings"
            >
              <Download className="h-3 w-3" /> EXP
            </button>
            <button
              onClick={() => exportPreset("all")}
              className="h-7 px-2 rounded panel-inset font-mono text-[9px] flex items-center gap-1 text-neon-cyan"
              title="Export all 16 parts"
            >
              <Download className="h-3 w-3" /> ALL
            </button>
            <label
              className="h-7 px-2 rounded panel-inset font-mono text-[9px] flex items-center gap-1 text-neon-lime cursor-pointer"
              title="Import a saved preset JSON"
            >
              <FileUp className="h-3 w-3" /> IMP
              <input
                ref={presetRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => handlePresetImport(e.target.files)}
              />
            </label>
            <div className="font-mono text-[9px] text-muted-foreground ml-1">
              {editorBuffer ? `${editorBuffer.duration.toFixed(2)}s` : "—"}
            </div>
          </div>
        </div>


        <div
          ref={waveRef}
          className="panel-inset rounded-md p-2 relative h-32 overflow-hidden scanline touch-none select-none"
        >
          <div className="absolute inset-2 flex items-center gap-[1px]">
            {wavePeaks.map((v, i) => (
              <div key={i} className="flex-1 bg-gradient-primary rounded-sm"
                style={{ height: `${Math.max(2, v * 100)}%`, opacity: 0.5 + v * 0.5 }} />
            ))}
          </div>

          {/* slice markers */}
          {Array.from({ length: wave.slices - 1 }).map((_, i) => (
            <div key={i} className="absolute top-1 bottom-1 w-px bg-neon-amber/60 pointer-events-none"
              style={{ left: `${((i + 1) / wave.slices) * 100}%` }} />
          ))}

          {/* dimmed regions outside start/end */}
          <div className="absolute top-0 bottom-0 left-0 bg-background/70 pointer-events-none"
            style={{ width: `${wave.start * 100}%` }} />
          <div className="absolute top-0 bottom-0 right-0 bg-background/70 pointer-events-none"
            style={{ width: `${(1 - wave.end) * 100}%` }} />

          {/* draggable markers */}
          <div onPointerDown={(e) => onPointerDown(e, "start")}
            className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize touch-none"
            style={{ left: `${wave.start * 100}%` }}>
            <div className="absolute top-0 bottom-0 left-1.5 w-px bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
            <div className="absolute top-1 left-0 px-1 rounded font-mono text-[8px] bg-primary text-primary-foreground">S</div>
          </div>
          <div onPointerDown={(e) => onPointerDown(e, "end")}
            className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize touch-none"
            style={{ left: `${wave.end * 100}%` }}>
            <div className="absolute top-0 bottom-0 left-1.5 w-px bg-neon-magenta shadow-[0_0_6px_hsl(var(--magenta))]" />
            <div className="absolute top-1 left-0 px-1 rounded font-mono text-[8px] bg-neon-magenta text-background">E</div>
          </div>
        </div>

        {/* Start / End numeric */}
        <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[10px]">
          <label className="flex items-center gap-1">
            <span className="text-primary w-8">START</span>
            <input type="range" min={0} max={1000} value={Math.round(wave.start * 1000)}
              onChange={(e) => setWaveEdit(selectedPart, { start: Math.min(Number(e.target.value) / 1000, wave.end - 0.005) })}
              className="flex-1 accent-primary" />
            <span className="w-10 text-right">{(wave.start * 100).toFixed(1)}%</span>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-neon-magenta w-8">END</span>
            <input type="range" min={0} max={1000} value={Math.round(wave.end * 1000)}
              onChange={(e) => setWaveEdit(selectedPart, { end: Math.max(Number(e.target.value) / 1000, wave.start + 0.005) })}
              className="flex-1 accent-primary" />
            <span className="w-10 text-right">{(wave.end * 100).toFixed(1)}%</span>
          </label>
        </div>

        {/* Toggle buttons */}
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <button
            onClick={() => setWaveEdit(selectedPart, { reverse: !wave.reverse })}
            className={cn("h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px]",
              wave.reverse ? "neon-border text-neon-amber" : "text-muted-foreground")}
          >
            <Rewind className="h-3.5 w-3.5" /> REVERSE
          </button>
          <button
            onClick={() => setWaveEdit(selectedPart, { loop: !wave.loop })}
            className={cn("h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px]",
              wave.loop ? "neon-border text-neon-lime" : "text-muted-foreground")}
          >
            <Repeat className="h-3.5 w-3.5" /> LOOP
          </button>
          <button
            onClick={() => setWaveEdit(selectedPart, { freeze: !wave.freeze, loop: !wave.freeze ? true : wave.loop })}
            className={cn("h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px]",
              wave.freeze ? "neon-border text-neon-cyan" : "text-muted-foreground")}
          >
            <Snowflake className="h-3.5 w-3.5" /> FREEZE
          </button>
        </div>

        {/* Destructive ops */}
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <button onClick={doNormalize} disabled={busy || !partBuffer}
            className="h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px] text-neon-lime disabled:opacity-40">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />} NORMALIZE
          </button>
          <button onClick={doReverseBuffer} disabled={busy || !partBuffer}
            className="h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px] text-neon-amber disabled:opacity-40">
            <Wand2 className="h-3.5 w-3.5" /> REVERSE BUF
          </button>
        </div>

        {/* ─── Sample Forge (Phase 4) ─── */}
        <div className="mt-3 panel-inset rounded-md p-2">
          <div className="flex items-center gap-1.5 mb-2 font-display text-[10px] text-neon-cyan">
            <Sparkles className="h-3 w-3" /> SAMPLE FORGE
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={doTrim} disabled={busy || !partBuffer}
              className="h-10 panel-inset rounded flex items-center justify-center gap-1 font-mono text-[9px] text-primary disabled:opacity-40"
              title="Trim buffer to S/E markers">
              <Crop className="h-3 w-3" /> TRIM
            </button>
            <button onClick={doFade} disabled={busy || !partBuffer}
              className="h-10 panel-inset rounded flex items-center justify-center gap-1 font-mono text-[9px] text-neon-lime disabled:opacity-40"
              title="Apply fade-in/out from wave settings">
              <Wand2 className="h-3 w-3" /> FADE
            </button>
            <button onClick={doAutoChop} disabled={busy || !partBuffer}
              className="h-10 panel-inset rounded flex items-center justify-center gap-1 font-mono text-[9px] text-neon-amber disabled:opacity-40"
              title="Detect transients and set slice count">
              <Zap className="h-3 w-3" /> AUTO-CHOP
            </button>
            <button onClick={doPitch} disabled={busy || !partBuffer}
              className="h-10 panel-inset rounded flex items-center justify-center gap-1 font-mono text-[9px] text-neon-magenta disabled:opacity-40"
              title="Render pitchShift semitones into buffer">
              <Music2 className="h-3 w-3" /> PITCH {wave.pitchShift > 0 ? "+" : ""}{wave.pitchShift}
            </button>
            <button onClick={doStretch} disabled={busy || !partBuffer}
              className="h-10 panel-inset rounded flex items-center justify-center gap-1 font-mono text-[9px] text-neon-cyan disabled:opacity-40"
              title="Render time-stretch ratio into buffer">
              <Clock className="h-3 w-3" /> STRETCH {wave.timeStretch}%
            </button>
            <button onClick={doSpectralFreeze} disabled={busy || !partBuffer}
              className="h-10 panel-inset rounded flex items-center justify-center gap-1 font-mono text-[9px] text-neon-cyan disabled:opacity-40"
              title="Spectral freeze of position into a sustained texture">
              <Snowflake className="h-3 w-3" /> SPEC FRZ
            </button>
          </div>
          {busy && (
            <div className="mt-2 flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> rendering…
            </div>
          )}
        </div>

        {/* Slices */}
        <div className="mt-3">
          <div className="flex items-center gap-2 text-[10px] font-mono mb-1.5">
            <Scissors className="h-3.5 w-3.5 text-neon-amber" />
            <span className="text-muted-foreground">SLICES</span>
            <div className="flex-1 flex gap-1">
              {SLICE_OPTIONS.map((n) => (
                <button key={n} onClick={() => setWaveEdit(selectedPart, { slices: n })}
                  className={cn("flex-1 h-6 rounded panel-inset text-[10px]",
                    wave.slices === n ? "neon-border text-primary" : "text-muted-foreground")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(wave.slices, 16)}, minmax(0,1fr))` }}>
            {Array.from({ length: wave.slices }).map((_, i) => (
              <button key={i} onClick={() => triggerSlice(i)}
                className="h-8 panel-inset rounded font-mono text-[9px] text-neon-amber active:bg-neon-amber/20">
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          <button onClick={doPreview} disabled={!editorBuffer}
            className="h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px] text-primary disabled:opacity-40">
            <Play className="h-3.5 w-3.5" /> PREVIEW
          </button>
          <button onClick={assignToSelected} disabled={!sample}
            className="h-10 rounded-md bg-gradient-primary text-primary-foreground font-display text-[10px] disabled:opacity-40">
            ASSIGN → {part.name}
          </button>
          <button onClick={async () => { await ensureAudio(); triggerPart(selectedPart, 0, { velocity: 110 }); }}
            disabled={!partBuffer}
            className="h-10 panel-inset rounded-md font-mono text-[10px] text-neon-cyan disabled:opacity-40">
            TRIGGER
          </button>
        </div>
      </div>

      {/* ─── Part picker ─────────────────────────── */}
      <div className="panel p-3">
        <div className="font-display text-xs mb-2">PART ASSIGNMENTS</div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
          {parts.map((p) => {
            const has = !!getBuffer(p.id) || !!p.sampleName;
            return (
              <button key={p.id} onClick={() => selectPart(p.id)}
                className={cn("h-12 panel-inset rounded font-mono text-[8px] flex flex-col items-center justify-center leading-tight gap-0.5",
                  selectedPart === p.id && "neon-border text-primary")}>
                <span style={{ color: `hsl(var(--${p.color}))` }}>●</span>
                <span>{p.name}</span>
                <span className={cn("text-[7px] truncate w-full", has ? "text-neon-lime" : "text-muted-foreground")}>
                  {p.sampleName ? p.sampleName.slice(0, 10) : "empty"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
