// VibeCore AI — Automation Assistant.
//
// Erzeugt Automation-Vorschläge (Filter-Sweeps, Send-Buildups, Build/Break/Drop-
// Strukturen) als AutomationLane-Daten, vollständig kompatibel mit VibeCore
// Sync (songTicks-basiert, sample-accurat via AudioContext.currentTime).
//
// Die Automation wird über den FX Mix Lab Automation-Scheduler angewendet — die
// AI erzeugt nur die Lane-Daten (pure). Keine direkten AudioParam-Schreibungen.
//
// songTicks = globale Step-Position (16th-note grid). 1 Bar = 16 Ticks.

import type { AutomationLane, AutomationPoint, AutomationCurve } from "@/lib/fxmixlab/types";
import type { ContextSnapshot, Suggestion, AutomationPayload } from "./types";
import { suggestionId } from "./engine";

const TICKS_PER_BAR = 16;

export interface AutomationOpts {
  seed?: number;
  bars?: number;
  /** Start position in songTicks (default: current songTicks). */
  startTick?: number;
}

function laneId(seed: number, channelRef: string, paramRef: string): string {
  return `ai_auto_${seed.toString(36)}_${channelRef}_${paramRef}`;
}

function ramp(
  from: number, to: number, startTick: number, bars: number, curve: AutomationCurve = "exp",
): AutomationPoint[] {
  const endTick = startTick + bars * TICKS_PER_BAR;
  return [
    { songTicks: startTick, value: from, curve },
    { songTicks: endTick, value: to, curve: "lin" },
  ];
}

/** Suggest a filter sweep (cutoff open or close over N bars). */
export function suggestFilterSweep(
  ctx: ContextSnapshot, partId: number, direction: "open" | "close", opts: AutomationOpts = {},
): Suggestion<AutomationPayload> {
  const seed = opts.seed ?? 0xA1F500;
  const bars = opts.bars ?? 4;
  const startTick = opts.startTick ?? ctx.songTicks;
  const from = direction === "open" ? 15 : 90;
  const to = direction === "open" ? 90 : 15;

  const lane: AutomationLane = {
    id: laneId(seed, `part:${partId}`, "filter_cutoff"),
    target: "insertParam",
    channelRef: `part:${partId}`,
    paramRef: "filter_cutoff",
    points: ramp(from, to, startTick, bars, "exp"),
    enabled: true,
  };

  return {
    id: suggestionId("automation", seed),
    kind: "automation",
    label: `Filter ${direction === "open" ? "Open" : "Close"}`,
    description: `${direction === "open" ? "Opening" : "Closing"} filter sweep over ${bars} bars — cutoff ${from}→${to}.`,
    confidence: 0.7,
    seed,
    payload: { lanes: [lane] },
  };
}

/** Suggest a send buildup (gradually increase a send to an FX bus). */
export function suggestSendBuildup(
  ctx: ContextSnapshot, partId: number, fxIdx: number, opts: AutomationOpts = {},
): Suggestion<AutomationPayload> {
  const seed = opts.seed ?? 0x5E0B00;
  const bars = opts.bars ?? 8;
  const startTick = opts.startTick ?? ctx.songTicks;

  const lane: AutomationLane = {
    id: laneId(seed, `part:${partId}`, `send_${fxIdx}`),
    target: "send",
    channelRef: `part:${partId}`,
    paramRef: `send_${fxIdx}`,
    points: ramp(0, 70, startTick, bars, "lin"),
    enabled: true,
  };

  return {
    id: suggestionId("automation", seed),
    kind: "automation",
    label: "Send Buildup",
    description: `Gradually increase send ${fxIdx} from 0→70% over ${bars} bars for rising tension.`,
    confidence: 0.7,
    seed,
    payload: { lanes: [lane] },
  };
}

/** Suggest a full buildup (multi-lane: filter open + send rise + volume swell). */
export function suggestBuildup(
  ctx: ContextSnapshot, opts: AutomationOpts = {},
): Suggestion<AutomationPayload> {
  const seed = opts.seed ?? 0xB0D00;
  const bars = opts.bars ?? 8;
  const startTick = opts.startTick ?? ctx.songTicks;
  const synthPart = ctx.parts.find((p) => p.category === "synth")?.id ?? 8;
  const bassPart = ctx.parts.find((p) => p.category === "bass")?.id ?? 6;

  const lanes: AutomationLane[] = [
    { id: laneId(seed, `part:${synthPart}`, "filter_cutoff"), target: "insertParam",
      channelRef: `part:${synthPart}`, paramRef: "filter_cutoff",
      points: ramp(15, 85, startTick, bars, "exp"), enabled: true },
    { id: laneId(seed + 1, `part:${synthPart}`, "send_2"), target: "send",
      channelRef: `part:${synthPart}`, paramRef: "send_2",
      points: ramp(0, 65, startTick, bars, "lin"), enabled: true },
    { id: laneId(seed + 2, `part:${bassPart}`, "volume"), target: "volume",
      channelRef: `part:${bassPart}`,
      points: ramp(70, 95, startTick, bars, "lin"), enabled: true },
  ];

  return {
    id: suggestionId("automation", seed),
    kind: "automation",
    label: "Buildup",
    description: `Full ${bars}-bar buildup — filter opens, reverb send rises, bass volume swells. Ends at the drop.`,
    confidence: 0.75,
    seed,
    payload: { lanes },
  };
}

/** Suggest a breakdown (strip back to minimal — filter close, sends down). */
export function suggestBreakdown(
  ctx: ContextSnapshot, opts: AutomationOpts = {},
): Suggestion<AutomationPayload> {
  const seed = opts.seed ?? 0xB8EA00;
  const bars = opts.bars ?? 4;
  const startTick = opts.startTick ?? ctx.songTicks;
  const synthPart = ctx.parts.find((p) => p.category === "synth")?.id ?? 8;
  const bassPart = ctx.parts.find((p) => p.category === "bass")?.id ?? 6;

  const lanes: AutomationLane[] = [
    { id: laneId(seed, `part:${synthPart}`, "filter_cutoff"), target: "insertParam",
      channelRef: `part:${synthPart}`, paramRef: "filter_cutoff",
      points: ramp(85, 20, startTick, bars, "exp"), enabled: true },
    { id: laneId(seed + 1, `part:${bassPart}`, "volume"), target: "volume",
      channelRef: `part:${bassPart}`,
      points: ramp(90, 50, startTick, Math.max(1, bars - 2), "lin"), enabled: true },
  ];

  return {
    id: suggestionId("automation", seed),
    kind: "automation",
    label: "Breakdown",
    description: `${bars}-bar breakdown — filter closes, bass volume drops. Creates space before the next drop.`,
    confidence: 0.7,
    seed,
    payload: { lanes },
  };
}

/** Suggest a drop impact (sudden parameter reset + reverb splash). */
export function suggestDrop(
  ctx: ContextSnapshot, opts: AutomationOpts = {},
): Suggestion<AutomationPayload> {
  const seed = opts.seed ?? 0xD80000;
  const startTick = opts.startTick ?? ctx.songTicks;
  const allParts = ctx.parts.filter((p) => p.category === "synth" || p.category === "bass");

  const lanes: AutomationLane[] = [];
  for (const part of allParts) {
    lanes.push({
      id: laneId(seed, `part:${part.id}`, "filter_cutoff"), target: "insertParam",
      channelRef: `part:${part.id}`, paramRef: "filter_cutoff",
      points: [
        { songTicks: startTick, value: 20, curve: "step" },
        { songTicks: startTick + 2, value: 90, curve: "step" },
      ],
      enabled: true,
    });
  }

  return {
    id: suggestionId("automation", seed),
    kind: "automation",
    label: "Drop Impact",
    description: "Sudden filter snap-open at the drop point — all synth/bass channels reset to full cutoff.",
    confidence: 0.8,
    seed,
    payload: { lanes },
  };
}