import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  inferPerformanceInstrument,
  performanceAllNotesOff,
  performanceNoteOff,
  performanceNoteOn,
  type PerformanceInstrument,
} from "@/lib/runtime/performanceInput";
import { cn } from "@/lib/utils";

const KEYS = [
  { label: "C", semitone: 0, black: false },
  { label: "C#", semitone: 1, black: true },
  { label: "D", semitone: 2, black: false },
  { label: "D#", semitone: 3, black: true },
  { label: "E", semitone: 4, black: false },
  { label: "F", semitone: 5, black: false },
  { label: "F#", semitone: 6, black: true },
  { label: "G", semitone: 7, black: false },
  { label: "G#", semitone: 8, black: true },
  { label: "A", semitone: 9, black: false },
  { label: "A#", semitone: 10, black: true },
  { label: "B", semitone: 11, black: false },
  { label: "C", semitone: 12, black: false },
];

interface InstrumentKeyboardProps {
  partId: number;
  /** Explicit runtime route. If omitted it is derived from the canonical Part. */
  instrument?: PerformanceInstrument;
  title: string;
  baseOctave?: number;
  gateSec?: number;
  velocity?: number;
  className?: string;
}

interface PointerNote {
  midi: number;
  instrument: PerformanceInstrument;
  accepted: boolean;
  released: boolean;
}

export function InstrumentKeyboard({
  partId,
  instrument,
  title,
  baseOctave = 4,
  gateSec = 0.8,
  velocity = 110,
  className,
}: InstrumentKeyboardProps) {
  const [octave, setOctave] = useState(baseOctave);
  const [active, setActive] = useState<Set<number>>(() => new Set());
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const pointerNotes = useRef(new Map<number, PointerNote>());
  const disposed = useRef(false);

  const resolvedInstrument = () => instrument ?? inferPerformanceInstrument(partId);
  const noteFor = (semitone: number) => (octave + 1) * 12 + semitone;

  const addActive = (midi: number) => {
    if (disposed.current) return;
    setActive((prev) => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });
  };

  const removeActive = (midi: number) => {
    if (disposed.current) return;
    setActive((prev) => {
      if (!prev.has(midi)) return prev;
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  };

  const issueNoteOff = (note: PointerNote) => {
    performanceNoteOff({
      instrument: note.instrument,
      partId,
      midiNote: note.midi,
      velocity,
      gateSec,
    });
  };

  const play = async (pointerId: number, semitone: number) => {
    const midi = noteFor(semitone);
    const route = resolvedInstrument();

    // Reserve pointer ownership before any async runtime startup. Pointer-up
    // may arrive while ensureAudio()/activateNativeAudio() is still pending.
    const pending: PointerNote = { midi, instrument: route, accepted: false, released: false };
    pointerNotes.current.set(pointerId, pending);

    const result = await performanceNoteOn({
      instrument: route,
      partId,
      midiNote: midi,
      velocity,
      gateSec,
    });

    const current = pointerNotes.current.get(pointerId);
    // Pointer ids can be reused. Ignore an obsolete completion rather than
    // attaching it to a newer gesture.
    if (current !== pending) {
      if (result.accepted) issueNoteOff(pending);
      return;
    }

    if (!result.accepted) {
      pointerNotes.current.delete(pointerId);
      if (!disposed.current) {
        setRuntimeMessage(result.reason ?? "Performance input unavailable");
        removeActive(midi);
      }
      return;
    }

    pending.accepted = true;

    // A very short tap, cancellation or unmount may already have released the
    // pointer while runtime activation was awaiting. Never let the late note-on
    // become a hanging note.
    if (pending.released || disposed.current) {
      issueNoteOff(pending);
      pointerNotes.current.delete(pointerId);
      return;
    }

    if (!disposed.current) setRuntimeMessage(null);
    addActive(midi);
  };

  const releasePointer = (pointerId: number) => {
    const note = pointerNotes.current.get(pointerId);
    if (!note) return;
    note.released = true;
    removeActive(note.midi);

    if (!note.accepted) {
      // Async note-on completion will immediately issue note-off if accepted.
      return;
    }

    issueNoteOff(note);
    pointerNotes.current.delete(pointerId);
  };

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      const instruments = new Set<PerformanceInstrument>();
      for (const note of pointerNotes.current.values()) {
        note.released = true;
        instruments.add(note.instrument);
      }
      if (instruments.size === 0) instruments.add(resolvedInstrument());

      // Accepted notes are stopped immediately. Pending async notes keep their
      // map entry so their completion can observe released/disposed and issue
      // the matching note-off without touching React state.
      for (const route of instruments) performanceAllNotesOff(route, partId);
    };
  }, [instrument, partId]);

  return (
    <div className={cn("panel p-3", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="font-display text-xs text-primary">{title}</div>
          <div className="font-mono text-[8px] text-muted-foreground tracking-widest">TOUCH KEYBOARD · OCT {octave}</div>
          {runtimeMessage && (
            <div className="font-mono text-[8px] text-neon-amber mt-1" role="status">
              {runtimeMessage}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setOctave((v) => Math.max(1, v - 1))}
            className="h-8 w-8 grid place-items-center panel-inset rounded"
            aria-label="Octave down"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setOctave((v) => Math.min(7, v + 1))}
            className="h-8 w-8 grid place-items-center panel-inset rounded"
            aria-label="Octave up"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="hairline mb-3" />
      <div className="no-scrollbar overflow-x-auto touch-scroll-x -mx-1 px-1">
        <div className="flex gap-1 min-w-max select-none">
          {KEYS.map((key, index) => {
            const midi = noteFor(key.semitone);
            const isActive = active.has(midi);
            return (
              <button
                key={`${key.label}-${index}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  void play(e.pointerId, key.semitone);
                }}
                onPointerUp={(e) => releasePointer(e.pointerId)}
                onPointerCancel={(e) => releasePointer(e.pointerId)}
                onLostPointerCapture={(e) => releasePointer(e.pointerId)}
                className={cn(
                  "shrink-0 w-11 rounded-md border font-display transition-transform active:scale-95",
                  key.black
                    ? "h-20 bg-surface-0 border-primary/30 text-neon-violet"
                    : "h-28 bg-surface-2 border-border text-primary",
                  isActive && "neon-border translate-y-0.5",
                )}
              >
                <span className="block mt-auto mb-2 text-[10px]">{key.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
