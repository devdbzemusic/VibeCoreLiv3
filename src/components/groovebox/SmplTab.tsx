// VibeCoreLiv3 — Sample Forge Module Page.
//
// UX Rules: Waveform is the primary UI (≥60% of screen height).
// All editing actions live in a scrollable horizontal toolbar below the waveform.
// Slice markers are draggable on the waveform surface.
// AI "Auto Slice" button uses the existing autoChopBuffer transient detector.

import { useEffect, useMemo, useRef, useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Scissors, Repeat, Rewind, Snowflake, Upload, Play, Wand2, Volume2,
  Loader2, Download, FileUp, Crop, Music2, Clock, Zap, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  ensureAudio, getBuffer, assignBufferToPart, previewBuffer, decodeSampleFile,
  triggerPart, triggerSampleRegion, normalizeBuffer, reverseBuffer,
} from "@/lib/audio/engine";
import {
  trimBufferRegion, applyFadeBuffer, pitchShiftAudioBuffer, timeStretchAudioBuffer,
  spectralFreezeAudioBuffer, autoChopBuffer,
} from "@/lib/audio/sampleForge";
import { AiContextButton } from "./AiContextButton";
import type { WaveEdit } from "@/lib/model";

interface LoadedSample {
  name: string;
  buffer: AudioBuffer;
  dur: string;
}

const SLICE_OPTIONS = [2, 4, 8, 16, 32, 64] as const;

function evenSlicePositions(sliceCount: number): number[] {
  return Array.from(
    { length: Math.max(0, Math.round(sliceCount) - 1) },
    (_, i) => (i + 1) / sliceCount,
  );
}

function slicePositionsForWave(wave: WaveEdit): number[] {
  const expected = Math.max(0, Math.round(wave.slices) - 1);
  return wave.sliceMarkers?.length === expected
    ? wave.sliceMarkers
    : evenSlicePositions(wave.slices);
}

export function SmplTab() {
  const { parts, selectedPart, selectPart, setPartSampleName, setWaveEdit } = useGroove();
  const part = parts[selectedPart];
  const wave = part.wave;

  const [library, setLibrary] = useState<LoadedSample[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const presetRef = useRef<HTMLInputElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);

  // Slice positions — local state (normalized 0..1 for each interior divider)
  const [slicePositions, setSlicePositions] = useState<number[]>([]);
  const sliceDragRef = useRef<{ idx: number } | null>(null);

  // Restore custom positions when switching parts or returning to Sample Forge.
  // Older projects and a changed slice count fall back to even divisions.
  useEffect(() => {
    setSlicePositions(slicePositionsForWave(wave));
  }, [selectedPart, wave.slices, wave.sliceMarkers]);

  const partBuffer = getBuffer(selectedPart);
  const sample = library[selected];
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
    setWaveEdit(selectedPart, { start: 0, end: 1 });
    setStatus(`Assigned ${sample.name} → ${part.name}`);
  };

  // ─── marker drag ─────────────────────────────────────────────
  const markerDragRef = useRef<"start" | "end" | null>(null);

  const onWavePointerDown = (e: React.PointerEvent, which: "start" | "end") => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    markerDragRef.current = which;
  };
  const onWavePointerMove = (e: React.PointerEvent) => {
    if (!waveRef.current) return;
    const rect = waveRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (markerDragRef.current === "start") {
      setWaveEdit(selectedPart, { start: Math.min(t, wave.end - 0.005) });
    } else if (markerDragRef.current === "end") {
      setWaveEdit(selectedPart, { end: Math.max(t, wave.start + 0.005) });
    } else if (sliceDragRef.current !== null) {
      const { idx } = sliceDragRef.current;
      setSlicePositions((prev) => {
        const next = [...prev];
        const lo = idx === 0 ? wave.start + 0.01 : prev[idx - 1] + 0.01;
        const hi = idx === prev.length - 1 ? wave.end - 0.01 : prev[idx + 1] - 0.01;
        next[idx] = Math.max(lo, Math.min(hi, t));
        return next;
      });
    }
  };
  const onWavePointerUp = () => {
    if (sliceDragRef.current !== null) {
      setWaveEdit(selectedPart, { sliceMarkers: slicePositions });
    }
    markerDragRef.current = null;
    sliceDragRef.current = null;
  };

  const onSlicePointerDown = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    sliceDragRef.current = { idx };
  };

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

  const withBusy = async (label: string, op: () => AudioBuffer) => {
    if (!partBuffer) { setStatus("No sample assigned to part"); return; }
    setBusy(true);
    try {
      await ensureAudio();
      await new Promise((r) => setTimeout(r, 16));
      const out = op();
      assignBufferToPart(selectedPart, out);
      setStatus(`${label} ✓`);
    } catch {
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
      const supported = [2, 4, 8, 16];
      const chosen = supported.slice().reverse().find((v) => v <= n) ?? 2;
      setWaveEdit(selectedPart, { slices: chosen, sliceMarkers: undefined });
      setStatus(`Auto-chop: ${slices.length} transients → ${chosen} slices`);
    } finally {
      setBusy(false);
    }
  };

  const triggerSlice = async (i: number) => {
    await ensureAudio();
    if (!partBuffer) return;
    const markers = wave.sliceMarkers?.length === Math.max(0, Math.round(wave.slices) - 1)
      ? wave.sliceMarkers
      : slicePositions;
    const positions = [wave.start, ...markers, wave.end];
    const s = positions[i];
    const e = positions[i + 1];
    triggerSampleRegion(selectedPart, s, e, 110);
  };

  const exportPreset = (scope: "part" | "all") => {
    const payload =
      scope === "part"
        ? { kind: "vibecore-wave-preset", version: 1, scope: "part" as const, partId: selectedPart, partName: part.name, sampleName: part.sampleName, wave: part.wave }
        : { kind: "vibecore-wave-preset", version: 1, scope: "all" as const, waves: parts.map((p) => ({ partId: p.id, partName: p.name, sampleName: p.sampleName, wave: p.wave })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = scope === "part" ? `vibecore-wave-${part.name.replace(/\s+/g, "_")}.json` : "vibecore-wave-all.json";
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
    const slices = num(r.slices, fallback.slices, 2, 64);
    const hasSliceMarkers = Object.prototype.hasOwnProperty.call(r, "sliceMarkers");
    const sliceMarkers = Array.isArray(r.sliceMarkers)
      ? r.sliceMarkers.filter((v): v is number =>
          typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1,
        )
      : null;
    const expectedMarkers = Math.max(0, Math.round(slices) - 1);

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
      slices,
      sliceMarkers: !hasSliceMarkers
        ? fallback.sliceMarkers
        : sliceMarkers?.length === expectedMarkers &&
            sliceMarkers.every((v, i) => i === 0 || v > sliceMarkers[i - 1])
          ? sliceMarkers
          : undefined,
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
      if (data?.kind !== "vibecore-wave-preset") { setStatus("Invalid preset file"); return; }
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
    } catch {
      setStatus("Failed to read preset JSON");
    } finally {
      if (presetRef.current) presetRef.current.value = "";
    }
  };

  useEffect(() => {
    setStatus("");
    markerDragRef.current = null;
    sliceDragRef.current = null;
  }, [selectedPart]);

  // ─── Toolbar action definition ────────────────────────────────
  type ToolbarAction = {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: string;
    disabled?: boolean;
  };
  const toolbarActions: ToolbarAction[] = [
    { label: "PLAY",      icon: <Play className="h-4 w-4" />,      onClick: doPreview,       color: "text-primary",      disabled: !editorBuffer },
    { label: "ASSIGN",    icon: <Wand2 className="h-4 w-4" />,     onClick: assignToSelected, color: "text-neon-lime",   disabled: !sample },
    { label: "NORM",      icon: <Volume2 className="h-4 w-4" />,   onClick: doNormalize,     color: "text-neon-lime",    disabled: busy || !partBuffer },
    { label: "REV",       icon: <Rewind className="h-4 w-4" />,    onClick: doReverseBuffer, color: "text-neon-amber",   disabled: busy || !partBuffer },
    { label: "TRIM",      icon: <Crop className="h-4 w-4" />,      onClick: doTrim,          color: "text-primary",      disabled: busy || !partBuffer },
    { label: "FADE",      icon: <Wand2 className="h-4 w-4" />,     onClick: doFade,          color: "text-neon-lime",    disabled: busy || !partBuffer },
    { label: `PITCH${wave.pitchShift !== 0 ? (wave.pitchShift > 0 ? "+" : "") + wave.pitchShift : ""}`,
                          icon: <Music2 className="h-4 w-4" />,    onClick: doPitch,         color: "text-neon-magenta", disabled: busy || !partBuffer },
    { label: `STR ${wave.timeStretch}%`,
                          icon: <Clock className="h-4 w-4" />,     onClick: doStretch,       color: "text-neon-cyan",    disabled: busy || !partBuffer },
    { label: "SPEC FRZ",  icon: <Snowflake className="h-4 w-4" />, onClick: doSpectralFreeze,color: "text-neon-cyan",    disabled: busy || !partBuffer },
    { label: "TRIGGER",   icon: <Play className="h-4 w-4" />,
      onClick: async () => { await ensureAudio(); triggerPart(selectedPart, 0, { velocity: 110 }); },
      color: "text-neon-cyan", disabled: !partBuffer },
    { label: "EXP",       icon: <Download className="h-4 w-4" />,  onClick: () => exportPreset("part"), color: "text-neon-cyan" },
    { label: "EXP ALL",   icon: <Download className="h-4 w-4" />,  onClick: () => exportPreset("all"),  color: "text-neon-cyan" },
  ];

  return (
    <div className="space-y-3" onPointerMove={onWavePointerMove} onPointerUp={onWavePointerUp}>

      {/* ─── PRIMARY: Waveform editor ─────────────────────── */}
      <div className="panel p-2">
        {/* Compact header */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="font-display text-xs truncate flex-1">
            {part.name}
            {(part.sampleName ?? sample?.name) && (
              <span className="text-muted-foreground ml-1">· {(part.sampleName ?? sample?.name)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <AiContextButton label="Auto Slice" onAction={doAutoChop} />
            <label className="h-7 px-2 rounded panel-inset font-mono text-[9px] flex items-center gap-1 cursor-pointer text-neon-lime">
              <Upload className="h-3 w-3" /> IMP
              <input ref={fileRef} type="file" accept="audio/*,.wav,.aif,.aiff,.flac,.ogg,.mp3" multiple className="hidden"
                onChange={(e) => handleFiles(e.target.files)} />
            </label>
            <div className="font-mono text-[9px] text-muted-foreground">
              {editorBuffer ? `${editorBuffer.duration.toFixed(2)}s` : "—"}
            </div>
          </div>
        </div>

        {/* LARGE waveform — ≥60% of visible area */}
        <div
          ref={waveRef}
          className="panel-inset rounded-md p-2 relative min-h-[280px] h-[52vh] overflow-hidden scanline touch-none select-none"
        >
          {/* Waveform bars */}
          <div className="absolute inset-2 flex items-center gap-[1px]">
            {wavePeaks.map((v, i) => (
              <div key={i} className="flex-1 bg-gradient-primary rounded-sm"
                style={{ height: `${Math.max(2, v * 100)}%`, opacity: 0.5 + v * 0.5 }} />
            ))}
          </div>

          {/* Dimmed regions outside start/end */}
          <div className="absolute top-0 bottom-0 left-0 bg-background/70 pointer-events-none"
            style={{ width: `${wave.start * 100}%` }} />
          <div className="absolute top-0 bottom-0 right-0 bg-background/70 pointer-events-none"
            style={{ width: `${(1 - wave.end) * 100}%` }} />

          {/* Interior slice markers — draggable */}
          {slicePositions.map((pos, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-5 -ml-2.5 cursor-ew-resize touch-none z-10"
              style={{ left: `${pos * 100}%` }}
              onPointerDown={(e) => onSlicePointerDown(e, i)}
            >
              <div className="absolute top-0 bottom-0 left-2.5 w-px bg-neon-amber/70 shadow-[0_0_4px_hsl(38_100%_58%/0.5)]" />
              <div className="absolute top-1 left-0.5 w-4 h-4 rounded bg-neon-amber/20 border border-neon-amber/50 grid place-items-center">
                <span className="font-mono text-[7px] text-neon-amber">{i + 1}</span>
              </div>
            </div>
          ))}

          {/* S/E draggable markers */}
          <div onPointerDown={(e) => onWavePointerDown(e, "start")}
            className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize touch-none z-10"
            style={{ left: `${wave.start * 100}%` }}>
            <div className="absolute top-0 bottom-0 left-1.5 w-px bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
            <div className="absolute top-1 left-0 px-1 rounded font-mono text-[8px] bg-primary text-primary-foreground">S</div>
          </div>
          <div onPointerDown={(e) => onWavePointerDown(e, "end")}
            className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize touch-none z-10"
            style={{ left: `${wave.end * 100}%` }}>
            <div className="absolute top-0 bottom-0 left-1.5 w-px bg-neon-magenta shadow-[0_0_6px_hsl(var(--magenta))]" />
            <div className="absolute top-1 left-0 px-1 rounded font-mono text-[8px] bg-neon-magenta text-background">E</div>
          </div>

          {/* Status overlay */}
          {busy && (
            <div className="absolute inset-0 bg-background/80 grid place-items-center z-20">
              <div className="flex items-center gap-2 font-mono text-[10px] text-neon-cyan">
                <Loader2 className="h-4 w-4 animate-spin" /> rendering…
              </div>
            </div>
          )}
        </div>

        {/* Start / End compact sliders */}
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

        {/* ─── Horizontal action toolbar ─── */}
        <div className="mt-3 -mx-1">
          <div className="no-scrollbar overflow-x-auto px-1">
            <div className="flex gap-1.5 min-w-max">
              {toolbarActions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className={cn(
                    "h-11 min-w-[52px] px-2.5 panel-inset rounded-md flex flex-col items-center justify-center gap-0.5 font-mono text-[8px] shrink-0 disabled:opacity-40",
                    a.color ?? "text-muted-foreground",
                  )}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}

              {/* Preset import button */}
              <label className="h-11 min-w-[52px] px-2.5 panel-inset rounded-md flex flex-col items-center justify-center gap-0.5 font-mono text-[8px] text-neon-lime cursor-pointer shrink-0">
                <FileUp className="h-4 w-4" />
                IMP PRE
                <input ref={presetRef} type="file" accept="application/json,.json" className="hidden"
                  onChange={(e) => handlePresetImport(e.target.files)} />
              </label>
            </div>
          </div>
        </div>

        {/* Toggle row */}
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <button onClick={() => setWaveEdit(selectedPart, { reverse: !wave.reverse })}
            className={cn("h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px]",
              wave.reverse ? "neon-border text-neon-amber" : "text-muted-foreground")}>
            <Rewind className="h-3.5 w-3.5" /> REVERSE
          </button>
          <button onClick={() => setWaveEdit(selectedPart, { loop: !wave.loop })}
            className={cn("h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px]",
              wave.loop ? "neon-border text-neon-lime" : "text-muted-foreground")}>
            <Repeat className="h-3.5 w-3.5" /> LOOP
          </button>
          <button onClick={() => setWaveEdit(selectedPart, { freeze: !wave.freeze, loop: !wave.freeze ? true : wave.loop })}
            className={cn("h-10 panel-inset rounded-md flex items-center justify-center gap-1 font-mono text-[10px]",
              wave.freeze ? "neon-border text-neon-cyan" : "text-muted-foreground")}>
            <Snowflake className="h-3.5 w-3.5" /> FREEZE
          </button>
        </div>

        {status && <div className="mt-2 font-mono text-[9px] text-neon-cyan">{status}</div>}
      </div>

      {/* ─── Slices ─────────────────────────── */}
      <div className="panel p-3">
        <div className="flex items-center gap-2 text-[10px] font-mono mb-2">
          <Scissors className="h-3.5 w-3.5 text-neon-amber" />
          <span className="text-muted-foreground">SLICES</span>
          <div className="flex-1 flex gap-1">
            {SLICE_OPTIONS.map((n) => (
              <button key={n} onClick={() => setWaveEdit(selectedPart, { slices: n, sliceMarkers: undefined })}
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
              className="h-9 panel-inset rounded font-mono text-[9px] text-neon-amber active:bg-neon-amber/20">
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Sample browser (collapsible) ─────────────────────── */}
      <div className="panel p-3">
        <button
          onClick={() => setLibraryOpen((o) => !o)}
          className="w-full flex items-center justify-between font-display text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            SAMPLE BROWSER
            {library.length > 0 && <span className="font-mono text-[9px] text-primary">{library.length} loaded</span>}
          </span>
          {libraryOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {libraryOpen && (
          <div className="mt-3">
            <div className="hairline mb-2" />
            {library.length === 0 && (
              <div className="font-mono text-[10px] text-muted-foreground py-2 text-center">
                Tap IMPORT to load WAV / AIFF / FLAC / OGG / MP3
              </div>
            )}
            <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
              {library.map((s, i) => (
                <div key={i} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded panel-inset", selected === i && "neon-border")}>
                  <button onClick={() => setSelected(i)} className="flex-1 flex items-center gap-2 text-left">
                    <span className="font-mono text-[9px] w-5 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-[11px] flex-1 truncate">{s.name}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{s.dur}</span>
                  </button>
                  <button onClick={async () => { await ensureAudio(); previewBuffer(s.buffer); }}
                    className="h-6 w-6 grid place-items-center rounded panel-inset text-primary">
                    <Play className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Part assignments (collapsible) ─────────────────────── */}
      <div className="panel p-3">
        <button
          onClick={() => setPartsOpen((o) => !o)}
          className="w-full flex items-center justify-between font-display text-xs text-muted-foreground"
        >
          <span>PART ASSIGNMENTS</span>
          {partsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {partsOpen && (
          <div className="mt-3">
            <div className="hairline mb-2" />
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
              {parts.map((p) => {
                const has = !!getBuffer(p.id) || !!p.sampleName;
                return (
                  <button key={p.id} onClick={() => selectPart(p.id)}
                    className={cn("h-12 panel-inset rounded font-mono text-[8px] flex flex-col items-center justify-center leading-tight gap-0.5",
                      selectedPart === p.id && "neon-border text-primary")}>
                    <span style={{ color: `hsl(var(--${p.color}))` }}>●</span>
                    <span>{p.name}</span>
                    <span className={cn("text-[7px] truncate w-full text-center", has ? "text-neon-lime" : "text-muted-foreground")}>
                      {p.sampleName ? p.sampleName.slice(0, 10) : "empty"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
