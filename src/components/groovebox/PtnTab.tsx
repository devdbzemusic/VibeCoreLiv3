import { useState } from "react";
import { useGroove } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Activity, Pencil, Power, Trash2 } from "lucide-react";
import {
  MOD_SOURCES, MOD_DEST_PARAMS, MOD_CURVES,
  partAndParamLabel,
  type ModCurve, type ModDestParam, type ModRoute, type ModSource,
} from "@/lib/model";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { PatternBrowser } from "./PatternBrowser";
import { SceneManager } from "./SceneManager";

export function PtnTab() {
  return (
    <div className="space-y-3">
      <PatternBrowser />
      <SceneManager />
      <ModMatrix />
    </div>
  );
}

function ModMatrix() {
  const {
    mod, parts, selectedMod, selectMod,
    addModRoute, updateModRoute, removeModRoute, toggleModRoute,
    modActive,
  } = useGroove();

  const [editing, setEditing] = useState<ModRoute | null>(null);

  const openNew = () => {
    const id = addModRoute({});
    const route = useGroove.getState().mod.find((r) => r.id === id);
    if (route) setEditing(route);
  };
  const openEdit = (r: ModRoute) => { selectMod(r.id); setEditing(r); };
  const commit = (patch: Partial<ModRoute>) => {
    if (!editing) return;
    updateModRoute(editing.id, patch);
    setEditing({ ...editing, ...patch });
  };

  return (
    <>
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display text-xs text-primary flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> MODULATION MATRIX
            <span className="font-mono text-[9px] text-muted-foreground">{modActive} ACTIVE</span>
          </div>
          <button
            onClick={openNew}
            className="h-7 px-2 panel-inset rounded font-mono text-[10px] active:scale-95 transition-transform touch-none"
          >+ ROUTE</button>
        </div>
        <div className="hairline mb-2" />
        <div className="space-y-1.5">
          {mod.length === 0 && (
            <div className="font-mono text-[10px] text-muted-foreground text-center py-4">
              No routes. Tap +ROUTE to add modulation.
            </div>
          )}
          {mod.map((m) => {
            const sel = selectedMod === m.id;
            return (
              <div
                key={m.id}
                onClick={() => selectMod(m.id)}
                className={cn(
                  "panel-inset rounded p-2 flex items-center gap-2 cursor-pointer touch-none",
                  sel && "neon-border",
                  !m.enabled && "opacity-50",
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleModRoute(m.id); }}
                  className={cn("h-6 w-6 panel-inset rounded grid place-items-center shrink-0", m.enabled && "text-primary")}
                  aria-label="toggle route"
                ><Power className="h-3 w-3" /></button>
                <div className="font-mono text-[9px] text-neon-cyan w-14 shrink-0">{m.source}</div>
                <div className="text-muted-foreground">→</div>
                <div className="font-mono text-[9px] flex-1 truncate text-foreground">
                  {partAndParamLabel(parts, m)}
                </div>
                <div className="relative h-1 w-16 bg-surface-0 rounded overflow-hidden shrink-0">
                  <div
                    className={cn("absolute top-0 bottom-0", m.amount >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-neon-crimson")}
                    style={{ width: `${Math.abs(m.amount) / 2}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-muted-foreground" />
                </div>
                <div className="font-display text-[10px] text-primary w-8 text-right">{m.amount > 0 ? "+" : ""}{m.amount}</div>
                <div className="font-mono text-[8px] text-muted-foreground uppercase w-6">{m.curve}</div>
                <button onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="h-6 w-6 panel-inset rounded grid place-items-center shrink-0" aria-label="edit route"><Pencil className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); removeModRoute(m.id); }} className="h-6 w-6 panel-inset rounded grid place-items-center shrink-0 text-neon-crimson" aria-label="delete route"><Trash2 className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <div className="font-mono text-[9px] text-muted-foreground mb-1">SOURCES</div>
          <div className="flex flex-wrap gap-1">
            {MOD_SOURCES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  const id = addModRoute({ source: s });
                  const route = useGroove.getState().mod.find((r) => r.id === id);
                  if (route) setEditing(route);
                }}
                className="px-2 py-1 panel-inset rounded font-mono text-[9px] text-neon-cyan active:scale-95 touch-none"
              >{s}</button>
            ))}
          </div>
        </div>
      </div>

      <RouteEditor
        route={editing}
        onClose={() => setEditing(null)}
        onChange={commit}
        onDelete={() => { if (editing) { removeModRoute(editing.id); setEditing(null); } }}
      />
    </>
  );
}

function RouteEditor({
  route, onClose, onChange, onDelete,
}: {
  route: ModRoute | null;
  onClose: () => void;
  onChange: (patch: Partial<ModRoute>) => void;
  onDelete: () => void;
}) {
  const parts = useGroove((s) => s.parts);
  if (!route) return null;
  return (
    <Dialog open={!!route} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-background border-primary/40">
        <DialogHeader>
          <DialogTitle className="font-display text-primary text-sm">EDIT MOD ROUTE</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground mb-1">SOURCE</div>
            <div className="grid grid-cols-3 gap-1">
              {MOD_SOURCES.map((s: ModSource) => (
                <button
                  key={s}
                  onClick={() => onChange({ source: s })}
                  className={cn("h-8 panel-inset rounded font-mono text-[10px] touch-none active:scale-95", route.source === s && "neon-border text-primary")}
                >{s}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] text-muted-foreground mb-1">TARGET PART</div>
            <div className="grid grid-cols-4 gap-1">
              {parts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onChange({ partId: p.id })}
                  className={cn("h-8 panel-inset rounded font-mono text-[9px] truncate touch-none active:scale-95", route.partId === p.id && "neon-border text-primary")}
                >{p.name}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] text-muted-foreground mb-1">DESTINATION</div>
            <div className="grid grid-cols-3 gap-1">
              {MOD_DEST_PARAMS.map((d: ModDestParam) => (
                <button
                  key={d}
                  onClick={() => onChange({ destParam: d })}
                  className={cn("h-8 panel-inset rounded font-mono text-[9px] touch-none active:scale-95", route.destParam === d && "neon-border text-primary")}
                >{d}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="font-mono text-[10px] text-muted-foreground">AMOUNT</div>
              <div className="font-display text-xs text-primary">{route.amount > 0 ? "+" : ""}{route.amount}</div>
            </div>
            <Slider min={-100} max={100} step={1} value={[route.amount]} onValueChange={(v) => onChange({ amount: v[0] })} />
          </div>

          <div>
            <div className="font-mono text-[10px] text-muted-foreground mb-1">CURVE</div>
            <div className="grid grid-cols-4 gap-1">
              {MOD_CURVES.map((c: ModCurve) => (
                <button
                  key={c}
                  onClick={() => onChange({ curve: c })}
                  className={cn("h-8 panel-inset rounded font-mono text-[10px] uppercase touch-none active:scale-95", route.curve === c && "neon-border text-primary")}
                >{c}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] text-muted-foreground">ENABLED</div>
            <button
              onClick={() => onChange({ enabled: !route.enabled })}
              className={cn("h-8 px-3 panel-inset rounded font-mono text-[10px] touch-none active:scale-95", route.enabled && "neon-border text-primary")}
            >{route.enabled ? "ON" : "OFF"}</button>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <button onClick={onDelete} className="flex-1 h-9 panel-inset rounded font-mono text-[10px] text-neon-crimson touch-none active:scale-95">DELETE</button>
          <button onClick={onClose} className="flex-1 h-9 panel-inset rounded font-mono text-[10px] text-primary neon-border touch-none active:scale-95">DONE</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}