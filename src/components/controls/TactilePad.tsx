// TactilePad — Large pressure-sensitive touch pad.
//
// Interaction:
//   - Fires onPress(velocity) on pointerdown; velocity derived from pointer
//     pressure when available (Web API), otherwise defaults to 0.8.
//   - Fires onRelease on pointerup/cancel.
//   - Visual: dim → bright on press; glow ring during hold.
// Touch target: minimum 44 × 44 px; typical sizes 64–96 px.

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export interface TactilePadProps {
  /** Whether the pad shows an "active/on" state (e.g. step is enabled). */
  active?: boolean;
  onPress?: (velocity: number) => void;
  onRelease?: () => void;
  label?: string;
  /** Small badge in the corner (e.g. step number). */
  badge?: string | number;
  color?: "cyan" | "magenta" | "amber" | "lime" | "crimson";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

const SIZES = { sm: 44, md: 64, lg: 88 } as const;
const BG_COLORS: Record<string, string> = {
  cyan:    "hsl(188 100% 55%)",
  magenta: "hsl(320 100% 60%)",
  amber:   "hsl(38 100% 58%)",
  lime:    "hsl(140 100% 55%)",
  crimson: "hsl(350 100% 60%)",
};

function haptic(ms = 4) {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}

export function TactilePad({
  active = false, onPress, onRelease,
  label, badge, color = "cyan", size = "md",
  disabled = false, className,
}: TactilePadProps) {
  const [pressed, setPressed] = useState(false);
  const px = SIZES[size];
  const fillColor = BG_COLORS[color] ?? BG_COLORS.cyan;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPressed(true);
    // Use pointer pressure if available (0..1), otherwise use default 0.8
    const vel = (e.pressure > 0 && e.pressure < 1) ? e.pressure : 0.8;
    onPress?.(vel);
    haptic(6);
  }, [disabled, onPress]);

  const onPointerUp = useCallback(() => {
    if (!pressed) return;
    setPressed(false);
    onRelease?.();
    haptic(2);
  }, [pressed, onRelease]);

  return (
    <div
      className={cn(
        "pad relative grid place-items-center select-none touch-none",
        "transition-all duration-75",
        disabled && "opacity-40 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className,
      )}
      style={{
        width: px, height: px,
        minWidth: px, minHeight: px,
        borderColor: active || pressed ? fillColor : undefined,
        boxShadow: pressed
          ? `0 0 20px ${fillColor}, inset 0 0 8px ${fillColor}40`
          : active
            ? `0 0 12px ${fillColor}80`
            : undefined,
        background: pressed || active
          ? `linear-gradient(145deg, ${fillColor}30, ${fillColor}10)`
          : undefined,
        transform: pressed ? "scale(0.94)" : "scale(1)",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      role="button"
      aria-pressed={active}
      aria-label={label}
      aria-disabled={disabled}
    >
      {/* Active LED dot */}
      {active && (
        <div
          className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
          style={{
            background: fillColor,
            boxShadow: `0 0 6px ${fillColor}`,
          }}
        />
      )}

      {/* Badge (e.g. step number) */}
      {badge !== undefined && (
        <span
          className="absolute top-1 left-1.5 font-mono text-[7px] leading-none"
          style={{ color: active ? fillColor : "hsl(var(--muted-foreground))" }}
        >
          {badge}
        </span>
      )}

      {/* Label */}
      {label && (
        <span
          className="font-display text-[8px] uppercase tracking-wider leading-none"
          style={{ color: active || pressed ? fillColor : "hsl(var(--muted-foreground))" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
