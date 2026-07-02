import "./styles.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AttentionReason,
  RawState,
  SafeFactCode,
  ScopeAlias,
  ScopeKind,
  TodaySnapshot,
  WorkstreamSummary
} from "../shared/contracts";
import { evidenceLabel, nextStepPromptLabel } from "../shared/contracts";
import { fetchSnapshot, readBootstrapSnapshot, readBootstrapToken } from "./api";

const snapshotPollMs = 2000;

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

const stateLabels: Record<RawState, string> = {
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

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: TodaySnapshot };

type WorkspaceGroup = {
  workspace: WorkstreamSummary;
  children: WorkstreamSummary[];
};

type GroupedScopes = {
  groups: WorkspaceGroup[];
  ungrouped: WorkstreamSummary[];
};

function formatDateTime(value: string): string {
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

function formatMode(mode: TodaySnapshot["mode"]): string {
  return mode === "demo" ? "Demo" : "Real";
}

function sourceModeLabel(snapshot: TodaySnapshot): string {
  if (snapshot.mode === "demo") {
    return "Demo fixture";
  }
  return snapshot.sourceStatus.connected ? "Live local data" : "Source disconnected";
}

function sourceModeTone(snapshot: TodaySnapshot): string {
  if (snapshot.mode === "demo") {
    return "not-live";
  }
  return snapshot.sourceStatus.connected ? "live" : "disconnected";
}

function formatConnection(connected: boolean): string {
  return connected ? "Connected" : "Disconnected";
}

function attentionEmptyLabel(snapshot: TodaySnapshot): string {
  return snapshot.sourceStatus.connected ? "Connected, no attention items" : "Source disconnected, no attention items";
}

function observedEmptyLabel(snapshot: TodaySnapshot): string {
  return snapshot.sourceStatus.connected ? "No observed scopes for today" : "Source disconnected";
}

function reasonLabel(reason: AttentionReason | null): string {
  return reason ? reasonLabels[reason] : "No attention";
}

function reasonShortLabel(reason: AttentionReason | null): string {
  return reason ? reasonShortLabels[reason] : "OK";
}

function signalLabel(code: SafeFactCode): string {
  return signalLabels[code];
}

function scopeKindLabel(kind: ScopeKind): string {
  return scopeKindLabels[kind];
}

function scopeDetailLabel(scope: { label: string; scopeKind: ScopeKind }): string {
  const kind = scopeKindLabel(scope.scopeKind);
  const label = scope.label.toLowerCase().startsWith(`${kind} `)
    ? scope.label
    : `${kind} ${scope.label}`;
  const prefix = scope.scopeKind === "workstream" ? scope.label : label;
  return `View ${prefix} details`;
}

function scopeAliasLabel(alias: ScopeAlias): string {
  return `${alias.kind} ${alias.label}`;
}

function ReasonChip({ reason }: { reason: AttentionReason | null }) {
  const label = reasonLabel(reason);

  return (
    <span className={`reason-chip ${reason ?? "none"}`} aria-label={label} title={label}>
      {reasonShortLabel(reason)}
    </span>
  );
}

function ParentHint({ scope }: { scope: { parentLabel?: string } }) {
  return scope.parentLabel ? <span className="parent-hint">Parent {scope.parentLabel}</span> : null;
}

function ScopeAliasBadge({ alias }: { alias?: ScopeAlias }) {
  return alias ? <span className="scope-alias">{scopeAliasLabel(alias)}</span> : null;
}

function childScopeCountLabel(count: number): string {
  return `${count} child ${count === 1 ? "scope" : "scopes"}`;
}

function workspaceGroupsFor(workstreams: WorkstreamSummary[]): GroupedScopes {
  const groupsById = new Map<string, WorkspaceGroup>();
  const groups: WorkspaceGroup[] = [];
  const ungrouped: WorkstreamSummary[] = [];

  workstreams.forEach((workstream) => {
    if (workstream.scopeKind !== "workspace") {
      return;
    }

    const group = { workspace: workstream, children: [] };
    groupsById.set(workstream.workstreamId, group);
    groups.push(group);
  });

  workstreams.forEach((workstream) => {
    if (workstream.scopeKind === "workspace") {
      return;
    }

    const parentGroup = workstream.parentScopeId ? groupsById.get(workstream.parentScopeId) : undefined;
    if (parentGroup) {
      parentGroup.children.push(workstream);
    } else {
      ungrouped.push(workstream);
    }
  });

  return { groups, ungrouped };
}

function selectedFromSnapshot(snapshot: TodaySnapshot, selectedId: string | null): WorkstreamSummary | null {
  if (selectedId) {
    const selected = snapshot.workstreams.find((workstream) => workstream.workstreamId === selectedId);
    if (selected) {
      return selected;
    }
  }

  const firstAttention = snapshot.attention[0];
  if (!firstAttention) {
    return snapshot.workstreams[0] ?? null;
  }

  return snapshot.workstreams.find((workstream) => workstream.workstreamId === firstAttention.workstreamId) ?? null;
}

function DetailPanel({ workstream }: { workstream: WorkstreamSummary | null }) {
  if (!workstream) {
    return (
      <aside className="detail-panel" aria-label="Scope detail">
        <p className="empty-state">No scope selected</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel" aria-label="Scope detail">
      <div className="section-heading">
        <ReasonChip reason={workstream.classification.attentionReason} />
        <div className="scope-title">
          <span className="scope-pill">{scopeKindLabel(workstream.scopeKind)}</span>
          <h2>{workstream.label}</h2>
          <ScopeAliasBadge alias={workstream.scopeAlias} />
        </div>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Scope</dt>
          <dd>{scopeKindLabel(workstream.scopeKind)}</dd>
        </div>
        {workstream.parentLabel ? (
          <div>
            <dt>Parent</dt>
            <dd>{workstream.parentLabel}</dd>
          </div>
        ) : null}
        {workstream.scopeAlias ? (
          <div>
            <dt>Alias</dt>
            <dd>{scopeAliasLabel(workstream.scopeAlias)}</dd>
          </div>
        ) : null}
        {workstream.parentScopeAlias ? (
          <div>
            <dt>Parent Alias</dt>
            <dd>{scopeAliasLabel(workstream.parentScopeAlias)}</dd>
          </div>
        ) : null}
        <div>
          <dt>State</dt>
          <dd>{stateLabels[workstream.rawState]}</dd>
        </div>
        <div>
          <dt>Attention</dt>
          <dd>{reasonLabel(workstream.classification.attentionReason)}</dd>
        </div>
        <div>
          <dt>Certainty</dt>
          <dd>{workstream.classification.certainty}</dd>
        </div>
        <div>
          <dt>Last Activity</dt>
          <dd>{formatDateTime(workstream.lastActivityAt)}</dd>
        </div>
        <div>
          <dt>Last Signal</dt>
          <dd>{signalLabel(workstream.lastSignalCode)}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{workstream.classification.evidenceCodes.map(evidenceLabel).join(" ")}</dd>
        </div>
        <div>
          <dt>Next Step</dt>
          <dd>{nextStepPromptLabel(workstream.classification.nextStepPromptTemplateId)}</dd>
        </div>
      </dl>
    </aside>
  );
}

function WorkstreamRowButton({
  workstream,
  isSelected,
  hasAttention,
  onSelect,
  className = "",
  relationshipLabel
}: {
  workstream: WorkstreamSummary;
  isSelected: boolean;
  hasAttention: boolean;
  onSelect: () => void;
  className?: string;
  relationshipLabel?: string;
}) {
  return (
    <button
      className={`workstream-row ${className} ${isSelected ? "is-selected" : ""}`}
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={scopeDetailLabel(workstream)}
    >
      <span className="row-title-block">
        <span className="row-title">{workstream.label}</span>
        <ScopeAliasBadge alias={workstream.scopeAlias} />
        <span className="scope-pill">{scopeKindLabel(workstream.scopeKind)}</span>
        {relationshipLabel ? <span className="parent-hint">{relationshipLabel}</span> : null}
        <ParentHint scope={workstream} />
      </span>
      <span>{stateLabels[workstream.rawState]}</span>
      <span>{signalLabel(workstream.lastSignalCode)}</span>
      <span>{hasAttention ? reasonLabel(workstream.classification.attentionReason) : "Clear"}</span>
      <span>{formatDateTime(workstream.lastActivityAt)}</span>
    </button>
  );
}

export function AppView({ snapshot }: { snapshot: TodaySnapshot }) {
  const [selectedId, setSelectedId] = useState<string | null>(snapshot.attention[0]?.workstreamId ?? null);
  const selected = useMemo(() => selectedFromSnapshot(snapshot, selectedId), [snapshot, selectedId]);
  const attentionIds = useMemo(() => new Set(snapshot.attention.map((row) => row.workstreamId)), [snapshot.attention]);
  const groupedScopes = useMemo(() => workspaceGroupsFor(snapshot.workstreams), [snapshot.workstreams]);

  return (
    <main className="app">
      <header className="today-bar" aria-label="Today status">
        <div className="brand-block">
          <strong>Latchboard</strong>
          <span>{formatMode(snapshot.mode)}</span>
          <span className={`source-mode-badge ${sourceModeTone(snapshot)}`}>{sourceModeLabel(snapshot)}</span>
          {snapshot.mode === "demo" ? <span className="source-mode-badge not-live">Not live data</span> : null}
        </div>
        <div className="today-metrics">
          <span>{snapshot.date}</span>
          <span>{formatConnection(snapshot.sourceStatus.connected)}</span>
          <span>Updated {formatDateTime(snapshot.generatedAt)}</span>
          <span>Parsed {snapshot.sourceStatus.parsedLineCount}</span>
          {snapshot.sourceStatus.malformedLineCount > 0 ? (
            <span className="source-issue">Malformed {snapshot.sourceStatus.malformedLineCount}</span>
          ) : null}
          {snapshot.sourceStatus.partialLineCount > 0 ? (
            <span className="source-issue">Partial {snapshot.sourceStatus.partialLineCount}</span>
          ) : null}
          <span>Auto-refresh {snapshotPollMs / 1000}s</span>
          <span>Attention {snapshot.attention.length}</span>
        </div>
      </header>

      <div className="workspace-grid">
        <section className="attention-panel" aria-labelledby="attention-heading">
          <div className="section-heading">
            <div>
              <h1 id="attention-heading">Attention Queue</h1>
              <p className="reason-legend">B Missing next step · D Missing validation · Blocked · Stale</p>
            </div>
            <span>{snapshot.attention.length} open</span>
          </div>
          <div className="queue-list">
            {snapshot.attention.length === 0 ? (
              <p className="empty-state">{attentionEmptyLabel(snapshot)}</p>
            ) : (
              snapshot.attention.map((row) => (
                <button
                  className={`queue-row ${selected?.workstreamId === row.workstreamId ? "is-selected" : ""}`}
                  type="button"
                  key={row.workstreamId}
                  onClick={() => setSelectedId(row.workstreamId)}
                  aria-pressed={selected?.workstreamId === row.workstreamId}
                  aria-label={scopeDetailLabel(row)}
                >
                  <ReasonChip reason={row.classification.attentionReason} />
                  <span className="row-title-block">
                    <span className="row-title">{row.label}</span>
                    <ScopeAliasBadge alias={row.scopeAlias} />
                    <span className="scope-pill">{scopeKindLabel(row.scopeKind)}</span>
                    <ParentHint scope={row} />
                  </span>
                  <span>{reasonLabel(row.classification.attentionReason)}</span>
                  <span>{signalLabel(row.lastSignalCode)}</span>
                  <span>{formatDateTime(row.lastActivityAt)}</span>
                  <span>{row.classification.certainty}</span>
                  <span className="row-meta row-evidence">{row.classification.evidenceCodes.map(evidenceLabel).join(" ")}</span>
                  <span className="row-meta row-prompt">{nextStepPromptLabel(row.classification.nextStepPromptTemplateId)}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <DetailPanel workstream={selected} />

        <section className="workstream-panel" aria-labelledby="workstreams-heading">
          <div className="section-heading">
            <h2 id="workstreams-heading">Workspace Groups</h2>
            <span>{snapshot.workstreams.length} observed</span>
          </div>
          <div className="workstream-list">
            <div className="workstream-row workstream-head" aria-hidden="true">
              <span>Name</span>
              <span>State</span>
              <span>Signal</span>
              <span>Attention</span>
              <span>Last Activity</span>
            </div>
            <div className="workstream-items" role="list" aria-label="Workspace groups">
              {snapshot.workstreams.length === 0 ? (
                <div role="listitem">
                  <p className="empty-state">{observedEmptyLabel(snapshot)}</p>
                </div>
              ) : (
                <>
                  {groupedScopes.groups.map((group) => (
                    <div className="scope-group" key={group.workspace.workstreamId} role="listitem">
                      <WorkstreamRowButton
                        workstream={group.workspace}
                        isSelected={selected?.workstreamId === group.workspace.workstreamId}
                        hasAttention={attentionIds.has(group.workspace.workstreamId)}
                        onSelect={() => setSelectedId(group.workspace.workstreamId)}
                        className="workspace-group-row"
                        relationshipLabel={childScopeCountLabel(group.children.length)}
                      />
                      {group.children.length > 0 ? (
                        <div className="scope-group-children">
                          {group.children.map((child) => (
                            <WorkstreamRowButton
                              key={child.workstreamId}
                              workstream={child}
                              isSelected={selected?.workstreamId === child.workstreamId}
                              hasAttention={attentionIds.has(child.workstreamId)}
                              onSelect={() => setSelectedId(child.workstreamId)}
                              className="is-child"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {groupedScopes.ungrouped.length > 0 ? (
                    <div className="scope-group ungrouped" role="listitem">
                      <div className="scope-group-label">Ungrouped Scopes</div>
                      <div className="scope-group-children">
                        {groupedScopes.ungrouped.map((workstream) => (
                          <WorkstreamRowButton
                            key={workstream.workstreamId}
                            workstream={workstream}
                            isSelected={selected?.workstreamId === workstream.workstreamId}
                            hasAttention={attentionIds.has(workstream.workstreamId)}
                            onSelect={() => setSelectedId(workstream.workstreamId)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="daily-strip" aria-label="Daily summary">
        <h2>Daily Summary</h2>
        <div className="summary-grid">
          <div>
            <span>Unresolved</span>
            <strong>{snapshot.dailySummary.unresolved}</strong>
          </div>
          <div>
            <span>Verified</span>
            <strong>{snapshot.dailySummary.verifiedDone}</strong>
          </div>
          <div>
            <span>Carry-over</span>
            <strong>{snapshot.dailySummary.carryOver}</strong>
          </div>
          <div>
            <span>Parsed</span>
            <strong>{snapshot.sourceStatus.parsedLineCount}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

export function App({ pollMs = snapshotPollMs }: { pollMs?: number } = {}) {
  const [state, setState] = useState<LoadState>(() => {
    const snapshot = readBootstrapSnapshot();
    return snapshot ? { status: "ready", snapshot } : { status: "loading" };
  });
  const hasReadySnapshot = useRef(state.status === "ready");

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    let token: string;
    try {
      token = readBootstrapToken();
    } catch {
      setState({ status: "error", message: "Snapshot unavailable" });
      return () => {
        cancelled = true;
      };
    }

    async function load(initial: boolean) {
      try {
        const snapshot = await fetchSnapshot(token);
        if (!cancelled) {
          hasReadySnapshot.current = true;
          setState({ status: "ready", snapshot });
        }
      } catch {
        if (!cancelled && initial && !hasReadySnapshot.current) {
          setState({ status: "error", message: "Snapshot unavailable" });
        }
      }
    }

    if (!hasReadySnapshot.current) {
      void load(true);
    }
    interval = setInterval(() => {
      void load(false);
    }, pollMs);

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [pollMs]);

  if (state.status === "loading") {
    return <main className="app app-state">Loading Latchboard</main>;
  }

  if (state.status === "error") {
    return <main className="app app-state">{state.message}</main>;
  }

  return <AppView snapshot={state.snapshot} />;
}
