// TactileButton — Hardware-style touch button.
//
// Variants:
//   default  — panel-inset; secondary action
//   primary  — neon primary gradient; main action
//   active   — highlighted panel-inset; toggle-on state
//   record   — crimson neon; destructive/recording
//   danger   — crimson; irreversible action
//
// Touch target: minimum 44 × 44 px enforced by min-height/min-width.
// Haptic feedback fires on press.

import { useCallback } from "react";
import { cn } from "@/lib/utils";

export interface TactileButtonProps {
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "active" | "record" | "danger";
  /** Icon displayed left of label. */
  icon?: React.ReactNode;
  /** Controlled active/on state (for toggle use). */
  active?: boolean;
  disabled?: boolean;
  /** "sm" = 32 px min-height (use sparingly), "md" = 44 px, "lg" = 52 px */
  size?: "sm" | "md" | "lg";
  /** Full-width block button. */
  block?: boolean;
  className?: string;
  "aria-label"?: string;
}

const MIN_H = { sm: 32, md: 44, lg: 52 } as const;

function haptic() {
  try { navigator.vibrate?.(3); } catch { /* ignore */ }
}

export function TactileButton({
  label, onClick, variant = "default",
  icon, active = false, disabled = false,
  size = "md", block = false, className,
  "aria-label": ariaLabel,
}: TactileButtonProps) {
  const handleClick = useCallback(() => {
    if (disabled) return;
    haptic();
    onClick();
  }, [disabled, onClick]);

  const effectiveVariant = active && variant === "default" ? "active" : variant;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-pressed={variant === "active" || active ? active : undefined}
      className={cn(
        // Base
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-display text-[10px] tracking-wider uppercase",
        "transition-all duration-100 select-none touch-none active:scale-95",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        block && "w-full",

        // Size
        size === "sm" && "px-2.5 py-1",
        size === "md" && "px-3 py-2",
        size === "lg" && "px-4 py-3",

        // Variant styles
        effectiveVariant === "default" && "panel-inset text-muted-foreground hover:text-foreground",
        effectiveVariant === "primary" && [
          "bg-gradient-primary text-primary-foreground",
          "shadow-glow-primary hover:shadow-[0_0_20px_hsl(195_100%_55%/0.7)]",
        ],
        effectiveVariant === "active" && "panel-inset neon-border text-primary",
        effectiveVariant === "record" && [
          "panel-inset neon-border text-neon-crimson",
          active && "animate-pulse-neon",
        ],
        effectiveVariant === "danger" && "panel-inset text-neon-crimson hover:bg-neon-crimson/10",

        className,
      )}
      style={{ minHeight: MIN_H[size], minWidth: MIN_H[size] }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </button>
  );
}
