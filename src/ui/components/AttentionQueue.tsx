import type { AttentionRow, WorkstreamSummary, TodaySnapshot } from "../../shared/contracts";
import { evidenceLabel, nextStepPromptLabel } from "../../shared/contracts";
import { attentionEmptyLabel, formatDateTime, reasonLabel, scopeDetailLabel, scopeKindLabel, signalLabel } from "../format";
import { ParentHint, ReasonChip, ScopeAliasBadge } from "./ScopeChrome";

export function AttentionQueue({
  snapshot,
  selected,
  onSelect
}: {
  snapshot: TodaySnapshot;
  selected: WorkstreamSummary | null;
  onSelect: (workstreamId: string) => void;
}) {
  return (
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
            <AttentionButton
              key={row.workstreamId}
              row={row}
              isSelected={selected?.workstreamId === row.workstreamId}
              onSelect={() => onSelect(row.workstreamId)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function AttentionButton({
  row,
  isSelected,
  onSelect
}: {
  row: AttentionRow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`queue-row ${isSelected ? "is-selected" : ""}`}
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
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
  );
}
