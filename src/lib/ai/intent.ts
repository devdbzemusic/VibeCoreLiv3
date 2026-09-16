import {
  getParameter,
  getParameterDescriptor,
  setParameter,
  type ParameterId,
} from "@/lib/parameters/hub";
import type { MixPayload, Suggestion } from "./types";

export type AiIntentStage = "SUGGEST" | "PREVIEW" | "APPLIED" | "REVERTED" | "REJECTED";

export interface AiIntent<T = unknown> {
  id: string;
  suggestion: Suggestion<T>;
  stage: AiIntentStage;
}

export interface AiIntentValidation {
  valid: boolean;
  command?: ParameterIntentCommand;
  reason?: string;
}

export interface ParameterIntentCommand {
  type: "parameter.set";
  parameter: ParameterId;
  value: number;
}

export interface AiIntentPreview {
  intentId: string;
  stage: "PREVIEW";
  command: ParameterIntentCommand;
  previousValue: number;
  proposedValue: number;
  delta: number;
  description: string;
}

export interface AiIntentReceipt {
  intentId: string;
  suggestionId: string;
  stage: "APPLIED" | "REVERTED";
  command: ParameterIntentCommand;
  previousValue: number;
  appliedValue: number;
}

export interface AiIntentExplanation {
  intentId: string;
  label: string;
  description: string;
  confidence: number;
  seed: number;
  payloadReason?: string;
}

/**
 * Wrap a pure AI Suggestion as an Intent. This function has no side effects.
 */
export function createAiIntent<T>(suggestion: Suggestion<T>): AiIntent<T> {
  return {
    id: `intent:${suggestion.id}`,
    suggestion,
    stage: "SUGGEST",
  };
}

function mixParameterCommand(payload: MixPayload): AiIntentValidation {
  if (payload.param === "volume") {
    if (payload.partId == null) {
      return { valid: false, reason: "Mix volume intent requires a target partId" };
    }
    const parameter = `part.${payload.partId}.volume` as ParameterId;
    return getParameterDescriptor(parameter)
      ? { valid: true, command: { type: "parameter.set", parameter, value: payload.value } }
      : { valid: false, reason: `Unknown parameter ${parameter}` };
  }

  if (payload.param === "pan") {
    if (payload.partId == null) {
      return { valid: false, reason: "Mix pan intent requires a target partId" };
    }
    const parameter = `part.${payload.partId}.pan` as ParameterId;
    return getParameterDescriptor(parameter)
      ? { valid: true, command: { type: "parameter.set", parameter, value: payload.value } }
      : { valid: false, reason: `Unknown parameter ${parameter}` };
  }

  return {
    valid: false,
    reason: `Mix parameter '${payload.param}' has no validated Intent→Command adapter yet`,
  };
}

/**
 * Validate an Intent into a concrete system command without applying it.
 *
 * v1 deliberately supports only Mix volume/pan because both already have a
 * canonical persisted ParameterHub path. Unsupported payloads stay suggestions
 * instead of bypassing validation through direct Store mutations.
 */
export function validateAiIntent(intent: AiIntent): AiIntentValidation {
  if (intent.suggestion.kind === "mix") {
    return mixParameterCommand(intent.suggestion.payload as MixPayload);
  }

  return {
    valid: false,
    reason: `Suggestion kind '${intent.suggestion.kind}' has no validated command adapter yet`,
  };
}

/** Preview computes the exact canonical parameter diff and performs no mutation. */
export function previewAiIntent(intent: AiIntent): AiIntentPreview | null {
  const validation = validateAiIntent(intent);
  if (!validation.valid || !validation.command) return null;

  const previousValue = getParameter(validation.command.parameter);
  if (previousValue == null) return null;
  const descriptor = getParameterDescriptor(validation.command.parameter);
  if (!descriptor) return null;
  const proposedValue = Math.max(descriptor.min, Math.min(descriptor.max, validation.command.value));

  return {
    intentId: intent.id,
    stage: "PREVIEW",
    command: validation.command,
    previousValue,
    proposedValue,
    delta: proposedValue - previousValue,
    description: `${validation.command.parameter}: ${previousValue} → ${proposedValue}`,
  };
}

/**
 * Apply only a validated command. The receipt is caller-owned and contains the
 * previous canonical value required for deterministic revert; no hidden global
 * AI history/store is created here.
 */
export function applyAiIntent(intent: AiIntent): AiIntentReceipt | null {
  const preview = previewAiIntent(intent);
  if (!preview) return null;

  const accepted = setParameter(preview.command.parameter, preview.proposedValue);
  if (!accepted) return null;

  return {
    intentId: intent.id,
    suggestionId: intent.suggestion.id,
    stage: "APPLIED",
    command: preview.command,
    previousValue: preview.previousValue,
    appliedValue: preview.proposedValue,
  };
}

/** Revert uses the original receipt and the same ParameterHub command surface. */
export function revertAiIntent(receipt: AiIntentReceipt): AiIntentReceipt | null {
  if (receipt.stage !== "APPLIED") return null;
  if (!setParameter(receipt.command.parameter, receipt.previousValue)) return null;

  return {
    ...receipt,
    stage: "REVERTED",
  };
}

export function explainAiIntent(intent: AiIntent): AiIntentExplanation {
  const payload = intent.suggestion.payload as Partial<MixPayload> | undefined;
  return {
    intentId: intent.id,
    label: intent.suggestion.label,
    description: intent.suggestion.description,
    confidence: intent.suggestion.confidence,
    seed: intent.suggestion.seed,
    payloadReason: typeof payload?.reason === "string" ? payload.reason : undefined,
  };
}
