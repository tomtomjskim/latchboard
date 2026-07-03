import type { WorkstreamSummary } from "../../shared/contracts";
import { evidenceLabel, nextStepPromptLabel } from "../../shared/contracts";
import { formatDateTime, reasonLabel, scopeAliasLabel, scopeKindLabel, signalLabel, stateLabels } from "../format";
import { DisplayHintBadges, ReasonChip, ScopeAliasBadge } from "./ScopeChrome";

export function ScopeDetail({ workstream }: { workstream: WorkstreamSummary | null }) {
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
          <DisplayHintBadges workstream={workstream} />
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
        {workstream.displayHints?.includes("needs_safe_label") ? (
          <div>
            <dt>Context</dt>
            <dd>Safe label missing</dd>
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
