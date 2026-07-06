import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSnapshot, createSnapshotRuntime, writeSnapshot } from "../../src/server/store";
import { workstreamMetadataAliasKey } from "../../src/server/workstream-metadata";
import type { Classification, SafeFact, SourceStatus, TodaySnapshot, WorkstreamState } from "../../src/shared/contracts";

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
  const cmuxLabel = /^ws_cmux_events_(session|workspace|surface|pane|window)_([a-f0-9]{16})$/.exec(id);
  return {
    id,
    sourceType: facts[0]?.sourceType ?? "demo",
    label: cmuxLabel ? `${cmuxLabel[1]} ${cmuxLabel[2].slice(0, 6)}` : id === "ws_done" ? "Workstream 1" : "Workstream 2",
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

  it("links a cmux session summary to its related workspace summary", () => {
    const workspaceFact: SafeFact = {
      id: "fact_workspace",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:00:00.000Z",
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      code: "activity_seen",
      sourceEventType: "system"
    };
    const sessionFact: SafeFact = {
      id: "fact_session",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:05:00.000Z",
      workstreamId: "ws_cmux_events_session_bbbbbbbb22222222",
      relatedScopeIds: ["ws_cmux_events_workspace_aaaaaaaa11111111"],
      code: "tool_started",
      sourceEventType: "tool"
    };
    const snapshot = buildSnapshot({
      mode: "real",
      date: "2026-07-02",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-02T05:10:00.000Z",
      sourceStatus,
      workstreams: [
        workstream("ws_cmux_events_workspace_aaaaaaaa11111111", "running", [workspaceFact]),
        workstream("ws_cmux_events_session_bbbbbbbb22222222", "running", [sessionFact])
      ],
      classifications: [
        classification("ws_cmux_events_workspace_aaaaaaaa11111111", null),
        classification("ws_cmux_events_session_bbbbbbbb22222222", null)
      ]
    });

    const session = snapshot.workstreams.find((row) => row.scopeKind === "session");
    expect(session).toMatchObject({
      parentScopeId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      parentLabel: "workspace aaaaaa",
      parentScopeKind: "workspace"
    });
    expect(JSON.stringify(snapshot)).not.toContain("opaque-workspace");
  });

  it("carries safe cmux scope aliases into summaries and parent hints", () => {
    const workspaceFact: SafeFact = {
      id: "fact_workspace",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:00:00.000Z",
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      code: "activity_seen",
      sourceEventType: "system",
      scopeAlias: { kind: "repo", label: "stock-auto" }
    };
    const sessionFact: SafeFact = {
      id: "fact_session",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:05:00.000Z",
      workstreamId: "ws_cmux_events_session_bbbbbbbb22222222",
      relatedScopeIds: ["ws_cmux_events_workspace_aaaaaaaa11111111"],
      code: "tool_started",
      sourceEventType: "tool"
    };

    const snapshot = buildSnapshot({
      mode: "real",
      date: "2026-07-02",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-02T05:10:00.000Z",
      sourceStatus,
      workstreams: [
        workstream("ws_cmux_events_workspace_aaaaaaaa11111111", "running", [workspaceFact]),
        workstream("ws_cmux_events_session_bbbbbbbb22222222", "running", [sessionFact])
      ],
      classifications: [
        classification("ws_cmux_events_workspace_aaaaaaaa11111111", null),
        classification("ws_cmux_events_session_bbbbbbbb22222222", null)
      ]
    });

    const workspace = snapshot.workstreams.find((row) => row.scopeKind === "workspace");
    const session = snapshot.workstreams.find((row) => row.scopeKind === "session");

    expect(workspace).toMatchObject({
      scopeAlias: { kind: "repo", label: "stock-auto" }
    });
    expect(session).toMatchObject({
      parentScopeAlias: { kind: "repo", label: "stock-auto" }
    });
  });

  it("drops unsafe scope aliases before emitting public summaries", () => {
    const workspaceFact: SafeFact = {
      id: "fact_workspace",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:00:00.000Z",
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      code: "activity_seen",
      sourceEventType: "system",
      scopeAlias: { kind: "repo", label: "secret-token-project" }
    };

    const snapshot = buildSnapshot({
      mode: "real",
      date: "2026-07-02",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-02T05:10:00.000Z",
      sourceStatus,
      workstreams: [workstream("ws_cmux_events_workspace_aaaaaaaa11111111", "running", [workspaceFact])],
      classifications: [classification("ws_cmux_events_workspace_aaaaaaaa11111111", null)]
    });

    expect(snapshot.workstreams[0].scopeAlias).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain("secret-token-project");
  });

  it("applies sanitized workstream metadata to public summaries", () => {
    const workspaceFact: SafeFact = {
      id: "fact_workspace",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:00:00.000Z",
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      code: "activity_seen",
      sourceEventType: "system"
    };

    const snapshot = buildSnapshot({
      mode: "real",
      date: "2026-07-02",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-02T05:10:00.000Z",
      sourceStatus,
      workstreams: [workstream("ws_cmux_events_workspace_aaaaaaaa11111111", "running", [workspaceFact])],
      classifications: [classification("ws_cmux_events_workspace_aaaaaaaa11111111", null)],
      workstreamMetadata: new Map([
        [
          "ws_cmux_events_workspace_aaaaaaaa11111111",
          {
            workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
            safeTitle: "Review missing validation queue",
            safeStatus: "waiting",
            safeKind: "workspace",
            safeRepoAlias: { kind: "repo", label: "stock-auto" },
            activity: {
              state: "running_tool",
              summary: "Editing dashboard activity panel",
              plan: "Add active session inspector",
              lastTool: "Bash"
            }
          }
        ]
      ])
    });

    expect(snapshot.workstreams[0]).toMatchObject({
      label: "Review missing validation queue",
      rawState: "waiting",
      scopeKind: "workspace",
      scopeAlias: { kind: "repo", label: "stock-auto" },
      activity: {
        state: "running_tool",
        summary: "Editing dashboard activity panel",
        plan: "Add active session inspector",
        lastTool: "Bash"
      }
    });
    expect(snapshot.workstreams[0].displayHints).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain("/workspace/projects/stock-auto");
  });

  it("uses repo-alias metadata to auto-label workstreams when source ids do not match", () => {
    const workspaceFact: SafeFact = {
      id: "fact_workspace",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:00:00.000Z",
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      code: "activity_seen",
      sourceEventType: "system",
      scopeAlias: { kind: "repo", label: "latchboard" }
    };

    const snapshot = buildSnapshot({
      mode: "real",
      date: "2026-07-02",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-02T05:10:00.000Z",
      sourceStatus,
      workstreams: [workstream("ws_cmux_events_workspace_aaaaaaaa11111111", "running", [workspaceFact])],
      classifications: [classification("ws_cmux_events_workspace_aaaaaaaa11111111", null)],
      workstreamMetadata: new Map([
        [
          workstreamMetadataAliasKey({ kind: "repo", label: "latchboard" }),
          {
            workstreamId: "ws_cmux_events_workspace_unmatched",
            safeTitle: "Review validation queue",
            safeRepoAlias: { kind: "repo", label: "latchboard" }
          }
        ]
      ])
    });

    expect(snapshot.workstreams[0]).toMatchObject({
      label: "Review validation queue",
      scopeAlias: { kind: "repo", label: "latchboard" }
    });
    expect(snapshot.workstreams[0].displayHints).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain("ws_cmux_events_workspace_unmatched");
  });

  it("marks unlabeled cmux workspace summaries as needing a safe label", () => {
    const workspaceFact: SafeFact = {
      id: "fact_workspace",
      sourceType: "cmux_events",
      occurredAt: "2026-07-02T05:00:00.000Z",
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      code: "activity_seen",
      sourceEventType: "system"
    };

    const snapshot = buildSnapshot({
      mode: "real",
      date: "2026-07-02",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-02T05:10:00.000Z",
      sourceStatus,
      workstreams: [workstream("ws_cmux_events_workspace_aaaaaaaa11111111", "running", [workspaceFact])],
      classifications: [classification("ws_cmux_events_workspace_aaaaaaaa11111111", "missing_next_step")]
    });

    expect(snapshot.workstreams[0]).toMatchObject({
      label: "workspace aaaaaa",
      displayHints: ["needs_safe_label"]
    });
    expect(snapshot.attention[0]).toMatchObject({
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      displayHints: ["needs_safe_label"]
    });
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

  it("registers a safe label, rebuilds the snapshot, writes sidecar, and publishes the update", async () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-runtime-label-"));
    const inputPath = join(dir, "events.jsonl");
    const workstreamInputPath = join(dir, "workstream.jsonl");
    const statePath = join(dir, "state.json");
    writeFileSync(
      inputPath,
      `${JSON.stringify({
        type: "event",
        name: "workspace.selected",
        occurred_at: "2026-07-03T05:00:00.000Z",
        payload: {
          workspace_id: "opaque-workspace-1",
          cwd: "/workspace/dev"
        }
      })}\n`
    );
    const runtime = createSnapshotRuntime({
      mode: "real",
      inputPath,
      workstreamInputPath,
      statePath,
      sourceType: "cmux_events",
      timezone: "Asia/Seoul",
      staleThresholdMs: 2 * 60 * 60 * 1000,
      now: () => new Date("2026-07-03T14:10:00.000+09:00")
    });

    await runtime.pollOnce();
    const initial = runtime.getSnapshot();
    const workstreamId = initial.workstreams[0].workstreamId;
    expect(initial.workstreams[0].displayHints).toEqual(["needs_safe_label"]);

    let published: TodaySnapshot | null = null;
    runtime.subscribe((snapshot) => {
      published = snapshot;
    });

    const updated = runtime.registerSafeLabel(workstreamId, "Review validation queue");

    expect(updated.workstreams[0]).toMatchObject({
      workstreamId,
      label: "Review validation queue"
    });
    expect(updated.workstreams[0].displayHints).toBeUndefined();
    expect(published).toEqual(updated);
    expect(JSON.parse(readFileSync(statePath, "utf8"))).toEqual(updated);
    expect(readFileSync(workstreamInputPath, "utf8")).toContain('"safeTitle":"Review validation queue"');
    expect(readFileSync(workstreamInputPath, "utf8")).not.toContain("opaque-workspace-1");
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
