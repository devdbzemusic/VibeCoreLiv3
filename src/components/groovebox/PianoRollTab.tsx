// VibeCoreLiv3 — Piano-Roll Editor (unified with the step sequencer).
//
// One editing surface for drum + melodic programming: a Drum-Lane strip
// (the step-sequencer trigger row) sits directly above the melodic note grid,
// aligned 1:1 to the scene's step columns. The roll itself is built out for
// fast, near-perfect editing:
//   • tap empty cell  → add note
//   • drag a note     → move (step + pitch)
//   • drag right edge → resize (gate / length)
//   • PAINT mode      → drag to sweep in multiple notes
//   • Delete / arrows → remove / nudge selected note
//   • Ctrl+Z/Y · C/V → undo / redo / copy / paste (snapshot history)
// Columns map 1:1 to the Scene's step length; rows map to MIDI pitches in a
// scrollable 16-semitone window.
//
// Props:
//   compact      — single-row 8-param header (used by GrooveModule)
//   hidePartStrip — suppress the PartStrip (caller provides its own)

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PartStrip } from "./PartStrip";
import {
  Plus, Minus, Trash2, Eraser, Magnet, X, Undo2, Redo2,
  Copy, ClipboardPaste, Paintbrush, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Note, Step } from "@/lib/model";
import { RollPlayhead } from "./RollPlayhead";
import { RollDrumLane } from "./RollDrumLane";

const ROW_PX = 18;
const ROWS_VISIBLE = 16;       // 16 semitones = 1⅓ octaves on screen
const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function pitchLabel(p: number): string {
  const n = ((p % 12) + 12) % 12;
  const oct = Math.floor(p / 12) - 1;
  return `${PITCH_NAMES[n]}${oct}`;
}
function isBlackKey(p: number): boolean {
  const n = ((p % 12) + 12) % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

type NoteRectProps = {
  note: Note;
  rowIdx: number;
  stepCount: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, note: Note) => void;
};

const NoteRect = memo(function NoteRect({
  note,
  rowIdx,
  stepCount,
  selected,
  onPointerDown,
}: NoteRectProps) {
  const left = (note.step / stepCount) * 100;
  const width = (Math.max(0.25, note.length) / stepCount) * 100;
  const microPct = ((note.micro ?? 0) / 50) * (50 / stepCount);
  const velocity = Math.max(0.25, Math.min(1, note.velocity / 127));

  return (
    <div
      data-noteid={note.id}
      onPointerDown={(e) => onPointerDown(e, note)}
      className={cn(
        "absolute rounded-sm border touch-none cursor-move",
        selected ? "border-primary z-20" : "border-primary/40 z-10",
      )}
      style={{
        top: rowIdx * ROW_PX + 1,
        height: ROW_PX - 2,
        left: `calc(${left + microPct}% + 1px)`,
        width: `calc(${width}% - 2px)`,
        background: `hsl(var(--primary) / ${0.35 + velocity * 0.5})`,
        boxShadow: selected ? "0 0 8px hsl(var(--primary))" : undefined,
      }}
      title={`${pitchLabel(note.pitch)} step ${note.step + 1} · vel ${note.velocity} · gate ${note.length.toFixed(2)} · μ ${note.micro ?? 0}`}
    >
      {selected && (
        <span className="absolute right-0 top-0 bottom-0 w-[6px] cursor-ew-resize bg-primary/70 rounded-r-sm" />
      )}
    </div>
  );
}, (prev, next) => (
  prev.note === next.note
  && prev.rowIdx === next.rowIdx
  && prev.stepCount === next.stepCount
  && prev.selected === next.selected
));

type Drag =
  | { mode: "move"; noteId: string; startStep: number; startPitch: number; px: number; py: number }
  | { mode: "resize"; noteId: string; startLen: number; px: number; py: number }
  | { mode: "paint"; painted: Set<string> }
  | null;

export function PianoRollTab({
  compact = false,
  hidePartStrip = false,
}: {
  compact?: boolean;
  hidePartStrip?: boolean;
}) {
  // Granular selectors — subscribe only to edit/selection slices, never to
  // playheads / transport / meters. Actions are stable refs.
  const patterns      = useGroove((s) => s.patterns);
  const selectedPattern = useGroove((s) => s.selectedPattern);
  const selectedSceneIdx = useGroove((s) => s.selectedSceneIdx);
  const parts         = useGroove((s) => s.parts);
  const selectedPart  = useGroove((s) => s.selectedPart);
  const addNote       = useGroove((s) => s.addNote);
  const updateNote    = useGroove((s) => s.updateNote);
  const removeNote    = useGroove((s) => s.removeNote);
  const quantizeNotes = useGroove((s) => s.quantizeNotes);
  const replaceNotes  = useGroove((s) => s.replaceNotes);
  const selectPattern = useGroove((s) => s.selectPattern);
  const selectedStep = useGroove((s) => s.selectedStep);
  const selectStep = useGroove((s) => s.selectStep);

  // Extra subscriptions for compact mode (low-cost, no unnecessary re-renders)
  const bpm       = useGroove((s) => s.bpm);
  const playing   = useGroove((s) => s.transport.playing);
  const recording = useGroove((s) => s.recording);

  const pattern = patterns[selectedPattern];
  const part    = parts[selectedPart];
  const scene   = pattern?.scenes[Math.min(selectedSceneIdx, (pattern?.scenes.length ?? 1) - 1)];
  const notes   = (scene?.partNotes[part?.id ?? 0] ?? []) as Note[];
  const steps   = (scene?.partSteps[part?.id ?? 0] ?? []) as Step[];

  const [topPitch, setTopPitch] = useState<number>(72);   // C5 down to G3
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [grid, setGrid]   = useState<number>(1);
  const [paint, setPaint] = useState<boolean>(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const stepCount = scene?.length ?? 16;
  const visiblePitches = useMemo(
    () => Array.from({ length: ROWS_VISIBLE }, (_, i) => topPitch - i),
    [topPitch],
  );

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  const pitchRow = useMemo(() => {
    const m = new Map<number, number>();
    visiblePitches.forEach((p, i) => m.set(p, i));
    return m;
  }, [visiblePitches]);
  const notesInView = useMemo(
    () => notes.filter((n) => pitchRow.has(n.pitch)),
    [notes, pitchRow],
  );

  // ── Undo / Redo + Copy / Paste ───────────────────────────────────────────
  const undoStack = useRef<Note[][]>([]);
  const redoStack = useRef<Note[][]>([]);
  const clipboard = useRef<Note | null>(null);
  const [, bumpHist] = useState(0);
  const [hasClip, setHasClip] = useState(false);

  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const flashMsg = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 900);
  };

  const liveNotes = (): Note[] => {
    const st = useGroove.getState();
    const pat = st.patterns[st.selectedPattern];
    const sc = pat?.scenes[Math.min(st.selectedSceneIdx, (pat?.scenes.length ?? 1) - 1)];
    return ((sc?.partNotes[part?.id ?? -1] ?? []) as Note[]).map((n) => ({ ...n }));
  };
  const snapshotNotes = liveNotes;

  const commit = () => {
    undoStack.current.push(snapshotNotes());
    if (undoStack.current.length > 64) undoStack.current.shift();
    redoStack.current = [];
    bumpHist((v) => v + 1);
  };
  const undo = () => {
    if (!undoStack.current.length) return;
    redoStack.current.push(snapshotNotes());
    const prev = undoStack.current.pop()!;
    if (part) replaceNotes(part.id, prev);
    setSelectedNoteId(null);
    bumpHist((v) => v + 1);
    flashMsg("UNDO");
  };
  const redo = () => {
    if (!redoStack.current.length) return;
    undoStack.current.push(snapshotNotes());
    const next = redoStack.current.pop()!;
    if (part) replaceNotes(part.id, next);
    setSelectedNoteId(null);
    bumpHist((v) => v + 1);
    flashMsg("REDO");
  };
  const copyNote = () => {
    if (!selectedNote) return;
    clipboard.current = { ...selectedNote };
    setHasClip(true);
    flashMsg(`COPIED ${pitchLabel(selectedNote.pitch)}`);
  };
  const pasteNote = () => {
    if (!clipboard.current || !part) return;
    commit();
    const src = clipboard.current;
    const step = Math.min(stepCount - 1, (selectedNote?.step ?? src.step) + 1);
    const id = addNote(part.id, {
      step, pitch: src.pitch, length: src.length,
      velocity: src.velocity, micro: src.micro ?? 0,
    });
    setSelectedNoteId(id);
    flashMsg(`PASTED @ ${step + 1}`);
  };

  // Live context for the once-bound drag + keyboard listeners (refs → always
  // current without re-binding the listeners on every note change).
  const liveRef = useRef({ part, stepCount, notes, visiblePitches });
  liveRef.current = { part, stepCount, notes, visiblePitches };
  const dragRef = useRef<Drag>(null);

  // Reset history when the edited pattern, part or scene changes.
  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
    bumpHist((v) => v + 1);
  }, [part?.id, selectedSceneIdx, selectedPattern]);

  // ── Drag system (move / resize / paint) ───────────────────────────────────
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const L = liveRef.current; if (!L.part) return;
      const el = gridRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const cw = rect.width / L.stepCount;
      if (d.mode === "move") {
        const dStep  = Math.round((e.clientX - d.px) / cw);
        const dPitch = -Math.round((e.clientY - d.py) / ROW_PX);
        updateNote(L.part.id, d.noteId, {
          step:  Math.max(0, Math.min(L.stepCount - 1, d.startStep + dStep)),
          pitch: Math.max(0, Math.min(127, d.startPitch + dPitch)),
        });
      } else if (d.mode === "resize") {
        const dStep = Math.round((e.clientX - d.px) / cw);
        updateNote(L.part.id, d.noteId, {
          length: Math.max(0.25, Math.min(L.stepCount, d.startLen + dStep)),
        });
      } else if (d.mode === "paint") {
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        const st  = Math.max(0, Math.min(L.stepCount - 1, Math.floor((x / rect.width) * L.stepCount)));
        const row = Math.floor(y / ROW_PX);
        if (row < 0 || row >= ROWS_VISIBLE) return;
        const pitch = L.visiblePitches[row];
        const key = `${st}:${pitch}`;
        if (d.painted.has(key)) return;
        d.painted.add(key);
        const ex = L.notes.find((n) => n.step === st && n.pitch === pitch);
        if (ex) { selectStep(st); setSelectedNoteId(ex.id); return; }
        const id = addNote(L.part.id, { step: st, pitch, length: 1, velocity: 100, micro: 0 });
        selectStep(st);
        setSelectedNoteId(id);
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
  }, [updateNote, addNote]);

  // ── Keyboard: undo/redo/copy/paste (mod) + delete + nudge (no mod) ─────────
  const keyHandlers = useRef({ undo, redo, copyNote, pasteNote });
  keyHandlers.current = { undo, redo, copyNote, pasteNote };
  const editRef = useRef({ selectedNote, part, commit, removeNote, updateNote, stepCount });
  editRef.current = { selectedNote, part, commit, removeNote, updateNote, stepCount };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod) {
        if (k === "z" && !e.shiftKey) { e.preventDefault(); keyHandlers.current.undo(); }
        else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); keyHandlers.current.redo(); }
        else if (k === "c") { e.preventDefault(); keyHandlers.current.copyNote(); }
        else if (k === "v") { e.preventDefault(); keyHandlers.current.pasteNote(); }
        return;
      }
      const E = editRef.current;
      if (!E.selectedNote || !E.part) return;
      if (k === "delete" || k === "backspace") {
        e.preventDefault(); E.commit();
        E.removeNote(E.part.id, E.selectedNote.id);
        setSelectedNoteId(null);
      } else if (k === "arrowup") {
        e.preventDefault();
        E.updateNote(E.part.id, E.selectedNote.id, { pitch: Math.min(127, E.selectedNote.pitch + 1) });
      } else if (k === "arrowdown") {
        e.preventDefault();
        E.updateNote(E.part.id, E.selectedNote.id, { pitch: Math.max(0, E.selectedNote.pitch - 1) });
      } else if (k === "arrowright") {
        e.preventDefault();
        E.updateNote(E.part.id, E.selectedNote.id, { step: Math.min(E.stepCount - 1, E.selectedNote.step + 1) });
      } else if (k === "arrowleft") {
        e.preventDefault();
        E.updateNote(E.part.id, E.selectedNote.id, { step: Math.max(0, E.selectedNote.step - 1) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!pattern || !part || !scene) {
    return <div className="panel p-3 text-xs text-muted-foreground">No scene selected.</div>;
  }

  const cellAt = (clientX: number, clientY: number): { step: number; pitch: number } | null => {
    const el = gridRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left; const y = clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
    const step = Math.max(0, Math.min(stepCount - 1, Math.floor((x / r.width) * stepCount)));
    const row  = Math.floor(y / ROW_PX);
    if (row < 0 || row >= ROWS_VISIBLE) return null;
    return { step, pitch: visiblePitches[row] };
  };

  const onGridPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).dataset.noteid) return;
    const c = cellAt(e.clientX, e.clientY); if (!c) return;
    if (paint) {
      commit();
      const painted = new Set<string>(); painted.add(`${c.step}:${c.pitch}`);
      dragRef.current = { mode: "paint", painted };
      const ex = notes.find((n) => n.step === c.step && n.pitch === c.pitch);
      if (!ex) {
        const id = addNote(part.id, { step: c.step, pitch: c.pitch, length: 1, velocity: 100, micro: 0 });
        selectStep(c.step);
        setSelectedNoteId(id);
      } else {
        selectStep(c.step);
        setSelectedNoteId(ex.id);
      }
      return;
    }
    const existing = notes.find((n) => n.step === c.step && n.pitch === c.pitch);
    if (existing) { selectStep(c.step); setSelectedNoteId(existing.id); return; }
    commit();
    const id = addNote(part.id, { step: c.step, pitch: c.pitch, length: 1, velocity: 100, micro: 0 });
    selectStep(c.step);
    setSelectedNoteId(id);
  };

  const onNotePointerDown = (e: React.PointerEvent, n: Note) => {
    e.preventDefault(); e.stopPropagation();
    selectStep(n.step);
    setSelectedNoteId(n.id);
    const rect    = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nearRight = e.clientX > rect.right - 9;
    commit();
    if (nearRight) {
      dragRef.current = { mode: "resize", noteId: n.id, startLen: n.length, px: e.clientX, py: e.clientY };
    } else {
      dragRef.current = { mode: "move", noteId: n.id, startStep: n.step, startPitch: n.pitch, px: e.clientX, py: e.clientY };
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const clearScene = () => {
    commit();
    notes.forEach((n) => removeNote(part.id, n.id));
    setSelectedNoteId(null);
  };

  // ── Pattern navigation (compact mode) ─────────────────────────────────────
  const prevPattern = () => selectPattern(Math.max(0, selectedPattern - 1));
  const nextPattern = () => selectPattern(Math.min(patterns.length - 1, selectedPattern + 1));

  // ── Shared grid + note rendering ──────────────────────────────────────────
  const noteGrid = (
    <div className="panel p-1.5 relative scanline overflow-hidden">
      {/* Recording indicator — pulsing red ring when recording + playing */}
      {recording && playing && (
        <div className="absolute inset-0 rounded pointer-events-none z-30 border-2 border-neon-crimson animate-pulse" />
      )}
      <RollDrumLane partId={part.id} stepCount={stepCount} />
      <div className="flex">
        {/* Keyboard gutter */}
        <div className="shrink-0" style={{ width: 38 }}>
          {visiblePitches.map((p) => (
            <div
              key={p}
              onClick={() => {
                commit();
                const id = addNote(part.id, { step: 0, pitch: p, length: 1, velocity: 100, micro: 0 });
                setSelectedNoteId(id);
              }}
              className={cn(
                "border-b border-border/40 flex items-center px-1 font-mono text-[9px] cursor-pointer",
                isBlackKey(p) ? "bg-background/80 text-muted-foreground" : "bg-card text-foreground",
                p % 12 === 0 && "border-b-primary/40",
              )}
              style={{ height: ROW_PX }}
            >{pitchLabel(p)}</div>
          ))}
        </div>

        {/* Note grid */}
        <div
          ref={gridRef}
          onPointerDown={onGridPointerDown}
          className={cn("relative flex-1 touch-none select-none", paint && "cursor-crosshair")}
          style={{ height: ROW_PX * ROWS_VISIBLE }}
        >
          {selectedStep !== null && selectedStep < stepCount && (
            <div
              className="absolute top-0 bottom-0 bg-primary/10 border-x border-primary/40 pointer-events-none z-[1]"
              style={{
                left: `${(selectedStep / stepCount) * 100}%`,
                width: `${100 / stepCount}%`,
              }}
            />
          )}
          {visiblePitches.map((p, ri) => (
            <div
              key={p}
              className={cn(
                "absolute left-0 right-0 border-b border-border/30",
                isBlackKey(p) ? "bg-background/60" : "bg-card/30",
                p % 12 === 0 && "border-b-primary/30",
              )}
              style={{ top: ri * ROW_PX, height: ROW_PX }}
            />
          ))}
          {Array.from({ length: stepCount + 1 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "absolute top-0 bottom-0 pointer-events-none",
                i % 4 === 0 ? "bg-border/60 w-px" : "bg-border/25 w-px",
              )}
              style={{ left: `${(i / stepCount) * 100}%` }}
            />
          ))}
          <RollPlayhead
            selectedPattern={selectedPattern}
            selectedSceneIdx={selectedSceneIdx}
            sceneCount={pattern.scenes.length}
            stepCount={stepCount}
          />
          {notesInView.map((n) => (
            <NoteRect
              key={n.id}
              note={n}
              rowIdx={pitchRow.get(n.pitch)!}
              stepCount={stepCount}
              selected={n.id === selectedNoteId}
              onPointerDown={onNotePointerDown}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // COMPACT MODE — 8-parameter surface for the GROOVE module
  // ══════════════════════════════════════════════════════════════════════════
  if (compact) {
    return (
      <div className="space-y-2">
        {!hidePartStrip && <PartStrip />}

        {/* ── Compact header: Pattern | Quantize | Paint | Erase | Quant | ··· ── */}
        <div className="panel p-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* 1. Pattern navigation */}
          <div className="flex items-center gap-0.5 shrink-0 min-w-0">
            <button
              onClick={prevPattern}
              disabled={selectedPattern === 0}
              className="h-8 w-7 rounded panel-inset grid place-items-center text-muted-foreground disabled:opacity-30 shrink-0"
              aria-label="previous pattern"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="font-display text-[9px] text-primary text-center px-1 min-w-[3.5rem] leading-tight">
              {pattern.name}
            </span>
            <button
              onClick={nextPattern}
              disabled={selectedPattern === patterns.length - 1}
              className="h-8 w-7 rounded panel-inset grid place-items-center text-muted-foreground disabled:opacity-30 shrink-0"
              aria-label="next pattern"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="h-5 w-px bg-border/60 shrink-0" />

          {/* 2. Quantize grid */}
          <select
            value={grid}
            onChange={(e) => setGrid(Number(e.target.value))}
            className="h-8 px-1.5 rounded panel-inset font-mono text-[9px] text-primary bg-transparent outline-none shrink-0"
            aria-label="quantize grid"
          >
            <option value={1}>1st</option>
            <option value={0.5}>½st</option>
            <option value={0.25}>¼st</option>
            <option value={0.125}>⅛st</option>
          </select>

          {/* 3. Paint mode */}
          <button
            onClick={() => setPaint((p) => !p)}
            aria-pressed={paint}
            className={cn(
              "h-8 w-8 rounded panel-inset grid place-items-center shrink-0 transition-colors",
              paint ? "neon-border text-primary" : "text-muted-foreground",
            )}
            title="Paint mode — drag to sweep notes"
          >
            <Paintbrush className="h-3.5 w-3.5" />
          </button>

          {/* 4. Erase / Clear */}
          <button
            onClick={clearScene}
            className="h-8 w-8 rounded panel-inset grid place-items-center shrink-0 text-neon-crimson"
            title="Clear all notes in scene"
            aria-label="Clear scene"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>

          {/* 5. Snap to grid */}
          <button
            onClick={() => { commit(); quantizeNotes(part.id, grid); }}
            className="h-8 w-8 rounded panel-inset grid place-items-center shrink-0 text-neon-cyan"
            title="Quantize to grid"
            aria-label="Quantize"
          >
            <Magnet className="h-3.5 w-3.5" />
          </button>

          {/* BPM read-only display */}
          <div className="flex items-center gap-1 px-2 shrink-0">
            <span className="font-mono text-[7px] text-muted-foreground">BPM</span>
            <span className="font-display text-sm tabular-nums">{bpm.toFixed(0)}</span>
          </div>

          {/* Flash notification */}
          {flash && (
            <span className="px-2 py-0.5 rounded neon-border text-neon-cyan font-mono text-[9px] tracking-wider shrink-0">
              {flash}
            </span>
          )}

          {/* More toggle — reveals oct/scroll/undo/copy */}
          <button
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className={cn(
              "h-8 px-2 rounded panel-inset font-mono text-[9px] shrink-0 ml-auto transition-colors",
              moreOpen ? "neon-border text-primary" : "text-muted-foreground",
            )}
            aria-label="More controls"
          >
            ···
          </button>
        </div>

        {/* More panel — oct/scroll/undo/redo/copy/paste */}
        {moreOpen && (
          <div className="panel p-2 flex items-center gap-1.5 flex-wrap font-mono text-[9px]">
            <button onClick={() => setTopPitch((p) => Math.min(120, p + 12))}
              className="h-7 px-2 rounded panel-inset flex items-center gap-1">
              <Plus className="h-3 w-3" /> OCT+
            </button>
            <button onClick={() => setTopPitch((p) => Math.max(ROWS_VISIBLE + 7, p - 12))}
              className="h-7 px-2 rounded panel-inset flex items-center gap-1">
              <Minus className="h-3 w-3" /> OCT−
            </button>
            <button onClick={() => setTopPitch((p) => Math.min(120, p + 1))}
              className="h-7 px-2 rounded panel-inset">▲</button>
            <button onClick={() => setTopPitch((p) => Math.max(ROWS_VISIBLE + 7, p - 1))}
              className="h-7 px-2 rounded panel-inset">▼</button>
            <div className="h-5 w-px bg-border/60" />
            <button onClick={undo} disabled={!undoStack.current.length}
              className="h-7 px-2 rounded panel-inset flex items-center gap-1 disabled:opacity-30">
              <Undo2 className="h-3 w-3" /> UNDO
            </button>
            <button onClick={redo} disabled={!redoStack.current.length}
              className="h-7 px-2 rounded panel-inset flex items-center gap-1 disabled:opacity-30">
              <Redo2 className="h-3 w-3" /> REDO
            </button>
            <button onClick={copyNote} disabled={!selectedNote}
              className="h-7 px-2 rounded panel-inset flex items-center gap-1 text-neon-cyan disabled:opacity-30">
              <Copy className="h-3 w-3" /> COPY
            </button>
            <button onClick={pasteNote} disabled={!hasClip}
              className="h-7 px-2 rounded panel-inset flex items-center gap-1 text-neon-cyan disabled:opacity-30">
              <ClipboardPaste className="h-3 w-3" /> PASTE
            </button>
            <div className="ml-auto text-muted-foreground text-[8px]">
              {pitchLabel(visiblePitches[ROWS_VISIBLE - 1])}–{pitchLabel(visiblePitches[0])} · {notes.length} notes
            </div>
          </div>
        )}

        {/* Note grid */}
        {noteGrid}

        {/* ── Compact inspector: selected note + selected step automation ── */}
        <div className={cn(
          "panel p-2 transition-all",
          selectedStep !== null && selectedStep < stepCount ? "opacity-100" : "opacity-60",
        )}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[8px] text-muted-foreground">STEP AUTOMATION</span>
            <span className={cn(
              "font-display text-[10px] tabular-nums",
              selectedStep !== null && selectedStep < stepCount ? "text-primary" : "text-muted-foreground",
            )}>
              {selectedStep !== null && selectedStep < stepCount
                ? `STEP ${selectedStep + 1}/${stepCount}`
                : "tap a step"}
            </span>
          </div>
          {selectedStep !== null && selectedStep < stepCount && (
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="panel-inset px-2 py-1.5 border border-primary/50">
                <div className="flex items-center justify-between font-mono text-[8px] text-muted-foreground">
                  <span>FILT</span>
                  <span className="text-primary font-display text-[10px]">
                    {steps[selectedStep]?.filterCutoff ?? "—"}
                  </span>
                </div>
              </div>
              <div className="panel-inset px-2 py-1.5 border border-primary/50">
                <div className="flex items-center justify-between font-mono text-[8px] text-muted-foreground">
                  <span>PAN</span>
                  <span className="text-primary font-display text-[10px]">
                    {steps[selectedStep]?.panOffset === undefined
                      ? "—"
                      : `${steps[selectedStep].panOffset > 0 ? "+" : ""}${steps[selectedStep].panOffset}`}
                  </span>
                </div>
              </div>
            </div>
          )}
          {selectedNote ? (
            <div className="flex items-center gap-2">
              {/* 6. Note pitch display */}
              <div className="flex flex-col items-center leading-none shrink-0 w-10">
                <span className="font-mono text-[7px] text-muted-foreground">NOTE</span>
                <span className="font-display text-sm text-primary tabular-nums">
                  {pitchLabel(selectedNote.pitch)}
                </span>
                <span className="font-mono text-[7px] text-muted-foreground">
                  STEP {selectedNote.step + 1}
                </span>
              </div>

              <div className="h-8 w-px bg-border/60 shrink-0" />

              {/* 7. Velocity */}
              <div className="flex-1 flex items-center gap-1.5 min-w-0"
                onPointerDownCapture={() => commit()}>
                <span className="font-mono text-[8px] text-muted-foreground shrink-0">VEL</span>
                <input
                  type="range" min={1} max={127}
                  value={selectedNote.velocity}
                  onChange={(e) => updateNote(part.id, selectedNote.id, { velocity: Number(e.target.value) })}
                  className="flex-1 accent-primary min-w-0 touch-none"
                />
                <span className="font-display text-[10px] text-primary w-6 text-right tabular-nums shrink-0">
                  {selectedNote.velocity}
                </span>
              </div>

              {/* 8. Gate */}
              <div className="flex-1 flex items-center gap-1.5 min-w-0"
                onPointerDownCapture={() => commit()}>
                <span className="font-mono text-[8px] text-muted-foreground shrink-0">GATE</span>
                <input
                  type="range" min={0.25} max={Math.max(1, stepCount)} step={0.25}
                  value={selectedNote.length}
                  onChange={(e) => updateNote(part.id, selectedNote.id, { length: Number(e.target.value) })}
                  className="flex-1 accent-primary min-w-0 touch-none"
                />
                <span className="font-display text-[10px] text-primary w-8 text-right tabular-nums shrink-0">
                  {selectedNote.length.toFixed(2)}
                </span>
              </div>

              <div className="h-8 w-px bg-border/60 shrink-0" />

              <button
                onClick={() => { commit(); removeNote(part.id, selectedNote.id); setSelectedNoteId(null); }}
                className="h-8 w-8 rounded panel-inset grid place-items-center text-neon-crimson shrink-0"
                aria-label="Delete note"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setSelectedNoteId(null)}
                className="h-8 w-8 rounded panel-inset grid place-items-center text-muted-foreground shrink-0"
                aria-label="Deselect note"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="font-mono text-[9px] text-muted-foreground text-center py-0.5">
              tap a cell to add · drag to move/resize · Del to remove
            </p>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VERBOSE MODE — original full-featured layout (non-compact)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-3">
      {!hidePartStrip && <PartStrip />}

      {/* Header */}
      <div className="panel p-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary">
            ROLL · {pattern.name} · {part.name} · SCENE {Math.min(selectedSceneIdx, pattern.scenes.length - 1) + 1}/{pattern.scenes.length} · {stepCount} STEPS
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{notes.length} notes</div>
        </div>
        <div className="hairline mb-2" />
        <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
          <button
            onClick={() => setTopPitch((p) => Math.min(120, p + 12))}
            className="h-7 px-2 rounded panel-inset flex items-center gap-1 text-primary"
            aria-label="octave up"
          ><Plus className="h-3 w-3" /> OCT</button>
          <button
            onClick={() => setTopPitch((p) => Math.max(ROWS_VISIBLE + 7, p - 12))}
            className="h-7 px-2 rounded panel-inset flex items-center gap-1 text-primary"
            aria-label="octave down"
          ><Minus className="h-3 w-3" /> OCT</button>
          <button onClick={() => setTopPitch((p) => Math.min(120, p + 1))} className="h-7 px-2 rounded panel-inset text-muted-foreground" aria-label="scroll up">▲</button>
          <button onClick={() => setTopPitch((p) => Math.max(ROWS_VISIBLE + 7, p - 1))} className="h-7 px-2 rounded panel-inset text-muted-foreground" aria-label="scroll down">▼</button>
          <div className="h-7 w-px bg-border mx-1" />
          <label className="h-7 px-2 rounded panel-inset flex items-center gap-1 text-muted-foreground">
            <span className="uppercase">grid</span>
            <select
              value={grid}
              onChange={(e) => setGrid(Number(e.target.value))}
              className="bg-transparent text-primary font-display text-xs outline-none"
              aria-label="quantize grid"
            >
              <option value={1}>1 step</option>
              <option value={0.5}>1/2 step</option>
              <option value={0.25}>1/4 step</option>
              <option value={0.125}>1/8 step</option>
            </select>
          </label>
          <button
            onClick={() => setPaint((p) => !p)}
            aria-pressed={paint}
            className={cn(
              "h-7 px-2 rounded panel-inset flex items-center gap-1 transition-colors",
              paint ? "neon-border text-neon-cyan" : "text-muted-foreground",
            )}
            title="Paint mode — drag to sweep in notes"
          ><Paintbrush className="h-3 w-3" /> PAINT</button>
          <button
            onClick={() => { commit(); quantizeNotes(part.id, grid); }}
            className="h-7 px-2 rounded panel-inset flex items-center gap-1 text-neon-cyan"
          ><Magnet className="h-3 w-3" /> QUANT</button>
          <button
            onClick={clearScene}
            className="h-7 px-2 rounded panel-inset flex items-center gap-1 text-neon-crimson"
          ><Eraser className="h-3 w-3" /> CLR</button>
          <div className="h-7 w-px bg-border mx-1" />
          <button onClick={undo} disabled={undoStack.current.length === 0} className="h-7 w-7 rounded panel-inset grid place-items-center text-primary disabled:opacity-40" title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="h-3.5 w-3.5" /></button>
          <button onClick={redo} disabled={redoStack.current.length === 0} className="h-7 w-7 rounded panel-inset grid place-items-center text-primary disabled:opacity-40" title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 className="h-3.5 w-3.5" /></button>
          <button onClick={copyNote} disabled={!selectedNote} className="h-7 w-7 rounded panel-inset grid place-items-center text-neon-cyan disabled:opacity-40" title="Copy note (Ctrl+C)" aria-label="Copy note"><Copy className="h-3.5 w-3.5" /></button>
          <button onClick={pasteNote} disabled={!hasClip} className="h-7 w-7 rounded panel-inset grid place-items-center text-neon-cyan disabled:opacity-40" title="Paste note (Ctrl+V)" aria-label="Paste note"><ClipboardPaste className="h-3.5 w-3.5" /></button>
          {flash && (
            <span className="px-2 py-0.5 rounded neon-border text-neon-cyan font-mono text-[10px] tracking-wider">{flash}</span>
          )}
          <div className="ml-auto text-muted-foreground">
            View: {pitchLabel(visiblePitches[ROWS_VISIBLE - 1])} → {pitchLabel(visiblePitches[0])}
          </div>
        </div>
      </div>

      {/* Note grid */}
      {noteGrid}

      {/* Note inspector */}
      <div className={cn("panel p-3 transition-all", selectedNote ? "opacity-100" : "opacity-60")}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary">NOTE DETAILS</div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            {selectedNote ? (
              <>
                <span>{pitchLabel(selectedNote.pitch)} (MIDI {selectedNote.pitch})</span>
                <span>·</span>
                <span>STEP {selectedNote.step + 1}/{stepCount}</span>
                <button
                  onClick={() => { commit(); removeNote(part.id, selectedNote.id); setSelectedNoteId(null); }}
                  className="h-6 px-2 rounded panel-inset text-neon-crimson flex items-center gap-1"
                ><Trash2 className="h-3 w-3" /> DEL</button>
                <button onClick={() => setSelectedNoteId(null)} className="h-6 w-6 rounded panel-inset grid place-items-center"><X className="h-3 w-3" /></button>
              </>
            ) : <span>tap a cell to add — drag a note to move / resize — Del to remove</span>}
          </div>
        </div>

        {selectedNote && (
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono" onPointerDownCapture={(e) => { if ((e.target as HTMLElement).tagName === "INPUT") commit(); }}>
            <div className="panel-inset px-2 py-2">
              <div className="flex items-center justify-between text-muted-foreground uppercase">
                <span>pitch</span>
                <span className="text-primary font-display text-xs">{pitchLabel(selectedNote.pitch)}</span>
              </div>
              <input type="range" min={0} max={127} value={selectedNote.pitch}
                onChange={(e) => updateNote(part.id, selectedNote.id, { pitch: Number(e.target.value) })}
                className="w-full accent-primary mt-1 touch-none" />
            </div>
            <div className="panel-inset px-2 py-2">
              <div className="flex items-center justify-between text-muted-foreground uppercase">
                <span>step</span>
                <span className="text-primary font-display text-xs">{selectedNote.step + 1}</span>
              </div>
              <input type="range" min={0} max={stepCount - 1} value={selectedNote.step}
                onChange={(e) => updateNote(part.id, selectedNote.id, { step: Number(e.target.value) })}
                className="w-full accent-primary mt-1 touch-none" />
            </div>
            <div className="panel-inset px-2 py-2">
              <div className="flex items-center justify-between text-muted-foreground uppercase">
                <span>gate (steps)</span>
                <span className="text-primary font-display text-xs">{selectedNote.length.toFixed(2)}</span>
              </div>
              <input type="range" min={0.25} max={Math.max(1, stepCount)} step={0.25} value={selectedNote.length}
                onChange={(e) => updateNote(part.id, selectedNote.id, { length: Number(e.target.value) })}
                className="w-full accent-primary mt-1 touch-none" />
            </div>
            <div className="panel-inset px-2 py-2">
              <div className="flex items-center justify-between text-muted-foreground uppercase">
                <span>velocity</span>
                <span className="text-primary font-display text-xs">{selectedNote.velocity}</span>
              </div>
              <input type="range" min={1} max={127} value={selectedNote.velocity}
                onChange={(e) => updateNote(part.id, selectedNote.id, { velocity: Number(e.target.value) })}
                className="w-full accent-primary mt-1 touch-none" />
            </div>
            <div className="panel-inset px-2 py-2 col-span-2">
              <div className="flex items-center justify-between text-muted-foreground uppercase">
                <span>micro timing (±% of step · snap {grid * 100}%)</span>
                <span className="text-primary font-display text-xs">
                  {(selectedNote.micro ?? 0) > 0 ? "+" : ""}{selectedNote.micro ?? 0}
                </span>
              </div>
              <input
                type="range" min={-50} max={50} step={Math.max(1, Math.round(grid * 100))}
                value={selectedNote.micro ?? 0}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const snap = Math.max(1, Math.round(grid * 100));
                  const snapped = Math.max(-50, Math.min(50, Math.round(raw / snap) * snap));
                  updateNote(part.id, selectedNote.id, { micro: snapped });
                }}
                className="w-full accent-primary mt-1 touch-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
