import { useRef } from "react";
import { useGroove, type TabKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Activity, Bot, Brain, Disc, FlaskConical, Grid3x3, Layers,
  Library, Mic, Orbit, Piano, Radio, Repeat, Settings, Shuffle, Sliders, Sparkles, Wand2, Zap,
} from "lucide-react";

// ── Workflow-grouped navigation (mobile/tablet optimized) ───────────────────
// FINAL layout: 13 creative functions across 4 creative hubs + 1 system hub
// (5 hubs total). Primary dock = hubs; secondary strip = active hub's sub-
// tabs. One tap on a hub resumes its last-used sub-tab; siblings stay one tap
// away — no horizontal scroll, dock inside thumb reach. Each hub is tone-
// coded: Arrange/Mix = cyan, Sound/Perform = magenta, System = amber.

type Tone = "cyan" | "magenta" | "amber";
type GroupKey = "ARRANGE" | "SOUND" | "MIX" | "PERFORM" | "SYSTEM";

const TONE_COLOR: Record<Tone, string> = {
  cyan: "hsl(var(--cyan))",
  magenta: "hsl(var(--magenta))",
  amber: "hsl(var(--amber))",
};

type Icon = React.ComponentType<{ className?: string }>;

interface TabMeta { label: string; icon: Icon }
const TAB_META: Record<TabKey, TabMeta> = {
  MIX:   { label: "Mix",     icon: Layers },
  SEQ:   { label: "Seq",    icon: Grid3x3 },
  ROLL:  { label: "Roll",   icon: Piano },
  ARP:   { label: "Arp",    icon: Repeat },
  SND:   { label: "Sound",  icon: Wand2 },
  FX:    { label: "FX",     icon: Sparkles },
  SMPL:  { label: "Sample", icon: Disc },
  BRN:   { label: "Brain",  icon: Brain },
  SPC:   { label: "Spatial",icon: Orbit },
  AI:    { label: "AI",     icon: Bot },
  PROD:  { label: "Prod",   icon: FlaskConical },
  SYNC:  { label: "Sync",   icon: Radio },
  SETUP: { label: "Setup",  icon: Settings },
  DBG:   { label: "Diag",   icon: Activity },
  LIB:   { label: "Library", icon: Library },
  VOICE: { label: "Voice",  icon: Mic },
  REMIX: { label: "Remix",  icon: Shuffle },
  PTN:     { label: "PTN",      icon: Layers },
  PERF:    { label: "Perf",     icon: Zap },
  SYNTH3D: { label: "3D Synth", icon: Orbit },
  BASS3D:  { label: "3D Bass",  icon: Zap },
};

const GROUPS: { key: GroupKey; label: string; icon: Icon; tone: Tone; tabs: TabKey[] }[] = [
  { key: "ARRANGE", label: "Arrange", icon: Grid3x3,  tone: "cyan",    tabs: ["PTN", "SEQ", "ROLL", "ARP", "REMIX"] },
  { key: "SOUND",   label: "Sound",   icon: Wand2,    tone: "magenta", tabs: ["SND", "SYNTH3D", "BASS3D", "SMPL", "VOICE", "LIB", "PROD"] },
  { key: "MIX",     label: "Mix",     icon: Sliders,  tone: "cyan",    tabs: ["MIX", "FX"] },
  { key: "PERFORM", label: "Perform", icon: Sparkles, tone: "magenta", tabs: ["PERF", "AI", "BRN", "SPC", "SYNC"] },
  { key: "SYSTEM",  label: "System",  icon: Settings, tone: "amber",   tabs: ["SETUP", "DBG"] },
];

function groupOf(tab: TabKey): GroupKey {
  for (const g of GROUPS) if (g.tabs.includes(tab)) return g.key;
  return "ARRANGE";
}

export function TabBar() {
  const { tab, setTab } = useGroove();
  const activeGroup = groupOf(tab);
  const activeGroupDef = GROUPS.find((g) => g.key === activeGroup)!;

  // Last-used sub-tab per group → tapping a hub resumes where you left off.
  const lastInGroup = useRef<Record<GroupKey, TabKey>>({
    ARRANGE: "SEQ", SOUND: "SND", MIX: "MIX", PERFORM: "AI", SYSTEM: "SETUP",
  });
  // Keep in sync when `tab` changes from outside this component.
  lastInGroup.current[activeGroup] = tab;

  const tapHub = (g: GroupKey) => {
    const def = GROUPS.find((x) => x.key === g)!;
    setTab(lastInGroup.current[g] ?? def.tabs[0]);
  };
  const tapSub = (t: TabKey) => {
    lastInGroup.current[groupOf(t)] = t;
    setTab(t);
  };

  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-gradient-surface/95 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      {/* Secondary strip — sub-tabs of the active workflow group */}
      <div className="px-2 pt-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="font-mono text-[8px] tracking-widest text-muted-foreground pr-1 shrink-0">
            {activeGroupDef.label.toUpperCase()}
          </span>
          {activeGroupDef.tabs.map((tk) => {
            const m = TAB_META[tk];
            const on = tab === tk;
            const Icon = m.icon;
            return (
              <button
                key={tk}
                onClick={() => tapSub(tk)}
                data-active={on}
                aria-pressed={on}
                style={on ? { color: TONE_COLOR[activeGroupDef.tone] } : undefined}
                className={cn(
                  "tab-pill shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-md font-mono transition-colors",
                  on ? "" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-display text-[10px] tracking-wider">{m.label.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hw-divider mx-2 my-1 opacity-70" />

      {/* Primary dock — workflow group hubs (thumb-reachable, even spacing) */}
      <div className="flex items-stretch px-1 gap-1">
        {GROUPS.map(({ key, label, icon: Icon, tone }) => {
          const active = key === activeGroup;
          return (
            <button
              key={key}
              onClick={() => tapHub(key)}
              data-active={active}
              aria-pressed={active}
              style={active ? { color: TONE_COLOR[tone] } : undefined}
              className={cn(
                "tab-pill flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 font-mono transition-colors",
                active ? "" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="hw-led mb-0.5" data-on={active} data-tone={tone} />
              <Icon className="h-5 w-5" />
              <span className="font-display text-[9px] leading-none tracking-wider truncate w-full text-center">
                {label.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}