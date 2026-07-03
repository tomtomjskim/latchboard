import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readWorkstreamMetadata,
  sanitizeWorkstreamTitle,
  safeRepoAliasFromCwd
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
          updatedAt: "2026-07-03T03:30:00.000Z"
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
      updatedAt: "2026-07-03T03:30:00.000Z"
    });
    expect(JSON.stringify([...metadata.values()])).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
    expect(JSON.stringify([...metadata.values()])).not.toContain("Fix customer Acme refund issue before launch");
    expect(JSON.stringify([...metadata.values()])).not.toContain("/workspace/dev");
  });
});
