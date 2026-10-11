import { describe, expect, it } from "vitest";
import { useGroove } from "@/lib/store";
import type { MixPayload, Suggestion } from "@/lib/ai/types";
import {
  applyAiIntent,
  createAiIntent,
  explainAiIntent,
  previewAiIntent,
  revertAiIntent,
  validateAiIntent,
} from "@/lib/ai/intent";

function volumeSuggestion(partId: number, value: number): Suggestion<MixPayload> {
  return {
    id: `mix-test-${partId}`,
    kind: "mix",
    label: "Level part",
    description: "Adjust the part level for headroom.",
    confidence: 0.8,
    seed: 42,
    payload: {
      partId,
      param: "volume",
      value,
      reason: "headroom",
    },
  };
}

describe("AI Intent v1", () => {
  it("validates parameter-backed Mix suggestions without mutating state", () => {
    const part = useGroove.getState().parts[0];
    const before = part.volume;
    const intent = createAiIntent(volumeSuggestion(part.id, before - 5));

    const validation = validateAiIntent(intent);
    expect(validation.valid).toBe(true);
    expect(validation.command?.parameter).toBe(`part.${part.id}.volume`);
    expect(useGroove.getState().parts[0].volume).toBe(before);
  });

  it("previews the exact clamped canonical diff without applying it", () => {
    const part = useGroove.getState().parts[0];
    const before = part.volume;
    const intent = createAiIntent(volumeSuggestion(part.id, 999));

    const preview = previewAiIntent(intent);
    expect(preview?.previousValue).toBe(before);
    expect(preview?.proposedValue).toBe(100);
    expect(useGroove.getState().parts[0].volume).toBe(before);
  });

  it("applies and reverts through the same ParameterHub path", () => {
    const part = useGroove.getState().parts[0];
    const before = part.volume;
    const target = before === 73 ? 74 : 73;
    const intent = createAiIntent(volumeSuggestion(part.id, target));

    const receipt = applyAiIntent(intent);
    expect(receipt?.stage).toBe("APPLIED");
    expect(useGroove.getState().parts[0].volume).toBe(target);

    const reverted = receipt ? revertAiIntent(receipt) : null;
    expect(reverted?.stage).toBe("REVERTED");
    expect(useGroove.getState().parts[0].volume).toBe(before);
  });

  it("rejects unsupported Mix command types instead of bypassing validation", () => {
    const suggestion: Suggestion<MixPayload> = {
      id: "mix-fx-unsupported",
      kind: "mix",
      label: "FX tweak",
      description: "A direct FX parameter suggestion.",
      confidence: 0.5,
      seed: 9,
      payload: {
        partId: 0,
        param: "fx_param",
        fxIdx: 0,
        fxParamKey: "A",
        value: 50,
        reason: "test",
      },
    };
    const validation = validateAiIntent(createAiIntent(suggestion));
    expect(validation.valid).toBe(false);
    expect(validation.reason).toMatch(/no validated Intent→Command adapter/i);
  });

  it("keeps EXPLAIN pure and preserves the suggestion rationale", () => {
    const intent = createAiIntent(volumeSuggestion(0, 50));
    expect(explainAiIntent(intent)).toMatchObject({
      label: "Level part",
      confidence: 0.8,
      seed: 42,
      payloadReason: "headroom",
    });
  });
});
