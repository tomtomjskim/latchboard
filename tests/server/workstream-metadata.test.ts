import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readWorkstreamMetadata,
  sanitizeWorkstreamTitle,
  safeRepoAliasFromCwd,
  workstreamMetadataAliasKey
} from "../../src/server/workstream-metadata";

describe("sanitizeWorkstreamTitle", () => {
  it("keeps compact operator-safe titles", () => {
    expect(sanitizeWorkstreamTitle("Review missing validation queue")).toBe("Review missing validation queue");
  });

  it("drops paths, urls, command-like strings, json, usernames, and secret-looking titles", () => {
    const username = userInfo().username;
    const unsafe = [
      "/workspace/private/acme/project",
      "https://example.com/task",
      "npm run deploy",
      '{"prompt":"raw prompt terminal output"}',
      `handoff for ${username}`,
      "token-prefix-secret",
      "github_pat_example_value",
      "Fix customer Acme refund issue before launch"
    ];

    unsafe.forEach((title) => {
      expect(sanitizeWorkstreamTitle(title)).toBeUndefined();
    });
  });
});

describe("safeRepoAliasFromCwd", () => {
  it("uses a repo-like path segment instead of generic dev folders", () => {
    expect(safeRepoAliasFromCwd("/workspace/projects/stock-auto/src")).toBe("stock-auto");
    expect(safeRepoAliasFromCwd("/workspace/dev/latchboard")).toBe("latchboard");
  });

  it("drops generic folders and secret-looking aliases", () => {
    expect(safeRepoAliasFromCwd("/workspace/dev")).toBeUndefined();
    expect(safeRepoAliasFromCwd("/workspace/dev/secret-token-project")).toBeUndefined();
    expect(safeRepoAliasFromCwd("/workspace/client-acme/dev")).toBeUndefined();
  });
});

describe("readWorkstreamMetadata", () => {
  it("reads complete jsonl records into sanitized metadata keyed by workstream id", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-workstream-meta-"));
    const path = join(dir, "workstream.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
          title: "Fix customer Acme refund issue before launch",
          safeTitle: "Review missing validation queue",
          status: "running",
          kind: "workspace",
          cwd: "/workspace/projects/stock-auto/src",
          createdAt: "2026-07-03T01:00:00.000Z",
          updatedAt: "2026-07-03T01:30:00.000Z"
        }),
        JSON.stringify({
          workstreamId: "ws_cmux_events_workspace_bbbbbbbb22222222",
          title: "Review missing validation queue",
          safeTitle: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW",
          status: "weird",
          kind: "unknown-kind",
          cwd: "/workspace/dev",
          createdAt: "not a date",
          updatedAt: "2026-07-03T02:30:00.000Z"
        }),
        JSON.stringify({
          workstreamId: "ws_cmux_events_workspace_cccccccc33333333",
          title: "Review validation queue",
          status: "running",
          kind: "workspace",
          cwd: "/workspace/projects/latchboard",
          context: {
            toolSummary: "Editing dashboard activity panel",
            planSummary: "Add active session inspector"
          },
          payload: {
            toolUse: {
              toolName: "Bash"
            }
          },
          updatedAt: "2026-07-03T03:30:00.000Z"
        }),
        JSON.stringify({
          workstreamId: "ws_cmux_events_workspace_dddddddd44444444",
          title: "Review validation queue",
          status: "running",
          kind: "workspace",
          cwd: "/workspace/projects/ops-dashboard",
          context: {
            toolSummary: "cat /workspace/private/acme/env",
            planSummary: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW"
          },
          payload: {
            toolUse: {
              toolName: "Bash && rm -rf /"
            }
          },
          updatedAt: "2026-07-03T04:30:00.000Z"
        }),
        ""
      ].join("\n")
    );

    const metadata = readWorkstreamMetadata(path);

    expect(metadata.get("ws_cmux_events_workspace_aaaaaaaa11111111")).toEqual({
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      safeTitle: "Review missing validation queue",
      safeStatus: "running",
      safeKind: "workspace",
      safeRepoAlias: { kind: "repo", label: "stock-auto" },
      createdAt: "2026-07-03T01:00:00.000Z",
      updatedAt: "2026-07-03T01:30:00.000Z"
    });
    expect(metadata.get("ws_cmux_events_workspace_bbbbbbbb22222222")).toEqual({
      workstreamId: "ws_cmux_events_workspace_bbbbbbbb22222222",
      updatedAt: "2026-07-03T02:30:00.000Z"
    });
    expect(metadata.get("ws_cmux_events_workspace_cccccccc33333333")).toEqual({
      workstreamId: "ws_cmux_events_workspace_cccccccc33333333",
      safeTitle: "Review validation queue",
      safeStatus: "running",
      safeKind: "workspace",
      safeRepoAlias: { kind: "repo", label: "latchboard" },
      activity: {
        state: "running_tool",
        summary: "Editing dashboard activity panel",
        plan: "Add active session inspector",
        lastTool: "Bash"
      },
      updatedAt: "2026-07-03T03:30:00.000Z"
    });
    expect(metadata.get(workstreamMetadataAliasKey({ kind: "repo", label: "latchboard" }))).toMatchObject({
      safeTitle: "Review validation queue",
      safeRepoAlias: { kind: "repo", label: "latchboard" },
      activity: {
        state: "running_tool",
        summary: "Editing dashboard activity panel",
        plan: "Add active session inspector",
        lastTool: "Bash"
      }
    });
    expect(metadata.get("ws_cmux_events_workspace_dddddddd44444444")).toMatchObject({
      workstreamId: "ws_cmux_events_workspace_dddddddd44444444",
      safeTitle: "Review validation queue",
      safeStatus: "running",
      safeKind: "workspace",
      safeRepoAlias: { kind: "repo", label: "ops-dashboard" },
      activity: {
        state: "running_tool"
      },
      updatedAt: "2026-07-03T04:30:00.000Z"
    });
    expect(JSON.stringify([...metadata.values()])).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
    expect(JSON.stringify([...metadata.values()])).not.toContain("Fix customer Acme refund issue before launch");
    expect(JSON.stringify([...metadata.values()])).not.toContain("cat /workspace/private/acme/env");
    expect(JSON.stringify([...metadata.values()])).not.toContain("Bash && rm -rf /");
    expect(JSON.stringify([...metadata.values()])).not.toContain("/workspace/dev");
  });

  it("merges sparse records without dropping prior safe activity metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-workstream-meta-"));
    const path = join(dir, "workstream.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          workstreamId: "ws_cmux_events_workspace_eeeeeeee55555555",
          title: "Review active inspector",
          status: "running",
          kind: "workspace",
          cwd: "/workspace/projects/latchboard",
          context: {
            toolSummary: "Editing dashboard activity panel"
          },
          payload: {
            toolUse: {
              toolName: "Bash"
            }
          },
          updatedAt: "2026-07-03T05:00:00.000Z"
        }),
        JSON.stringify({
          workstreamId: "ws_cmux_events_workspace_eeeeeeee55555555",
          title: "Review active inspector",
          status: "waiting",
          kind: "workspace",
          cwd: "/workspace/projects/latchboard",
          updatedAt: "2026-07-03T05:05:00.000Z"
        }),
        ""
      ].join("\n")
    );

    const metadata = readWorkstreamMetadata(path);

    expect(metadata.get("ws_cmux_events_workspace_eeeeeeee55555555")).toMatchObject({
      workstreamId: "ws_cmux_events_workspace_eeeeeeee55555555",
      safeTitle: "Review active inspector",
      safeStatus: "waiting",
      safeKind: "workspace",
      safeRepoAlias: { kind: "repo", label: "latchboard" },
      activity: {
        state: "running_tool",
        summary: "Editing dashboard activity panel",
        lastTool: "Bash"
      },
      updatedAt: "2026-07-03T05:05:00.000Z"
    });
    expect(metadata.get(workstreamMetadataAliasKey({ kind: "repo", label: "latchboard" }))).toMatchObject({
      activity: {
        state: "running_tool",
        summary: "Editing dashboard activity panel",
        lastTool: "Bash"
      }
    });
  });
});
