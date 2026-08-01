// VibeCore — Module Navigation (MASTERPROMPT spec).
//
// 12-module linear navigation:
//   HOME → GROOVE → ARP → 3D SYNTH → 3D BASS → SAMPLE FORGE →
//   FX MIX LAB → VOICE → REMIX → AI → bRAINWAVEz → SETTINGS
//
// Layout:
//   - Primary strip  (bottom): all 12 modules, thumb-scrollable
//   - Secondary strip (above): sub-tabs of the active module when > 1 tab
//
// Architecture: preserves the existing TabKey enum via a mapping layer.
// Each module maps to a primary TabKey and optional sub-tabs. The nav
// remembers the last active sub-tab per module so one tap always resumes
// where the user left off.

import { useRef } from "react";
import { useGroove, type TabKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Home, Layers, Repeat, Orbit, Zap, Disc, Sliders,
  Mic, Shuffle, Bot, Brain, Settings,
} from "lucide-react";

type Icon = React.ComponentType<{ className?: string }>;

interface SubTab { key: TabKey; label: string }
interface ModuleDef {
  id: string;
  shortLabel: string;
  icon: Icon;
  primaryTab: TabKey;
  subTabs?: SubTab[];
}

// ── Module definitions (canonical order per MASTERPROMPT) ─────────────────
const MODULES: ModuleDef[] = [
  { id: "HOME",      shortLabel: "HOME",  icon: Home,     primaryTab: "HOME" },
  {
    id: "GROOVE",    shortLabel: "GRV",   icon: Layers,   primaryTab: "SEQ",
    subTabs: [
      { key: "SEQ",   label: "SEQ"  },
      { key: "ROLL",  label: "ROLL" },
      { key: "PTN",   label: "PTN"  },
      { key: "SND",   label: "SND"  },
    ],
  },
  { id: "ARP",       shortLabel: "ARP",   icon: Repeat,   primaryTab: "ARP"   },
  { id: "SYNTH3D",   shortLabel: "SYN",   icon: Orbit,    primaryTab: "SYNTH3D" },
  { id: "BASS3D",    shortLabel: "BAS",   icon: Zap,      primaryTab: "BASS3D"  },
  { id: "FORGE",     shortLabel: "FRG",   icon: Disc,     primaryTab: "SMPL"    },
  {
    id: "FXLAB",     shortLabel: "FX",    icon: Sliders,  primaryTab: "FX",
    subTabs: [
      { key: "FX",   label: "FX"   },
      { key: "MIX",  label: "MIX"  },
      { key: "PROD", label: "PROD" },
    ],
  },
  { id: "VOICE",     shortLabel: "VOC",   icon: Mic,      primaryTab: "VOICE"   },
  {
    id: "REMIX",     shortLabel: "RMX",   icon: Shuffle,  primaryTab: "REMIX",
    subTabs: [
      { key: "REMIX", label: "REMIX" },
      { key: "PERF",  label: "PERF"  },
    ],
  },
  { id: "AI",        shortLabel: "AI",    icon: Bot,      primaryTab: "AI"      },
  {
    id: "BRAINWAVEZ",shortLabel: "BRN",   icon: Brain,    primaryTab: "BRN",
    subTabs: [
      { key: "BRN", label: "BRN" },
      { key: "SPC", label: "SPC" },
    ],
  },
  {
    id: "SETTINGS",  shortLabel: "⚙",     icon: Settings, primaryTab: "SETUP",
    subTabs: [
      { key: "SETUP", label: "SETUP" },
      { key: "SYNC",  label: "SYNC"  },
      { key: "DBG",   label: "DIAG"  },
      { key: "LIB",   label: "LIB"   },
    ],
  },
];

// Reverse map: any TabKey → parent module id
const TAB_TO_MODULE_ID = new Map<TabKey, string>();
for (const m of MODULES) {
  TAB_TO_MODULE_ID.set(m.primaryTab, m.id);
  m.subTabs?.forEach((s) => TAB_TO_MODULE_ID.set(s.key, m.id));
}

// ── Component ────────────────────────────────────────────────────────────────
export function TabBar() {
  const { tab, setTab } = useGroove();
  const activeModId = TAB_TO_MODULE_ID.get(tab) ?? "GROOVE";
  const activeMod = MODULES.find((m) => m.id === activeModId)!;
  const hasSubTabs = (activeMod.subTabs?.length ?? 0) > 1;

  // Persist the last-active sub-tab per module so tapping a module hub
  // resumes the user's previous sub-tab rather than always defaulting.
  const lastTab = useRef(new Map<string, TabKey>());
  lastTab.current.set(activeModId, tab);

  const tapModule = (mod: ModuleDef) => {
    const remembered = lastTab.current.get(mod.id);
    setTab(remembered ?? mod.primaryTab);
  };

  return (
    <nav
      className="sticky bottom-0 z-30 border-t border-border bg-gradient-surface/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.25rem)]"
      aria-label="Module navigation"
    >
      {/* Sub-tab strip — context-dependent, only shown when > 1 sub-tab */}
      {hasSubTabs && activeMod.subTabs && (
        <>
          <div className="px-2 pt-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="font-mono text-[8px] tracking-widest text-muted-foreground/60 pr-1 shrink-0 uppercase">
                {activeMod.shortLabel}
              </span>
              {activeMod.subTabs.map((st) => {
                const on = tab === st.key;
                return (
                  <button
                    key={st.key}
                    onClick={() => { lastTab.current.set(activeModId, st.key); setTab(st.key); }}
                    data-active={on}
                    aria-pressed={on}
                    className={cn(
                      "tab-pill shrink-0 px-3 py-2.5 rounded-md font-display text-[10px] tracking-wider transition-colors touch-none",
                      on ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hw-divider mx-2 my-1 opacity-50" />
        </>
      )}

      {/* Primary module strip (12 modules, horizontally scrollable) */}
      <div className="overflow-x-auto no-scrollbar px-1 py-1.5">
        <div className="flex items-stretch gap-0.5 min-w-max">
          {MODULES.map((mod) => {
            const active = mod.id === activeModId;
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => tapModule(mod)}
                data-active={active}
                aria-pressed={active}
                aria-label={mod.id.toLowerCase()}
                className={cn(
                  "tab-pill flex flex-col items-center justify-center gap-0.5",
                  "min-w-[2.9rem] px-2 py-1.5 transition-colors touch-none select-none",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="hw-led mb-0.5" data-on={active} data-tone="cyan" />
                <Icon className="h-[1.1rem] w-[1.1rem]" />
                <span className="font-display text-[7.5px] leading-none tracking-widest">
                  {mod.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
