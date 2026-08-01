import { useState } from "react";
import { useGroovePresets } from "@/lib/groovePresets";
import { Save, Trash2, FolderOpen, Library } from "lucide-react";

export function GroovePresetLibrary() {
  const { presets, savePreset, loadPreset, deletePreset } = useGroovePresets();
  const [name, setName] = useState("");

  const save = () => {
    savePreset(name || `Preset ${presets.length + 1}`);
    setName("");
  };

  return (
    <div className="panel p-3">
      <div className="font-display text-xs text-primary flex items-center gap-2 mb-2">
        <Library className="h-3.5 w-3.5" /> GROOVE PRESETS
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{presets.length} saved</span>
      </div>
      <div className="hairline mb-2" />

      <div className="flex gap-1.5 mb-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name…"
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          className="flex-1 h-9 px-2 panel-inset rounded font-mono text-[10px] bg-transparent outline-none focus:neon-border"
        />
        <button
          onClick={save}
          className="h-9 px-3 rounded bg-gradient-primary text-primary-foreground font-display text-[10px] flex items-center gap-1 shrink-0"
        >
          <Save className="h-3.5 w-3.5" /> SAVE
        </button>
      </div>

      {presets.length === 0 ? (
        <div className="font-mono text-[10px] text-muted-foreground py-4 text-center">
          No presets yet — save your current groove to recall it anytime.
        </div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto no-scrollbar">
          {presets.map((p) => (
            <div key={p.id} className="panel-inset rounded p-1.5 flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <div className="font-display text-[11px] truncate">{p.name}</div>
                <div className="font-mono text-[8px] text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString()} · {p.snapshot.bpm?.toFixed?.(1) ?? "—"} BPM
                </div>
              </div>
              <button
                onClick={() => loadPreset(p.id)}
                className="h-7 px-2 rounded panel-inset font-mono text-[9px] text-neon-lime flex items-center gap-1 shrink-0"
              >
                <FolderOpen className="h-3 w-3" /> LOAD
              </button>
              <button
                onClick={() => deletePreset(p.id)}
                className="h-7 w-7 grid place-items-center rounded panel-inset text-destructive shrink-0"
                aria-label={`Delete ${p.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}