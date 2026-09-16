import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
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
  /** Explicit runtime instrument route. Omitted = generic part route. */
  instrument?: PerformanceInstrument;
  title: string;
  baseOctave?: number;
  gateSec?: number;
  velocity?: number;
  className?: string;
}

export function InstrumentKeyboard({
  partId,
  instrument = "part",
  title,
  baseOctave = 4,
  gateSec = 0.8,
  velocity = 110,
  className,
}: InstrumentKeyboardProps) {
  const [octave, setOctave] = useState(baseOctave);
  const [active, setActive] = useState<Set<number>>(() => new Set());
  const [runtimeMessage, setRuntimeMessage] = useState<string | null>(null);
  const activePointers = useRef(new Map<number, number>());

  const noteFor = (semitone: number) => (octave + 1) * 12 + semitone;

  const addActive = (midi: number) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });
  };

  const removeActive = (midi: number) => {
    setActive((prev) => {
      if (!prev.has(midi)) return prev;
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  };

  const play = async (pointerId: number, semitone: number) => {
    const midi = noteFor(semitone);
    const result = await performanceNoteOn({
      instrument,
      partId,
      midiNote: midi,
      velocity,
      gateSec,
    });

    if (!result.accepted) {
      setRuntimeMessage(result.reason ?? "Performance input unavailable");
      activePointers.current.delete(pointerId);
      removeActive(midi);
      return;
    }

    setRuntimeMessage(null);
    activePointers.current.set(pointerId, midi);
    addActive(midi);
  };

  const releasePointer = (pointerId: number) => {
    const midi = activePointers.current.get(pointerId);
    if (midi == null) return;
    activePointers.current.delete(pointerId);
    performanceNoteOff({ instrument, partId, midiNote: midi, velocity, gateSec });
    removeActive(midi);
  };

  // A tab switch/unmount must never leave native sustained notes behind.
  useEffect(() => () => {
    activePointers.current.clear();
    performanceAllNotesOff(instrument);
  }, [instrument]);

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
