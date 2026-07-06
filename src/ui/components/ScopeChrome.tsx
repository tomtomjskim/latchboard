import type { AttentionReason, ScopeAlias, WorkstreamSummary } from "../../shared/contracts";
import {
  activityStateLabel,
  formatDateTime,
  reasonLabel,
  reasonShortLabel,
  scopeAliasLabel,
  scopeDetailLabel,
  scopeKindLabel,
  signalLabel,
  stateLabels
} from "../format";

export function ReasonChip({ reason }: { reason: AttentionReason | null }) {
  const label = reasonLabel(reason);

  return (
    <span className={`reason-chip ${reason ?? "none"}`} aria-label={label} title={label}>
      {reasonShortLabel(reason)}
    </span>
  );
}

export function ParentHint({ scope }: { scope: { parentLabel?: string } }) {
  return scope.parentLabel ? <span className="parent-hint">Parent {scope.parentLabel}</span> : null;
}

export function ScopeAliasBadge({ alias }: { alias?: ScopeAlias }) {
  return alias ? <span className="scope-alias">{scopeAliasLabel(alias)}</span> : null;
}

export function DisplayHintBadges({ workstream }: { workstream: WorkstreamSummary }) {
  if (!workstream.displayHints?.includes("needs_safe_label")) {
    return null;
  }

  return <span className="display-hint">Needs label</span>;
}

export function WorkstreamRowButton({
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
  const classes = ["workstream-row", className, isSelected ? "is-selected" : ""].filter(Boolean).join(" ");

  return (
    <button
      className={classes}
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={scopeDetailLabel(workstream)}
    >
      <span className="row-title-block">
        <span className="row-title">{workstream.label}</span>
        <ScopeAliasBadge alias={workstream.scopeAlias} />
        <DisplayHintBadges workstream={workstream} />
        <span className="scope-pill">{scopeKindLabel(workstream.scopeKind)}</span>
        {workstream.activity ? (
          <span className="row-meta">{workstream.activity.summary ?? activityStateLabel(workstream.activity.state)}</span>
        ) : null}
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
