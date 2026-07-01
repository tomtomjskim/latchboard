import "./styles.css";
import { useEffect, useMemo, useState } from "react";
import type { AttentionReason, RawState, TodaySnapshot, WorkstreamSummary } from "../shared/contracts";
import { evidenceLabel, nextStepPromptLabel } from "../shared/contracts";
import { fetchSnapshot, readBootstrapToken } from "./api";

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

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: TodaySnapshot };

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

function formatConnection(connected: boolean): string {
  return connected ? "Connected" : "Disconnected";
}

function reasonLabel(reason: AttentionReason | null): string {
  return reason ? reasonLabels[reason] : "No attention";
}

function reasonShortLabel(reason: AttentionReason | null): string {
  return reason ? reasonShortLabels[reason] : "OK";
}

function ReasonChip({ reason }: { reason: AttentionReason | null }) {
  const label = reasonLabel(reason);

  return (
    <span className={`reason-chip ${reason ?? "none"}`} aria-label={label} title={label}>
      {reasonShortLabel(reason)}
    </span>
  );
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
      <aside className="detail-panel" aria-label="Workstream detail">
        <p className="empty-state">No workstream selected</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel" aria-label="Workstream detail">
      <div className="section-heading">
        <ReasonChip reason={workstream.classification.attentionReason} />
        <h2>{workstream.label}</h2>
      </div>
      <dl className="detail-list">
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

export function AppView({ snapshot }: { snapshot: TodaySnapshot }) {
  const [selectedId, setSelectedId] = useState<string | null>(snapshot.attention[0]?.workstreamId ?? null);
  const selected = useMemo(() => selectedFromSnapshot(snapshot, selectedId), [snapshot, selectedId]);
  const attentionIds = useMemo(() => new Set(snapshot.attention.map((row) => row.workstreamId)), [snapshot.attention]);

  return (
    <main className="app">
      <header className="today-bar" aria-label="Today status">
        <div className="brand-block">
          <strong>Latchboard</strong>
          <span>{formatMode(snapshot.mode)}</span>
        </div>
        <div className="today-metrics">
          <span>{snapshot.date}</span>
          <span>{formatConnection(snapshot.sourceStatus.connected)}</span>
          <span>Updated {formatDateTime(snapshot.generatedAt)}</span>
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
              <p className="empty-state">No attention items</p>
            ) : (
              snapshot.attention.map((row) => (
                <button
                  className={`queue-row ${selected?.workstreamId === row.workstreamId ? "is-selected" : ""}`}
                  type="button"
                  key={row.workstreamId}
                  onClick={() => setSelectedId(row.workstreamId)}
                  aria-pressed={selected?.workstreamId === row.workstreamId}
                  aria-label={`View ${row.label} details`}
                >
                  <ReasonChip reason={row.classification.attentionReason} />
                  <span className="row-title">{row.label}</span>
                  <span>{reasonLabel(row.classification.attentionReason)}</span>
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
            <h2 id="workstreams-heading">All Workstreams</h2>
            <span>{snapshot.workstreams.length} observed</span>
          </div>
          <div className="workstream-list">
            <div className="workstream-row workstream-head" aria-hidden="true">
              <span>Name</span>
              <span>State</span>
              <span>Attention</span>
              <span>Last Activity</span>
            </div>
            <div className="workstream-items" role="list" aria-label="All workstreams">
              {snapshot.workstreams.map((workstream) => (
                <div key={workstream.workstreamId} role="listitem">
                  <button
                    className={`workstream-row ${selected?.workstreamId === workstream.workstreamId ? "is-selected" : ""}`}
                    type="button"
                    onClick={() => setSelectedId(workstream.workstreamId)}
                    aria-pressed={selected?.workstreamId === workstream.workstreamId}
                    aria-label={`View ${workstream.label} details`}
                  >
                    <span className="row-title">{workstream.label}</span>
                    <span>{stateLabels[workstream.rawState]}</span>
                    <span>{attentionIds.has(workstream.workstreamId) ? reasonLabel(workstream.classification.attentionReason) : "Clear"}</span>
                    <span>{formatDateTime(workstream.lastActivityAt)}</span>
                  </button>
                </div>
              ))}
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

export function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = readBootstrapToken();
        const snapshot = await fetchSnapshot(token);
        if (!cancelled) {
          setState({ status: "ready", snapshot });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Snapshot unavailable" });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <main className="app app-state">Loading Latchboard</main>;
  }

  if (state.status === "error") {
    return <main className="app app-state">{state.message}</main>;
  }

  return <AppView snapshot={state.snapshot} />;
}
