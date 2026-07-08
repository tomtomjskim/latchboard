import type { TodaySnapshot, WorkstreamSummary } from "../../shared/contracts";
import {
  formatConnection,
  formatDateTime,
  formatMode,
  type RefreshStatus
} from "../format";
import { AttentionQueue } from "./AttentionQueue";
import { DailySummary } from "./DailySummary";
import { RefreshStatusBadge, SourceModeBadge } from "./StatusBadge";
import { ScopeDetail } from "./ScopeDetail";
import { WorkspaceMap } from "./WorkspaceMap";

export type SnapshotUpdatePulse = {
  parsedDelta: number;
  observedDelta: number;
  changed: boolean;
  pulseKey: string;
};

function signedDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function livePulseLabel(pulse?: SnapshotUpdatePulse): string {
  if (!pulse?.changed) {
    return "Watching";
  }

  const changes = [
    pulse.parsedDelta !== 0 ? `Lines ${signedDelta(pulse.parsedDelta)}` : null,
    pulse.observedDelta !== 0 ? `Observed ${signedDelta(pulse.observedDelta)}` : null
  ].filter((change): change is string => Boolean(change));

  return changes.length > 0 ? changes.join(" · ") : "Snapshot refreshed";
}

export function DashboardShell({
  snapshot,
  selected,
  attentionIds,
  refreshStatus,
  snapshotPollMs,
  liveUpdate,
  token,
  onSnapshot,
  onSelect
}: {
  snapshot: TodaySnapshot;
  selected: WorkstreamSummary | null;
  attentionIds: Set<string>;
  refreshStatus: RefreshStatus;
  snapshotPollMs: number;
  liveUpdate?: SnapshotUpdatePulse;
  token?: string;
  onSnapshot?: (snapshot: TodaySnapshot) => void;
  onSelect: (workstreamId: string | null) => void;
}) {
  const pulseLabel = livePulseLabel(liveUpdate);
  const pulseKey = liveUpdate?.pulseKey ?? "watching";

  return (
    <main className="app">
      <header className="today-bar" aria-label="Today status">
        <div className="brand-block">
          <strong>Latchboard</strong>
          <span>{formatMode(snapshot.mode)}</span>
          <SourceModeBadge snapshot={snapshot} />
          <RefreshStatusBadge status={refreshStatus} snapshot={snapshot} />
          {snapshot.mode === "demo" ? <span className="source-mode-badge not-live">Not live data</span> : null}
        </div>
        <div className="today-metrics">
          <span>{snapshot.date}</span>
          <span>{formatConnection(snapshot.sourceStatus.connected)}</span>
          <span>Updated {formatDateTime(snapshot.generatedAt)}</span>
          <span>Parsed {snapshot.sourceStatus.parsedLineCount}</span>
          <span
            key={pulseKey}
            className={`live-pulse ${liveUpdate?.changed ? "is-active" : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Last snapshot update: ${pulseLabel}`}
            data-pulse-key={pulseKey}
          >
            {pulseLabel}
          </span>
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
        <AttentionQueue snapshot={snapshot} selected={selected} onSelect={onSelect} />
        <ScopeDetail workstream={selected} token={token} onSnapshot={onSnapshot} />
        <WorkspaceMap snapshot={snapshot} selected={selected} attentionIds={attentionIds} onSelect={onSelect} />
      </div>

      <DailySummary snapshot={snapshot} />
    </main>
  );
}
