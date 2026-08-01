// VibeCore Groove — Module barrel export.
//
// Central entry point for the Groove module. All Groove utilities are
// re-exported from here so consumers import from "@/lib/groove".

export {
  grooveDensity, partDensity, swingAmount,
  velocityHistogram, avgVelocity,
  timingAnalysis, humanizeAnalysis,
  patternSimilarity,
  pitchClassHistogram, detectKey, keyToArpScale, detectChords,
  grooveSummary,
  SCALE_DEGREES,
  type GrooveSummary,
} from "./analysis";

export { runGrooveTests } from "./grooveSelfTest";