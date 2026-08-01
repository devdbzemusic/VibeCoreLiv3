import { useCallback, useRef, useState } from "react";

/**
 * Hidden trigger for the diagnostics overlay.
 *
 * - 5× tap on the version chip (within 1.5s between taps)
 * - Long-press on the logo (>3000ms)
 *
 * Returns handlers + the modal open state.
 */
export function useDiagnosticsTrigger() {
  const [open, setOpen] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);
  const pressTimerRef = useRef<number | null>(null);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  // ---- 5× tap on version ----
  const onVersionTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current != null) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
      tapTimerRef.current = null;
    }, 1500);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (tapTimerRef.current != null) window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setOpen(true);
    }
  }, []);

  // ---- Long-press on logo (>3s) ----
  const startPress = useCallback(() => {
    if (pressTimerRef.current != null) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      setOpen(true);
    }, 3000);
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimerRef.current != null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const logoHandlers = {
    onPointerDown: startPress,
    onPointerUp: cancelPress,
    onPointerLeave: cancelPress,
    onPointerCancel: cancelPress,
  };

  return { open, openModal, closeModal, onVersionTap, logoHandlers };
}
