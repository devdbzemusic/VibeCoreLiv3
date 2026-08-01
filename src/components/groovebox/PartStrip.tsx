import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";

// Compact part selector strip — used inside several tabs.
export function PartStrip() {
  const { parts, selectedPart, selectPart } = useGroove();
  return (
    <div className="no-scrollbar -mx-3 px-3 overflow-x-auto">
      <div className="flex gap-1.5 min-w-max">
        {parts.map((p) => {
          const sel = p.id === selectedPart;
          return (
            <button
              key={p.id}
              onClick={() => selectPart(p.id)}
              className={cn(
                "relative h-10 min-w-[68px] px-2 rounded-md panel-inset flex flex-col items-start justify-center transition-all",
                sel && "neon-border",
                p.mute && "opacity-50"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full glow-dot"
                  style={{ color: `hsl(var(--${p.color}))`, background: `hsl(var(--${p.color}))` }}
                />
                <span className="font-mono text-[9px] text-muted-foreground">{String(p.id + 1).padStart(2, "0")}</span>
              </div>
              <span className="font-display text-[11px] leading-none mt-1 text-foreground">{p.name}</span>
              {p.solo && <span className="absolute top-0.5 right-1 font-mono text-[8px] text-neon-amber">S</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
