import { describe, expect, it } from "vitest";
import {
  evidenceLabel,
  nextStepPromptLabel,
  type Classification,
  type SafeFact
} from "../src/shared/contracts";

describe("contracts", () => {
  it("renders fixed labels without dynamic interpolation", () => {
    expect(nextStepPromptLabel("run_validation")).toBe("Run the planned validation and review the result.");
    expect(evidenceLabel("completion_claim_without_validation")).toBe(
      "Completion was claimed without a validation signal."
    );
  });

  it("keeps SafeFact metadata-only", () => {
    const fact: SafeFact = {
      id: "fact_1",
      sourceType: "demo",
      occurredAt: "2026-07-01T09:00:00.000+09:00",
      workstreamId: "ws_1",
      code: "completion_claim_seen",
      sourceEventType: "assistant"
    };
    expect(JSON.stringify(fact)).not.toContain("payload");
  });

  it("allows null attention reason for verified work", () => {
    const classification: Classification = {
      workstreamId: "ws_1",
      attentionReason: null,
      severity: "low",
      certainty: "explicit",
      evidenceCodes: ["validation_signal_present"],
      nextStepStatus: "not_required",
      nextStepPromptTemplateId: "no_prompt",
      since: "2026-07-01T09:30:00.000+09:00"
    };
    expect(classification.attentionReason).toBeNull();
  });
});
