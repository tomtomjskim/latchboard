import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendWorkstreamLabel, buildWorkstreamLabelRecord } from "../../src/server/workstream-labels";

describe("buildWorkstreamLabelRecord", () => {
  it("builds a sanitized safeTitle metadata record", () => {
    const record = buildWorkstreamLabelRecord(
      {
        workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
        safeTitle: "Review validation queue",
        status: "running",
        kind: "workspace",
        cwd: "/workspace/projects/stock-auto/src"
      },
      new Date("2026-07-03T06:00:00.000Z")
    );

    expect(record).toEqual({
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      safeTitle: "Review validation queue",
      safeStatus: "running",
      safeKind: "workspace",
      safeRepoAlias: { kind: "repo", label: "stock-auto" },
      updatedAt: "2026-07-03T06:00:00.000Z"
    });
  });

  it("rejects unsafe safeTitle values before writing metadata", () => {
    expect(() =>
      buildWorkstreamLabelRecord(
        {
          workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
          safeTitle: "Fix customer Acme refund issue"
        },
        new Date("2026-07-03T06:00:00.000Z")
      )
    ).toThrow("safeTitle did not pass sanitizer");
  });
});

describe("appendWorkstreamLabel", () => {
  it("appends one sanitized complete JSONL line to workstream.jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-label-writer-"));
    const path = join(dir, "workstream.jsonl");

    const record = appendWorkstreamLabel(
      path,
      {
        workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
        safeTitle: "Review validation queue"
      },
      new Date("2026-07-03T06:00:00.000Z")
    );

    expect(record.safeTitle).toBe("Review validation queue");
    expect(readFileSync(path, "utf8")).toBe(
      '{"workstreamId":"ws_cmux_events_workspace_aaaaaaaa11111111","safeTitle":"Review validation queue","updatedAt":"2026-07-03T06:00:00.000Z"}\n'
    );
  });

  it("rejects metadata files not named workstream.jsonl", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-label-writer-"));
    const path = join(dir, "events.jsonl");

    expect(() =>
      appendWorkstreamLabel(
        path,
        {
          workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
          safeTitle: "Review validation queue"
        },
        new Date("2026-07-03T06:00:00.000Z")
      )
    ).toThrow("label metadata path must be named workstream.jsonl");
  });
});
