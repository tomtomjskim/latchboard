import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSnapshot, writeSnapshot } from "../../src/server/store";
import type { Classification, SafeFact, SourceStatus, WorkstreamState } from "../../src/shared/contracts";

function fact(id: string, workstreamId: string, occurredAt: string): SafeFact {
  return {
    id,
    sourceType: "demo",
    occurredAt,
    workstreamId,
    code: "completion_claim_seen",
    sourceEventType: "assistant"
  };
}

function classification(workstreamId: string, attentionReason: Classification["attentionReason"]): Classification {
  return {
    workstreamId,
    attentionReason,
    severity: attentionReason === null ? "low" : "high",
    certainty: "explicit",
    evidenceCodes: attentionReason === null ? ["validation_signal_present"] : ["completion_claim_without_validation"],
    nextStepStatus: attentionReason === null ? "not_required" : "unclear",
    nextStepPromptTemplateId: attentionReason === null ? "no_prompt" : "run_validation",
    since: "2026-07-01T09:30:00.000Z"
  };
}

function workstream(id: string, rawState: WorkstreamState["rawState"], facts: SafeFact[]): WorkstreamState {
  return {
    id,
    sourceType: "demo",
    label: id === "ws_done" ? "Workstream 1" : "Workstream 2",
    createdAt: facts[0]?.occurredAt ?? "2026-07-01T09:00:00.000Z",
    updatedAt: facts[facts.length - 1]?.occurredAt ?? "2026-07-01T09:00:00.000Z",
    lastActivityAt: facts[facts.length - 1]?.occurredAt ?? "2026-07-01T09:00:00.000Z",
    facts,
    rawState
  };
}

const sourceStatus: SourceStatus = {
  connected: true,
  parsedLineCount: 2,
  malformedLineCount: 0,
  partialLineCount: 0
};

describe("buildSnapshot", () => {
  it("builds TodaySnapshot summaries without exposing facts", () => {
    const snapshot = buildSnapshot({
      mode: "demo",
      date: "2026-07-01",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-01T09:40:00.000Z",
      sourceStatus,
      workstreams: [
        workstream("ws_done", "verified_done", [
          fact("fact_done_1", "ws_done", "2026-07-01T09:00:00.000Z")
        ]),
        workstream("ws_attention", "done_claimed", [
          fact("fact_attention_1", "ws_attention", "2026-07-01T09:30:00.000Z")
        ])
      ],
      classifications: [classification("ws_done", null), classification("ws_attention", "missing_validation")]
    });

    expect(snapshot.workstreams).toHaveLength(2);
    expect(snapshot.attention).toHaveLength(1);
    expect(snapshot.dailySummary).toEqual({ unresolved: 1, verifiedDone: 1, carryOver: 0 });
    expect(snapshot.attention[0]).toMatchObject({
      workstreamId: "ws_attention",
      label: "Workstream 2",
      classification: { attentionReason: "missing_validation" }
    });
    expect(JSON.stringify(snapshot)).not.toContain("facts");
    expect(JSON.stringify(snapshot)).not.toContain("fact_attention_1");
  });
});

describe("writeSnapshot", () => {
  it("creates parent directories and writes JSON sidecar", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-store-"));
    const path = join(dir, "nested", "state.json");
    const snapshot = buildSnapshot({
      mode: "demo",
      date: "2026-07-01",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-01T09:40:00.000Z",
      sourceStatus,
      workstreams: [],
      classifications: []
    });

    writeSnapshot(path, snapshot);

    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(snapshot);
  });
});
