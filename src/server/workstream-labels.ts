import { appendFileSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { WorkstreamMetadata } from "../shared/contracts";
import type { RawState, ScopeKind } from "../shared/contracts";
import { safeRepoAliasFromCwd, sanitizeWorkstreamTitle } from "./workstream-metadata";

export type WorkstreamLabelInput = {
  workstreamId: string;
  safeTitle: string;
  status?: string;
  kind?: string;
  cwd?: string;
};

const allowedStatuses = new Set<RawState>(["running", "waiting", "done_claimed", "verified_done", "unknown"]);
const allowedKinds = new Set<ScopeKind>(["workspace", "session", "surface", "pane", "window", "workstream"]);

function safeStatus(value: string | undefined): RawState | undefined {
  return allowedStatuses.has(value as RawState) ? (value as RawState) : undefined;
}

function safeKind(value: string | undefined): ScopeKind | undefined {
  return allowedKinds.has(value as ScopeKind) ? (value as ScopeKind) : undefined;
}

export function buildWorkstreamLabelRecord(input: WorkstreamLabelInput, now = new Date()): WorkstreamMetadata {
  const workstreamId = input.workstreamId.trim();
  if (!workstreamId) {
    throw new Error("workstreamId is required");
  }

  const safeTitle = sanitizeWorkstreamTitle(input.safeTitle);
  if (!safeTitle) {
    throw new Error("safeTitle did not pass sanitizer");
  }

  const record: WorkstreamMetadata = {
    workstreamId,
    safeTitle
  };
  const status = safeStatus(input.status);
  const kind = safeKind(input.kind);
  const repoAlias = safeRepoAliasFromCwd(input.cwd);

  if (status) {
    record.safeStatus = status;
  }
  if (kind) {
    record.safeKind = kind;
  }
  if (repoAlias) {
    record.safeRepoAlias = { kind: "repo", label: repoAlias };
  }
  record.updatedAt = now.toISOString();

  return record;
}

export function appendWorkstreamLabel(path: string, input: WorkstreamLabelInput, now = new Date()): WorkstreamMetadata {
  if (basename(path) !== "workstream.jsonl") {
    throw new Error("label metadata path must be named workstream.jsonl");
  }

  const record = buildWorkstreamLabelRecord(input, now);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}
