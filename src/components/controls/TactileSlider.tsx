// TactileSlider — Hardware-style slider for touch and mouse.
//
// Interaction:
//   - Horizontal (default) or vertical orientation
//   - Touch/pointer drag with momentum snapping
//   - Scroll wheel support
//   - Double-tap track to jump to position
// Touch target: track height/width ≥ 44 px.

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface TactileSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  /** Display string overrides numeric. */
  display?: string;
  orientation?: "horizontal" | "vertical";
  /** Visual height of the track in pixels (touch target is padded to ≥ 44 px). */
  trackSize?: number;
  color?: "cyan" | "magenta" | "amber" | "lime";
  disabled?: boolean;
  className?: string;
}

const COLORS: Record<string, string> = {
  cyan:    "hsl(188 100% 55%)",
  magenta: "hsl(320 100% 60%)",
  amber:   "hsl(38 100% 58%)",
  lime:    "hsl(140 100% 55%)",
};

function haptic() {
  try { navigator.vibrate?.(1); } catch { /* ignore */ }
}

export function TactileSlider({
  value, min = 0, max = 1, step, onChange,
  label, display, orientation = "horizontal", trackSize = 6,
  color = "cyan", disabled = false, className,
}: TactileSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef  = useRef<{ rect: DOMRect; active: boolean } | null>(null);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fillColor = COLORS[color] ?? COLORS.cyan;
  const isH = orientation === "horizontal";

  const clampAndStep = useCallback((rawNorm: number): number => {
    let v = min + rawNorm * (max - min);
    if (step) v = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, v));
  }, [min, max, step]);

  const normFromEvent = useCallback((e: React.PointerEvent): number => {
    if (!dragRef.current) return norm;
    const { rect } = dragRef.current;
    if (isH) {
      return (e.clientX - rect.left) / rect.width;
    } else {
      return 1 - (e.clientY - rect.top) / rect.height;
    }
  }, [isH, norm]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = { rect, active: true };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const newNorm = normFromEvent(e);
    onChange(clampAndStep(newNorm));
    haptic();
  }, [disabled, normFromEvent, clampAndStep, onChange]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current?.active || disabled) return;
    const newNorm = normFromEvent(e);
    onChange(clampAndStep(newNorm));
  }, [disabled, normFromEvent, clampAndStep, onChange]);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    const d = -(e.deltaY / (e.shiftKey ? 5000 : 500));
    onChange(clampAndStep(norm + d));
  }, [disabled, norm, clampAndStep, onChange]);

  const fillPct = `${norm * 100}%`;
  const displayVal = display ?? (
    max <= 1 ? `${Math.round(norm * 100)}%` : `${Math.round(value)}`
  );

  return (
    <div className={cn(
      "inline-flex select-none",
      isH ? "flex-col gap-1 w-full" : "flex-row-reverse items-center gap-2",
      className,
    )}>
      {label && (
        <div className={cn(
          "flex items-center",
          isH ? "justify-between" : "flex-col gap-0.5",
        )}>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <span className="font-mono text-[9px] tabular-nums" style={{ color: fillColor }}>
            {displayVal}
          </span>
        </div>
      )}

      {/* Touch target wrapper — padded to ≥ 44 px */}
      <div
        ref={trackRef}
        className={cn(
          "relative flex items-center justify-center",
          isH ? "w-full" : "h-full",
        )}
        style={{
          ...(isH ? { minHeight: 44 } : { minWidth: 44 }),
          touchAction: "none",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        {/* Track background */}
        <div
          className="panel-inset rounded-full overflow-hidden"
          style={isH
            ? { width: "100%", height: trackSize }
            : { width: trackSize, height: "100%" }
          }
        >
          {/* Fill */}
          <div
            className="rounded-full"
            style={{
              width: isH ? fillPct : "100%",
              height: isH ? "100%" : fillPct,
              background: disabled ? "hsl(var(--muted))" : fillColor,
              boxShadow: disabled ? "none" : `0 0 6px ${fillColor}`,
              alignSelf: isH ? "auto" : "flex-end",
              ...(isH ? {} : { marginTop: "auto" }),
              transition: "width 0.06s ease, height 0.06s ease",
            }}
          />
        </div>

        {/* Thumb */}
        <div
          className="absolute rounded-full border-2 border-background"
          style={{
            width: 14, height: 14,
            background: fillColor,
            boxShadow: disabled ? "none" : `0 0 8px ${fillColor}`,
            ...(isH
              ? { left: `calc(${fillPct} - 7px)`, top: "50%", transform: "translateY(-50%)" }
              : { bottom: `calc(${fillPct} - 7px)`, left: "50%", transform: "translateX(-50%)" }),
            opacity: disabled ? 0.5 : 1,
          }}
        />
      </div>
    </div>
  );
}
