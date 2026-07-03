import type { AttentionReason, RawState, SafeFactCode, ScopeAlias, ScopeKind, TodaySnapshot } from "../shared/contracts";

export type RefreshStatus = "bootstrapping" | "ready" | "refreshing" | "retrying" | "disconnected";

const reasonLabels: Record<AttentionReason, string> = {
  missing_validation: "Missing validation",
  missing_next_step: "Missing next step",
  blocked: "Blocked",
  stale: "Stale"
};

const reasonShortLabels: Record<AttentionReason, string> = {
  missing_validation: "D",
  missing_next_step: "B",
  blocked: "Blocked",
  stale: "Stale"
};

export const stateLabels: Record<RawState, string> = {
  running: "running",
  waiting: "waiting",
  done_claimed: "done claimed",
  verified_done: "verified done",
  unknown: "unknown"
};

const scopeKindLabels: Record<ScopeKind, string> = {
  workspace: "workspace",
  session: "session",
  surface: "surface",
  pane: "pane",
  window: "window",
  workstream: "workstream"
};

const signalLabels: Record<SafeFactCode, string> = {
  activity_seen: "activity",
  session_started: "session",
  tool_started: "tool started",
  tool_finished: "tool finished",
  tool_failed: "tool failed",
  completion_claim_seen: "completion",
  validation_signal_seen: "validation",
  next_step_signal_seen: "next step",
  blocked_signal_seen: "blocked",
  idle_signal_seen: "idle",
  unknown_safe_event: "unknown"
};

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatMode(mode: TodaySnapshot["mode"]): string {
  return mode === "demo" ? "Demo" : "Real";
}

export function sourceModeLabel(snapshot: TodaySnapshot): string {
  if (snapshot.mode === "demo") {
    return "Demo fixture";
  }
  return snapshot.sourceStatus.connected ? "Live local data" : "Source disconnected";
}

export function sourceModeTone(snapshot: TodaySnapshot): string {
  if (snapshot.mode === "demo") {
    return "not-live";
  }
  return snapshot.sourceStatus.connected ? "live" : "disconnected";
}

export function formatConnection(connected: boolean): string {
  return connected ? "Connected" : "Disconnected";
}

export function refreshStatusLabel(status: RefreshStatus, snapshot: TodaySnapshot): string {
  if (!snapshot.sourceStatus.connected) {
    return "Disconnected";
  }

  const labels: Record<RefreshStatus, string> = {
    bootstrapping: "Loading",
    ready: "Live",
    refreshing: "Refreshing",
    retrying: "Retrying",
    disconnected: "Disconnected"
  };
  return labels[status];
}

export function attentionEmptyLabel(snapshot: TodaySnapshot): string {
  return snapshot.sourceStatus.connected ? "Connected, no attention items" : "Source disconnected, no attention items";
}

export function observedEmptyLabel(snapshot: TodaySnapshot): string {
  return snapshot.sourceStatus.connected ? "No observed scopes for today" : "Source disconnected";
}

export function reasonLabel(reason: AttentionReason | null): string {
  return reason ? reasonLabels[reason] : "No attention";
}

export function reasonShortLabel(reason: AttentionReason | null): string {
  return reason ? reasonShortLabels[reason] : "OK";
}

export function signalLabel(code: SafeFactCode): string {
  return signalLabels[code];
}

export function scopeKindLabel(kind: ScopeKind): string {
  return scopeKindLabels[kind];
}

export function scopeDetailLabel(scope: { label: string; scopeKind: ScopeKind }): string {
  const kind = scopeKindLabel(scope.scopeKind);
  const label = scope.label.toLowerCase().startsWith(`${kind} `) ? scope.label : `${kind} ${scope.label}`;
  const prefix = scope.scopeKind === "workstream" ? scope.label : label;
  return `View ${prefix} details`;
}

export function scopeAliasLabel(alias: ScopeAlias): string {
  return `${alias.kind} ${alias.label}`;
}
