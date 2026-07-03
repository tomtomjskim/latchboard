import { createHash } from "node:crypto";
import { userInfo } from "node:os";
import type { SafeFact, SafeFactCode, SafeSourceEventType, ScopeAlias, SourceType } from "../shared/contracts";
import type { JsonLineRecord } from "./events-adapter";

const allowedCodes = new Set<SafeFactCode>([
  "activity_seen",
  "session_started",
  "tool_started",
  "tool_finished",
  "tool_failed",
  "completion_claim_seen",
  "validation_signal_seen",
  "next_step_signal_seen",
  "blocked_signal_seen",
  "idle_signal_seen",
  "unknown_safe_event"
]);

const workstreamIdentityFields = [
  "workstreamId",
  "workstream_id",
  "sessionId",
  "session_id",
  "threadId",
  "thread_id",
  "conversationId",
  "conversation_id",
  "runId"
] as const;

type CmuxIdentityField = "session_id" | "surface_id" | "pane_id" | "workspace_id" | "window_id";

const cmuxActionIdentityFields: CmuxIdentityField[] = [
  "session_id",
  "workspace_id",
  "surface_id",
  "pane_id",
  "window_id"
];
const cmuxActivityIdentityFields: CmuxIdentityField[] = [
  "workspace_id",
  "surface_id",
  "pane_id",
  "window_id",
  "session_id"
];
const cmuxNeutralActivityNames = new Set([
  "notification.clear_requested",
  "notification.cleared",
  "notification.created",
  "notification.read",
  "notification.removed",
  "pane.created",
  "pane.focused",
  "surface.closed",
  "surface.created",
  "surface.focused",
  "surface.selected",
  "window.focused",
  "window.keyed",
  "window.unkeyed",
  "workspace.created",
  "workspace.selected"
]);
const unsafeAliasFragments = [
  "accesskey",
  "api_key",
  "apikey",
  "auth",
  "canary",
  "confidential",
  "cookie",
  "credential",
  "ghp",
  "password",
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
const localAccountAlias = userInfo().username.toLowerCase();

export type NormalizeOptions = {
  showRepoAliases?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceEventType(value: unknown): SafeSourceEventType {
  if (value === "session" || value === "tool" || value === "assistant" || value === "system") {
    return value;
  }
  return "unknown";
}

function safeTime(...values: unknown[]): string {
  for (const candidate of values) {
    if (typeof candidate !== "string") {
      continue;
    }

    const timestamp = Date.parse(candidate);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return new Date(0).toISOString();
}

function safeSignals(value: unknown): SafeFactCode[] {
  const signals = Array.isArray(value) ? value : ["unknown_safe_event"];
  return signals.map((signal) =>
    allowedCodes.has(signal as SafeFactCode) ? (signal as SafeFactCode) : "unknown_safe_event"
  );
}

function stringField(value: Record<string, unknown>, field: string): string | undefined {
  const raw = value[field];
  return typeof raw === "string" && raw.trim().length > 0 ? raw : undefined;
}

function payloadRecord(value: Record<string, unknown>): Record<string, unknown> {
  return isRecord(value.payload) ? value.payload : {};
}

function cmuxSignalForName(name: string): SafeFactCode | null {
  if (cmuxNeutralActivityNames.has(name)) {
    return "activity_seen";
  }

  switch (name) {
    case "agent.hook.SessionStart":
    case "agent.hook.UserPromptSubmit":
      return "session_started";
    case "agent.hook.PreToolUse":
    case "feed.item.received":
      return "tool_started";
    case "feed.item.completed":
      return "tool_finished";
    case "agent.hook.Stop":
      return "activity_seen";
    default:
      return null;
  }
}

function cmuxSourceEventType(name: string): SafeSourceEventType {
  if (name === "agent.hook.SessionStart") {
    return "session";
  }
  if (name === "agent.hook.PreToolUse" || name === "feed.item.received" || name === "feed.item.completed") {
    return "tool";
  }
  if (name.startsWith("agent.hook.")) {
    return "assistant";
  }
  if (name.startsWith("notification.")) {
    return "system";
  }
  if (
    name.startsWith("pane.") ||
    name.startsWith("surface.") ||
    name.startsWith("window.") ||
    name.startsWith("workspace.")
  ) {
    return "system";
  }
  return "unknown";
}

function cmuxIdentityFieldsForName(name: string | undefined): CmuxIdentityField[] {
  if (!name) {
    return cmuxActivityIdentityFields;
  }

  return cmuxSourceEventType(name) === "tool" || name.startsWith("agent.hook.")
    ? cmuxActionIdentityFields
    : cmuxActivityIdentityFields;
}

function cmuxScopeId(field: CmuxIdentityField, raw: string): string {
  const digest = createHash("sha256").update(`${field}:${raw}`).digest("hex").slice(0, 16);
  return `ws_cmux_events_${field.replace("_id", "")}_${digest}`;
}

function cmuxScopeIdsFor(value: Record<string, unknown>, fields: CmuxIdentityField[]): string[] {
  const payload = payloadRecord(value);
  const ids: string[] = [];
  for (const field of fields) {
    const raw = stringField(payload, field) ?? stringField(value, field);
    if (raw) {
      ids.push(cmuxScopeId(field, raw));
    }
  }

  return Array.from(new Set(ids));
}

function sanitizeRepoAliasLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const label = value.trim();
  if (!label || label.length < 2 || label.length > 48) {
    return undefined;
  }
  if (label === "." || label === ".." || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(label)) {
    return undefined;
  }

  const lowered = label.toLowerCase();
  const compacted = lowered.replace(/[^a-z0-9]/g, "");
  if (genericAliasSegments.has(lowered)) {
    return undefined;
  }
  if (unsafeAliasFragments.some((fragment) => lowered.includes(fragment) || compacted.includes(fragment))) {
    return undefined;
  }
  if (localAccountAlias.length >= 3 && lowered === localAccountAlias) {
    return undefined;
  }

  return label;
}

function safeRepoAliasLabelFromPath(value: unknown): string | undefined {
  if (typeof value !== "string") {
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

export function sanitizeScopeAlias(value: unknown): ScopeAlias | undefined {
  if (!isRecord(value) || value.kind !== "repo") {
    return undefined;
  }

  const label = sanitizeRepoAliasLabel(value.label);
  return label ? { kind: "repo", label } : undefined;
}

function cmuxScopeAliasFor(
  value: Record<string, unknown>,
  sourceType: SourceType,
  options: NormalizeOptions
): ScopeAlias | undefined {
  if (!options.showRepoAliases || sourceType !== "cmux_events" || stringField(value, "name") !== "workspace.selected") {
    return undefined;
  }

  const label = safeRepoAliasLabelFromPath(payloadRecord(value).cwd);
  return label ? { kind: "repo", label } : undefined;
}

function safeFactCodesFor(value: Record<string, unknown>, sourceType: SourceType): SafeFactCode[] {
  const name = stringField(value, "name");
  if (sourceType === "cmux_events" && stringField(value, "type") === "event" && name) {
    const signal = cmuxSignalForName(name);
    return signal ? [signal] : [];
  }

  if (sourceType === "demo" && Array.isArray(value.signals)) {
    return safeSignals(value.signals);
  }

  return ["unknown_safe_event"];
}

function workstreamIdFor(value: Record<string, unknown>, sourceType: SourceType, lineNumber: number): string {
  if (sourceType === "cmux_events") {
    const name = stringField(value, "name");
    const [firstScopeId] = cmuxScopeIdsFor(value, cmuxIdentityFieldsForName(name));
    if (firstScopeId) {
      return firstScopeId;
    }
  }

  for (const field of workstreamIdentityFields) {
    const raw = stringField(value, field);
    if (raw) {
      const digest = createHash("sha256").update(`${field}:${raw}`).digest("hex").slice(0, 16);
      return `ws_${sourceType}_${digest}`;
    }
  }

  return `ws_${sourceType}_${lineNumber}`;
}

export function normalizeRecords(
  records: JsonLineRecord[],
  sourceType: SourceType,
  options: NormalizeOptions = {}
): SafeFact[] {
  const facts: SafeFact[] = [];

  records.forEach((record) => {
    const value = isRecord(record.value) ? record.value : {};
    const workstreamId = workstreamIdFor(value, sourceType, record.lineNumber);
    const signals = safeFactCodesFor(value, sourceType);
    const payload = payloadRecord(value);
    const name = stringField(value, "name");
    const scopeAlias = cmuxScopeAliasFor(value, sourceType, options);
    const relatedScopeIds =
      sourceType === "cmux_events"
        ? cmuxScopeIdsFor(value, cmuxIdentityFieldsForName(name)).filter((id) => id !== workstreamId)
        : [];

    signals.forEach((code, index) => {
      facts.push({
        id: `fact_${workstreamId}_${record.lineNumber}_${index}`,
        sourceType,
        occurredAt: safeTime(value.time, value.occurred_at, payload._received_at),
        workstreamId,
        ...(relatedScopeIds.length > 0 ? { relatedScopeIds } : {}),
        ...(scopeAlias ? { scopeAlias } : {}),
        code,
        sourceEventType: name && sourceType === "cmux_events" ? cmuxSourceEventType(name) : sourceEventType(value.kind)
      });
    });
  });

  return facts;
}
