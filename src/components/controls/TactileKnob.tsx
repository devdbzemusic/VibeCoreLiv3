// TactileKnob — Circular drag knob for touch and mouse.
//
// Interaction:
//   - Vertical pointer drag: drag up to increase, down to decrease
//   - Scroll wheel: fine adjustment
//   - Double-tap: reset to default value (if provided)
// Touch target: minimum 44 × 44 px (enforced by size prop).
// Haptic: fires navigator.vibrate(1) on value change when supported.

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface TactileKnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  defaultValue?: number;
  label?: string;
  /** Display string overrides the default numeric display. */
  display?: string;
  size?: "sm" | "md" | "lg";
  color?: "cyan" | "magenta" | "amber" | "lime";
  disabled?: boolean;
  className?: string;
}

const SIZES = { sm: 44, md: 56, lg: 72 } as const;
const COLORS: Record<string, string> = {
  cyan:    "hsl(188 100% 55%)",
  magenta: "hsl(320 100% 60%)",
  amber:   "hsl(38 100% 58%)",
  lime:    "hsl(140 100% 55%)",
};

function haptic() {
  try { navigator.vibrate?.(1); } catch { /* ignore */ }
}

export function TactileKnob({
  value, min = 0, max = 1, onChange,
  defaultValue, label, display,
  size = "md", color = "cyan", disabled = false, className,
}: TactileKnobProps) {
  const dragRef = useRef<{ startY: number; startNorm: number } | null>(null);
  const tapRef  = useRef<{ time: number; count: number }>({ time: 0, count: 0 });

  const px = SIZES[size];
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fillColor = COLORS[color] ?? COLORS.cyan;

  // Arc geometry: 220° sweep starting from lower-left (~220°)
  const START_DEG = 225;
  const SWEEP_DEG = 270;
  const r = px / 2 - 4;
  const cx = px / 2;
  const cy = px / 2;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const endDeg = START_DEG + SWEEP_DEG * norm;
  const sa = toRad(START_DEG);
  const ea = toRad(endDeg);
  const x1 = cx + r * Math.cos(sa);
  const y1 = cy + r * Math.sin(sa);
  const x2 = cx + r * Math.cos(ea);
  const y2 = cy + r * Math.sin(ea);
  const largeArc = SWEEP_DEG * norm > 180 ? 1 : 0;

  // Indicator dot on the arc end
  const dotX = cx + (r - 1) * Math.cos(ea);
  const dotY = cy + (r - 1) * Math.sin(ea);

  // ── Interaction handlers ──────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startNorm: norm };

    // Double-tap to reset
    const now = Date.now();
    if (now - tapRef.current.time < 350) {
      tapRef.current.count += 1;
    } else {
      tapRef.current.count = 1;
    }
    tapRef.current.time = now;
    if (tapRef.current.count >= 2 && defaultValue !== undefined) {
      onChange(defaultValue);
      haptic();
      dragRef.current = null;
    }
  }, [disabled, norm, defaultValue, onChange]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || disabled) return;
    const dy = dragRef.current.startY - e.clientY;
    // 120 px drag = full range; shift key = fine mode (÷10)
    const scale = e.shiftKey ? 1200 : 120;
    const newNorm = Math.max(0, Math.min(1, dragRef.current.startNorm + dy / scale));
    const newVal = min + newNorm * (max - min);
    onChange(newVal);
    haptic();
  }, [disabled, min, max, onChange]);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    const delta = -e.deltaY / (e.shiftKey ? 5000 : 500);
    const newNorm = Math.max(0, Math.min(1, norm + delta));
    onChange(min + newNorm * (max - min));
  }, [disabled, min, max, norm, onChange]);

  const displayVal = display ?? (
    max <= 1 ? `${Math.round(norm * 100)}` : `${Math.round(value)}`
  );

  return (
    <div className={cn("inline-flex flex-col items-center gap-1 select-none", className)}>
      <div
        role="slider"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        style={{ width: px, height: px, touchAction: "none", cursor: disabled ? "not-allowed" : "ns-resize" }}
        className="relative"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {/* Arc SVG */}
        <svg
          width={px} height={px}
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: disabled ? 0.4 : 1 }}
        >
          {/* Background track */}
          <path
            d={`M ${cx + r * Math.cos(sa)} ${cy + r * Math.sin(sa)} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(toRad(START_DEG + SWEEP_DEG))} ${cy + r * Math.sin(toRad(START_DEG + SWEEP_DEG))}`}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          {norm > 0.01 && (
            <path
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={fillColor}
              strokeWidth={3}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${fillColor})` }}
            />
          )}
          {/* Indicator dot */}
          <circle
            cx={dotX} cy={dotY} r={3}
            fill={fillColor}
            style={{ filter: `drop-shadow(0 0 4px ${fillColor})` }}
          />
        </svg>

        {/* Knob body */}
        <div
          className="ring-knob absolute rounded-full grid place-items-center"
          style={{
            inset: 8,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <span className="font-mono text-[8px] text-primary/80 tabular-nums leading-none pointer-events-none">
            {displayVal}
          </span>
        </div>
      </div>

      {label && (
        <span className="font-mono text-[7.5px] uppercase tracking-widest text-muted-foreground leading-none max-w-[3.5rem] text-center truncate">
          {label}
        </span>
      )}
    </div>
  );
}
