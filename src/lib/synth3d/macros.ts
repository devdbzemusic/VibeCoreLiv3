// VibeCore 3D Synth — Macro Controls.
//
// 8 freely assignable macro controls with MIDI CC learn, host automation
// support, and snapshot save/restore. Macros are the primary live-performance
// expression surface — they feed into the modulation matrix as sources.
//
// Realtime-safe: macro values are stored as module-scope state and exposed
// via getters/setters. The voice engine reads macro values via getMacroValue()
// when creating voices (control thread). Live changes update ConstantSourceNodes
// on active voices.

import { clamp } from "@/lib/dsp";
import type { MacroState3D } from "./params";

const MACRO_COUNT = 8;

class MacroManager {
  private _values: number[];
  private _cc: Map<number, number>;  // cc# → macro index
  private _listeners: Set<(index: number, value: number) => void>;

  constructor(count = MACRO_COUNT) {
    this._values = new Array(count).fill(0.5);
    this._cc = new Map();
    this._listeners = new Set();
  }

  get count(): number { return this._values.length; }

  getMacro(i: number): number {
    return this._values[clamp(i, 0, this._values.length - 1)];
  }

  setMacro(i: number, value: number): void {
    const idx = clamp(i, 0, this._values.length - 1);
    this._values[idx] = clamp(value, 0, 1);
    this._listeners.forEach((cb) => { try { cb(idx, this._values[idx]); } catch { /* noop */ } });
  }

  /** Assign a MIDI CC to a macro (MIDI Learn). */
  learnCC(macroIndex: number, cc: number): void {
    // Remove any previous mapping for this CC
    this._cc.forEach((mi, ccNum) => { if (mi === macroIndex) this._cc.delete(ccNum); });
    this._cc.set(cc, clamp(macroIndex, 0, this._values.length - 1));
  }

  unlearnCC(macroIndex: number): void {
    this._cc.forEach((mi, ccNum) => { if (mi === macroIndex) this._cc.delete(ccNum); });
  }

  /** Handle incoming MIDI CC — updates the mapped macro. */
  handleCC(cc: number, value: number): void {
    const mi = this._cc.get(cc);
    if (mi !== undefined) this.setMacro(mi, value / 127);
  }

  subscribe(cb: (index: number, value: number) => void): () => void {
    this._listeners.add(cb);
    return () => { this._listeners.delete(cb); };
  }

  snapshot(): MacroState3D[] {
    return this._values.map((v, i) => ({
      value: v,
      cc: [...this._cc.entries()].find(([, mi]) => mi === i)?.[0] ?? null,
    }));
  }

  restore(state: MacroState3D[]): void {
    for (let i = 0; i < this._values.length && i < state.length; i++) {
      this._values[i] = clamp(state[i].value, 0, 1);
      if (state[i].cc != null) this.learnCC(i, state[i].cc);
    }
  }
}

// Module-scope instance — one macro bank per 3D Synth instance.
let _instance: MacroManager | null = null;

export function getMacros(): MacroManager {
  if (!_instance) _instance = new MacroManager();
  return _instance;
}

export function resetMacros(): void {
  _instance = null;
}

export { MacroManager };