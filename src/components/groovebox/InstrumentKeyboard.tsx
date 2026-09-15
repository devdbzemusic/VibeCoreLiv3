import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ensureAudio, getCtx, triggerPart } from "@/lib/audio/engine";
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
  title: string;
  baseOctave?: number;
  gateSec?: number;
  velocity?: number;
  className?: string;
}

export function InstrumentKeyboard({
  partId,
  title,
  baseOctave = 4,
  gateSec = 0.8,
  velocity = 110,
  className,
}: InstrumentKeyboardProps) {
  const [octave, setOctave] = useState(baseOctave);
  const [active, setActive] = useState<number | null>(null);

  const play = async (semitone: number) => {
    setActive(semitone);
    await ensureAudio();
    const ctx = getCtx();
    if (!ctx) return;
    const midi = (octave + 1) * 12 + semitone;
    triggerPart(partId, ctx.currentTime, {
      velocity,
      semitone: midi - 60,
      gateSec,
    });
  };

  return (
    <div className={cn("panel p-3", className)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <div className="font-display text-xs text-primary">{title}</div>
          <div className="font-mono text-[8px] text-muted-foreground tracking-widest">TOUCH KEYBOARD · OCT {octave}</div>
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
            const isActive = active === key.semitone;
            return (
              <button
                key={`${key.label}-${index}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  void play(key.semitone);
                }}
                onPointerUp={() => setActive(null)}
                onPointerCancel={() => setActive(null)}
                onPointerLeave={() => setActive(null)}
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
