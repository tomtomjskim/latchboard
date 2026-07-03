import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import type { RawState, ScopeAlias, ScopeKind, WorkstreamMetadata } from "../shared/contracts";

const unsafeFragments = [
  "accesskey",
  "api_key",
  "apikey",
  "auth",
  "canary",
  "confidential",
  "cookie",
  "credential",
  "ghp",
  "github_pat",
  "password",
  "patprefix",
  "private_key",
  "privatekey",
  "secretkey",
  "skproj",
  "secret",
  "token"
];
const genericAliasSegments = new Set([
  "app",
  "apps",
  "code",
  "dev",
  "home",
  "private",
  "project",
  "projects",
  "repo",
  "repos",
  "src",
  "user",
  "users",
  "workspace",
  "workspaces"
]);
const repoContainerSegments = new Set(["code", "projects", "repos", "workspaces"]);
const sensitiveTitleTerms = new Set(["account", "client", "customer", "email", "invoice", "order", "payment", "phone", "refund"]);
const allowedStatuses = new Set<RawState>(["running", "waiting", "done_claimed", "verified_done", "unknown"]);
const allowedKinds = new Set<ScopeKind>(["workspace", "session", "surface", "pane", "window", "workstream"]);
const localAccountAlias = userInfo().username.toLowerCase();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, field: string): string | undefined {
  const raw = value[field];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
}

function containsUnsafeFragment(value: string): boolean {
  const lowered = value.toLowerCase();
  const compacted = lowered.replace(/[^a-z0-9]/g, "");
  return unsafeFragments.some((fragment) => lowered.includes(fragment) || compacted.includes(fragment));
}

function containsSensitiveTitleTerm(value: string): boolean {
  const lowered = value.toLowerCase();
  return [...sensitiveTitleTerms].some((term) => new RegExp(`\\b${term}\\b`).test(lowered));
}

function safeIsoTime(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function safeCmuxWorkspaceId(raw: string): string {
  if (/^ws_cmux_events_(workspace|session|surface|pane|window|workstream)_[a-f0-9]{16}$/.test(raw)) {
    return raw;
  }

  const digest = createHash("sha256").update(`workspace_id:${raw}`).digest("hex").slice(0, 16);
  return `ws_cmux_events_workspace_${digest}`;
}

function sanitizeRepoAliasLabel(value: string): string | undefined {
  const label = value.trim();
  if (!label || label.length < 2 || label.length > 48) {
    return undefined;
  }
  if (label === "." || label === ".." || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(label)) {
    return undefined;
  }

  const lowered = label.toLowerCase();
  if (genericAliasSegments.has(lowered) || containsUnsafeFragment(label)) {
    return undefined;
  }
  if (localAccountAlias.length >= 3 && lowered === localAccountAlias) {
    return undefined;
  }

  return label;
}

export function safeRepoAliasFromCwd(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 512 || containsUnsafeFragment(value)) {
    return undefined;
  }

  const segments = value
    .trim()
    .replace(/[\\/]+$/, "")
    .split(/[\\/]+/)
    .filter(Boolean);

  for (let index = segments.length - 2; index >= 0; index -= 1) {
    if (!repoContainerSegments.has(segments[index].toLowerCase())) {
      continue;
    }

    return sanitizeRepoAliasLabel(segments[index + 1]);
  }

  return undefined;
}

export function sanitizeWorkstreamTitle(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const title = value.trim().replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 80) {
    return undefined;
  }
  if (/[/\\]/.test(title) || /https?:\/\//i.test(title) || /^[\[{]/.test(title)) {
    return undefined;
  }
  if (/^(npm|pnpm|yarn|node|tsx|python|python3|git|gh|curl|ssh|scp|rm|cp|mv)\s+/i.test(title)) {
    return undefined;
  }
  if (containsUnsafeFragment(title) || containsSensitiveTitleTerm(title)) {
    return undefined;
  }
  if (localAccountAlias.length >= 3 && title.toLowerCase().includes(localAccountAlias)) {
    return undefined;
  }

  return title;
}

function safeStatus(value: unknown): RawState | undefined {
  return allowedStatuses.has(value as RawState) ? (value as RawState) : undefined;
}

function safeKind(value: unknown): ScopeKind | undefined {
  return allowedKinds.has(value as ScopeKind) ? (value as ScopeKind) : undefined;
}

function safeAlias(value: unknown): ScopeAlias | undefined {
  const label = safeRepoAliasFromCwd(value);
  return label ? { kind: "repo", label } : undefined;
}

function metadataFromRecord(value: Record<string, unknown>): WorkstreamMetadata | undefined {
  const rawId = stringField(value, "workstreamId");
  if (!rawId) {
    return undefined;
  }

  const metadata: WorkstreamMetadata = {
    workstreamId: safeCmuxWorkspaceId(rawId)
  };
  const explicitSafeTitle = Object.hasOwn(value, "safeTitle");
  const title = sanitizeWorkstreamTitle(explicitSafeTitle ? value.safeTitle : value.title);
  const status = safeStatus(value.status);
  const kind = safeKind(value.kind);
  const alias = safeAlias(value.cwd);
  const createdAt = safeIsoTime(value.createdAt);
  const updatedAt = safeIsoTime(value.updatedAt);

  if (title) {
    metadata.safeTitle = title;
  }
  if (status) {
    metadata.safeStatus = status;
  }
  if (kind) {
    metadata.safeKind = kind;
  }
  if (alias) {
    metadata.safeRepoAlias = alias;
  }
  if (createdAt) {
    metadata.createdAt = createdAt;
  }
  if (updatedAt) {
    metadata.updatedAt = updatedAt;
  }

  return metadata;
}

export function readWorkstreamMetadata(path: string | undefined): Map<string, WorkstreamMetadata> {
  const metadata = new Map<string, WorkstreamMetadata>();
  if (!path || !existsSync(path)) {
    return metadata;
  }

  const text = readFileSync(path, "utf8");
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n").slice(0, -1);
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const value = JSON.parse(line);
      if (!isRecord(value)) {
        continue;
      }

      const entry = metadataFromRecord(value);
      if (entry) {
        metadata.set(entry.workstreamId, entry);
      }
    } catch {
      // Ignore malformed metadata lines; sourceStatus remains owned by events.jsonl.
    }
  }

  return metadata;
}
