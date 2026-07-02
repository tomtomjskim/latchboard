import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSnapshot, createSnapshotRuntime, writeSnapshot } from "../../src/server/store";
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
      lastSignalCode: "completion_claim_seen",
      classification: { attentionReason: "missing_validation" }
    });
    expect(snapshot.workstreams[0]).toMatchObject({
      workstreamId: "ws_done",
      lastSignalCode: "completion_claim_seen"
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

describe("createSnapshotRuntime", () => {
  it("updates snapshot and sidecar from appended complete lines without duplicating existing facts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-runtime-"));
    const inputPath = join(dir, "events.jsonl");
    const statePath = join(dir, "state.json");
    writeFileSync(
      inputPath,
      '{"kind":"demo","sessionId":"runtime-session","time":"2026-07-01T09:00:00.000+09:00","signals":["session_started","tool_finished"]}\n'
    );
    const runtime = createSnapshotRuntime({
      mode: "demo",
      inputPath,
      statePath,
      sourceType: "demo",
      timezone: "Asia/Seoul",
      staleThresholdMs: 2 * 60 * 60 * 1000,
      now: () => new Date("2026-07-01T09:10:00.000+09:00")
    });

    await runtime.pollOnce();
    const initial = runtime.getSnapshot();
    expect(initial.workstreams).toHaveLength(1);
    expect(initial.attention[0].classification.attentionReason).toBe("missing_next_step");

    appendFileSync(
      inputPath,
      '{"kind":"demo","sessionId":"runtime-session","time":"2026-07-01T09:05:00.000+09:00","signals":["completion_claim_seen","validation_signal_seen","next_step_signal_seen"]}\n'
    );

    await runtime.pollOnce();
    await runtime.pollOnce();

    const updated = runtime.getSnapshot();
    expect(updated.workstreams).toHaveLength(1);
    expect(updated.attention).toHaveLength(0);
    expect(updated.dailySummary).toEqual({ unresolved: 0, verifiedDone: 1, carryOver: 0 });
    expect(updated.sourceStatus.parsedLineCount).toBe(2);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual(updated);
  });

  it("does not publish duplicate updates when only generatedAt would change", async () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-runtime-stable-"));
    const inputPath = join(dir, "events.jsonl");
    const statePath = join(dir, "state.json");
    let tick = 0;
    writeFileSync(
      inputPath,
      '{"kind":"demo","sessionId":"stable-session","time":"2026-07-01T09:00:00.000+09:00","signals":["session_started","next_step_signal_seen"]}\n'
    );
    const runtime = createSnapshotRuntime({
      mode: "demo",
      inputPath,
      statePath,
      sourceType: "demo",
      timezone: "Asia/Seoul",
      staleThresholdMs: 2 * 60 * 60 * 1000,
      now: () => new Date(`2026-07-01T09:${String(tick++).padStart(2, "0")}:00.000+09:00`)
    });

    await runtime.pollOnce();
    let updateCount = 0;
    runtime.subscribe(() => {
      updateCount += 1;
    });

    await runtime.pollOnce();

    expect(updateCount).toBe(0);

    appendFileSync(
      inputPath,
      '{"kind":"demo","sessionId":"stable-session","time":"2026-07-01T09:05:00.000+09:00","signals":["completion_claim_seen","validation_signal_seen"]}\n'
    );
    await runtime.pollOnce();

    expect(updateCount).toBe(1);
  });

  it("uses configured timezone date and filters workstreams to that local day", async () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-today-"));
    const inputPath = join(dir, "events.jsonl");
    const statePath = join(dir, "state.json");
    writeFileSync(inputPath, readFileSync("fixtures/today-stale-boundary.jsonl", "utf8"));
    const runtime = createSnapshotRuntime({
      mode: "demo",
      inputPath,
      statePath,
      sourceType: "demo",
      timezone: "Asia/Seoul",
      staleThresholdMs: 2 * 60 * 60 * 1000,
      now: () => new Date("2026-07-01T09:00:00.000+09:00")
    });

    await runtime.pollOnce();

    const snapshot = runtime.getSnapshot();
    expect(snapshot.date).toBe("2026-07-01");
    expect(snapshot.workstreams).toHaveLength(1);
    expect(snapshot.attention).toHaveLength(1);
    expect(snapshot.attention[0].classification.attentionReason).toBe("stale");
    expect(snapshot.dailySummary).toEqual({ unresolved: 1, verifiedDone: 0, carryOver: 1 });
  });

  it("demo fixture has exact attention coverage and one verified done workstream", async () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-demo-"));
    const runtime = createSnapshotRuntime({
      mode: "demo",
      inputPath: "fixtures/demo-attention-gate.jsonl",
      statePath: join(dir, "state.json"),
      sourceType: "demo",
      timezone: "Asia/Seoul",
      staleThresholdMs: 2 * 60 * 60 * 1000,
      now: () => new Date("2026-07-01T10:00:00.000+09:00")
    });

    await runtime.pollOnce();

    const snapshot = runtime.getSnapshot();
    const attentionCounts = snapshot.attention.reduce<Record<string, number>>((counts, row) => {
      const reason = row.classification.attentionReason;
      if (reason) {
        counts[reason] = (counts[reason] ?? 0) + 1;
      }
      return counts;
    }, {});

    expect(attentionCounts).toEqual({
      missing_validation: 1,
      missing_next_step: 1,
      blocked: 1,
      stale: 1
    });
    expect(snapshot.workstreams.filter((row) => row.rawState === "verified_done")).toHaveLength(1);
    expect(snapshot.dailySummary).toEqual({ unresolved: 4, verifiedDone: 1, carryOver: 1 });
  });
});
