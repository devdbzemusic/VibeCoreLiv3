// HOME module — Entry point for VibeCoreLiv3.
//
// Shows:
//   1. 12 module tiles in a responsive grid — tap to navigate
//   2. Live BPM beat-pulse animation driven by masterClock
//   3. Quick-launch: last-used pattern + recent AI suggestion
//
// Touch targets: each tile ≥ 80 px tall.

import { useCallback } from "react";
import { useGroove, type TabKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Layers, Orbit, Zap, Disc, Sliders,
  Mic, Shuffle, Bot, Waves, Settings, Play, Pause,
} from "lucide-react";
import { ensureAudio, getCtx } from "@/lib/audio/engine";
import { tapTempo } from "@/lib/clock/tapTempo";

type Icon = React.ComponentType<{ className?: string }>;

interface ModuleTile {
  id: string;
  label: string;
  description: string;
  icon: Icon;
  primaryTab: TabKey;
  color: string;
}

// MASTERPROMPT v5.0 — 10 modules (ARP folded into GROOVE, BRAINWAVEZ → WAVE)
const TILES: ModuleTile[] = [
  {
    id: "GROOVE",  label: "Groove",       description: "Piano Roll · Patterns · ARP",
    icon: Layers,  primaryTab: "ROLL",    color: "hsl(195 100% 55%)",
  },
  {
    id: "SYNTH3D", label: "3D Synth",     description: "Spectral · FM · Wavetable synth",
    icon: Orbit,   primaryTab: "SYNTH3D", color: "hsl(260 100% 68%)",
  },
  {
    id: "BASS3D",  label: "3D Bass",      description: "Sub · Drive · Harmonic bass engine",
    icon: Zap,     primaryTab: "BASS3D",  color: "hsl(280 100% 65%)",
  },
  {
    id: "FORGE",   label: "Sample Forge", description: "Slice · Granular · AI sample tools",
    icon: Disc,    primaryTab: "SMPL",    color: "hsl(320 100% 60%)",
  },
  {
    id: "FXLAB",   label: "FX Mix Lab",   description: "Mix · FX · Perform · Remix · 3D Matrix",
    icon: Sliders, primaryTab: "MIX",     color: "hsl(38 100% 58%)",
  },
  {
    id: "VOICE",   label: "Voice",        description: "Vocoder · Harmoniser · Pitch",
    icon: Mic,     primaryTab: "VOICE",   color: "hsl(140 100% 55%)",
  },
  {
    id: "AI",      label: "AI",           description: "Co-create beats · Melodies · Stems",
    icon: Bot,     primaryTab: "AI",      color: "hsl(280 100% 65%)",
  },
  {
    id: "WAVE",    label: "Wave",         description: "Binaural · Psychoacoustic spatial",
    icon: Waves,   primaryTab: "BRN",     color: "hsl(260 100% 68%)",
  },
  {
    id: "SETTINGS",label: "Settings",     description: "Audio · MIDI · Sync · Library",
    icon: Settings,primaryTab: "SETUP",   color: "hsl(38 100% 58%)",
  },
];

export function HomeTab() {
  const { setTab, bpm, setBpm, transport, togglePlay, patterns, selectedPattern } = useGroove();
  const pat = patterns[selectedPattern];
  const playing = transport.playing;

  const handlePlay = useCallback(async () => {
    await ensureAudio();
    const ctx = getCtx();
    if (ctx?.state === "suspended") {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    togglePlay();
  }, [togglePlay]);

  const handleTapBpm = useCallback(() => {
    const v = tapTempo();
    if (v) setBpm(v);
  }, [setBpm]);

  return (
    <div className="space-y-4 pb-4">

      {/* Hero — BPM beat-pulse + quick transport */}
      <div className="panel p-4 flex items-center gap-4">
        {/* BPM beat display */}
        <button
          onClick={handleTapBpm}
          className={cn(
            "hw-screen flex-shrink-0 flex flex-col items-center justify-center w-24 h-16",
            "touch-none active:scale-95 transition-transform select-none",
            playing && "animate-beat-pulse",
          )}
          aria-label="BPM — tap for tap tempo"
        >
          <span className="font-mono text-[8px] text-primary/60 tracking-widest">BPM</span>
          <span className="font-display text-3xl tabular-nums leading-none">{bpm.toFixed(1)}</span>
          <span className="font-mono text-[7px] text-muted-foreground mt-0.5">TAP</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-display text-sm text-primary neon-text mb-0.5">VIBECORE LIV3</div>
          <div className="font-mono text-[9px] text-muted-foreground mb-3 truncate">
            {pat?.name ?? "—"} · {pat?.scenes.length ?? 0} scenes
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlay}
              className={cn(
                "h-10 px-5 rounded-lg inline-flex flex-row items-center gap-2 transition-all font-display text-[10px] tracking-wider",
                playing
                  ? "bg-gradient-primary text-primary-foreground shadow-glow-primary"
                  : "panel-inset text-foreground",
              )}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "PAUSE" : "PLAY"}
            </button>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <div className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase mb-2 px-0.5">
          Modules
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                onClick={() => setTab(tile.primaryTab)}
                className={cn(
                  "panel flex flex-col items-start gap-1.5 p-3",
                  "transition-all duration-150 active:scale-95 touch-none",
                  "hover:border-primary/30",
                )}
                style={{ minHeight: 80 }}
                aria-label={`Open ${tile.label}`}
              >
                <div
                  className="h-8 w-8 rounded-lg grid place-items-center shrink-0"
                  style={{
                    background: `${tile.color}18`,
                    border: `1px solid ${tile.color}40`,
                    color: tile.color,
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div
                    className="font-display text-[9px] tracking-wider leading-tight"
                    style={{ color: tile.color }}
                  >
                    {tile.label.toUpperCase()}
                  </div>
                  <div className="font-mono text-[7.5px] text-muted-foreground leading-tight mt-0.5 hidden sm:block truncate">
                    {tile.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
