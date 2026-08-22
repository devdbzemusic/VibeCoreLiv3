// VibeCoreLiv3 — Pattern Chain Drawer
//
// Slide-up bottom sheet giving one-touch access to pattern and scene
// management from the Piano Roll view. Reuses the existing PatternBrowser
// and SceneManager without any modifications. Accessible in one swipe or
// one tap of the CHAIN button in the GROOVE module footer bar.
//
// Touch model:
//   • Swipe down anywhere in the drawer → closes (pointer capture on handle)
//   • Tap X / CLOSE → closes
//   • Content area scrolls independently

import { useRef } from "react";
import { PatternBrowser } from "./PatternBrowser";
import { SceneManager }   from "./SceneManager";
import { ChevronDown }    from "lucide-react";

export function PatternChainDrawer({ onClose }: { onClose: () => void }) {
  const startY = useRef<number | null>(null);

  // Swipe-down-to-close via the drag handle
  const onHandlePointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    if (e.clientY - startY.current > 60) { startY.current = null; onClose(); }
  };
  const onHandlePointerUp = () => { startY.current = null; };

  return (
    <div className="relative z-40 panel overflow-hidden animate-slide-up">
      {/* Drag handle */}
      <div
        data-testid="pattern-chain-drawer-handle"
        className="flex items-center justify-between px-3 py-2 cursor-ns-resize touch-none select-none"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        aria-label="Drag down to close"
      >
        <div className="font-display text-xs text-primary">PATTERN CHAIN</div>
        <div className="flex items-center gap-2">
          <div className="w-10 h-0.5 rounded-full bg-muted-foreground/40 mx-auto" />
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 w-7 rounded panel-inset grid place-items-center text-muted-foreground"
            aria-label="Close drawer"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="hairline" />

      {/* Content — scrollable */}
      <div className="overflow-y-auto no-scrollbar max-h-[60vh] space-y-2 p-3">
        <PatternBrowser />
        <SceneManager />
      </div>
    </div>
  );
}
