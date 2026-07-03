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

export function DashboardShell({
  snapshot,
  selected,
  attentionIds,
  refreshStatus,
  snapshotPollMs,
  token,
  onSnapshot,
  onSelect
}: {
  snapshot: TodaySnapshot;
  selected: WorkstreamSummary | null;
  attentionIds: Set<string>;
  refreshStatus: RefreshStatus;
  snapshotPollMs: number;
  token?: string;
  onSnapshot?: (snapshot: TodaySnapshot) => void;
  onSelect: (workstreamId: string) => void;
}) {
  void token;
  void onSnapshot;

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
        <ScopeDetail workstream={selected} />
        <WorkspaceMap snapshot={snapshot} selected={selected} attentionIds={attentionIds} onSelect={onSelect} />
      </div>

      <DailySummary snapshot={snapshot} />
    </main>
  );
}
