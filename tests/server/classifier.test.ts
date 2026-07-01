import { describe, expect, it } from "vitest";
import { classifyWorkstreams } from "../../src/server/classifier";
import type { RawState, SafeFact, SafeFactCode, WorkstreamState } from "../../src/shared/contracts";

function fact(id: string, workstreamId: string, occurredAt: string, code: SafeFactCode): SafeFact {
  return {
    id,
    sourceType: "demo",
    occurredAt,
    workstreamId,
    code,
    sourceEventType: "assistant"
  };
}

function workstream(
  id: string,
  rawState: RawState,
  lastActivityAt: string,
  facts: SafeFact[]
): WorkstreamState {
  return {
    id,
    sourceType: "demo",
    label: "Workstream 1",
    createdAt: facts[0]?.occurredAt ?? lastActivityAt,
    updatedAt: lastActivityAt,
    lastActivityAt,
    facts,
    rawState
  };
}

const now = new Date("2026-07-01T12:00:00.000Z");
const staleThresholdMs = 60 * 60 * 1000;

describe("classifyWorkstreams", () => {
  it("flags completion claims without validation as missing validation", () => {
    const [classification] = classifyWorkstreams(
      [
        workstream("ws_b", "done_claimed", "2026-07-01T11:30:00.000Z", [
          fact("fact_1", "ws_b", "2026-07-01T11:30:00.000Z", "completion_claim_seen")
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classification).toMatchObject({
      workstreamId: "ws_b",
      attentionReason: "missing_validation",
      severity: "high",
      certainty: "explicit",
      evidenceCodes: ["completion_claim_without_validation"],
      nextStepStatus: "unclear",
      nextStepPromptTemplateId: "run_validation",
      since: "2026-07-01T11:30:00.000Z"
    });
  });

  it("flags validation before completion as missing validation", () => {
    const [classification] = classifyWorkstreams(
      [
        workstream("ws_validation_before_completion", "done_claimed", "2026-07-01T11:30:00.000Z", [
          fact(
            "fact_1",
            "ws_validation_before_completion",
            "2026-07-01T11:00:00.000Z",
            "validation_signal_seen"
          ),
          fact(
            "fact_2",
            "ws_validation_before_completion",
            "2026-07-01T11:30:00.000Z",
            "completion_claim_seen"
          ),
          fact(
            "fact_3",
            "ws_validation_before_completion",
            "2026-07-01T11:31:00.000Z",
            "next_step_signal_seen"
          )
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classification).toMatchObject({
      attentionReason: "missing_validation",
      severity: "high",
      certainty: "explicit",
      evidenceCodes: ["completion_claim_without_validation"],
      nextStepStatus: "unclear",
      nextStepPromptTemplateId: "run_validation"
    });
  });

  it("flags a later completion after validation as missing validation even with a next step", () => {
    const [classification] = classifyWorkstreams(
      [
        workstream("ws_reclaimed", "done_claimed", "2026-07-01T11:35:00.000Z", [
          fact("fact_1", "ws_reclaimed", "2026-07-01T11:00:00.000Z", "completion_claim_seen"),
          fact("fact_2", "ws_reclaimed", "2026-07-01T11:10:00.000Z", "validation_signal_seen"),
          fact("fact_3", "ws_reclaimed", "2026-07-01T11:30:00.000Z", "completion_claim_seen"),
          fact("fact_4", "ws_reclaimed", "2026-07-01T11:35:00.000Z", "next_step_signal_seen")
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classification).toMatchObject({
      attentionReason: "missing_validation",
      severity: "high",
      certainty: "explicit",
      evidenceCodes: ["completion_claim_without_validation"],
      nextStepStatus: "unclear",
      nextStepPromptTemplateId: "run_validation"
    });
  });

  it("flags missing next steps when work is not verified done", () => {
    const [classification] = classifyWorkstreams(
      [
        workstream("ws_d", "running", "2026-07-01T11:30:00.000Z", [
          fact("fact_1", "ws_d", "2026-07-01T11:30:00.000Z", "tool_finished")
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classification).toMatchObject({
      attentionReason: "missing_next_step",
      severity: "medium",
      certainty: "inferred",
      evidenceCodes: ["no_next_step_signal"],
      nextStepStatus: "missing",
      nextStepPromptTemplateId: "write_next_step"
    });
  });

  it("prioritizes unresolved blocked work over other reasons and ignores resolved blockers", () => {
    const classifications = classifyWorkstreams(
      [
        workstream("ws_blocked", "running", "2026-07-01T11:30:00.000Z", [
          fact("fact_1", "ws_blocked", "2026-07-01T11:00:00.000Z", "blocked_signal_seen"),
          fact("fact_2", "ws_blocked", "2026-07-01T11:30:00.000Z", "completion_claim_seen")
        ]),
        workstream("ws_resolved", "waiting", "2026-07-01T11:30:00.000Z", [
          fact("fact_1", "ws_resolved", "2026-07-01T11:00:00.000Z", "blocked_signal_seen"),
          fact("fact_2", "ws_resolved", "2026-07-01T11:30:00.000Z", "next_step_signal_seen")
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classifications[0]).toMatchObject({
      attentionReason: "blocked",
      severity: "high",
      certainty: "explicit",
      evidenceCodes: ["blocked_signal_without_resolution"],
      nextStepStatus: "unclear",
      nextStepPromptTemplateId: "resolve_blocker"
    });
    expect(classifications[1].attentionReason).not.toBe("blocked");
  });

  it("flags stale work only after higher priority reasons are absent", () => {
    const [classification] = classifyWorkstreams(
      [
        workstream("ws_stale", "waiting", "2026-07-01T09:30:00.000Z", [
          fact("fact_1", "ws_stale", "2026-07-01T09:30:00.000Z", "next_step_signal_seen")
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classification).toMatchObject({
      attentionReason: "stale",
      severity: "low",
      certainty: "weak",
      evidenceCodes: ["inactive_past_stale_threshold"],
      nextStepStatus: "unclear",
      nextStepPromptTemplateId: "review_stale_work"
    });
  });

  it("keeps recent non-verified work with a next step clean without validation evidence", () => {
    const [classification] = classifyWorkstreams(
      [
        workstream("ws_next_step", "waiting", "2026-07-01T11:30:00.000Z", [
          fact("fact_1", "ws_next_step", "2026-07-01T11:30:00.000Z", "next_step_signal_seen")
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classification).toMatchObject({
      attentionReason: null,
      severity: "low",
      nextStepStatus: "present",
      nextStepPromptTemplateId: "no_prompt",
      evidenceCodes: []
    });
    expect(classification.evidenceCodes).not.toContain("validation_signal_present");
  });

  it("keeps verified work clean with no prompt", () => {
    const [classification] = classifyWorkstreams(
      [
        workstream("ws_verified", "verified_done", "2026-07-01T11:30:00.000Z", [
          fact("fact_1", "ws_verified", "2026-07-01T11:00:00.000Z", "completion_claim_seen"),
          fact("fact_2", "ws_verified", "2026-07-01T11:30:00.000Z", "validation_signal_seen")
        ])
      ],
      { now, staleThresholdMs }
    );

    expect(classification).toMatchObject({
      attentionReason: null,
      severity: "low",
      certainty: "explicit",
      evidenceCodes: ["validation_signal_present"],
      nextStepStatus: "not_required",
      nextStepPromptTemplateId: "no_prompt",
      since: "2026-07-01T11:30:00.000Z"
    });
  });
});
