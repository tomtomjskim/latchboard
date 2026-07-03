import { useState } from "react";
import type { TodaySnapshot, WorkstreamSummary } from "../../shared/contracts";
import { evidenceLabel, nextStepPromptLabel } from "../../shared/contracts";
import { registerSafeLabel } from "../api";
import { formatDateTime, reasonLabel, scopeAliasLabel, scopeKindLabel, signalLabel, stateLabels } from "../format";
import { DisplayHintBadges, ReasonChip, ScopeAliasBadge } from "./ScopeChrome";
import { SafeLabelModal } from "./SafeLabelModal";

export function ScopeDetail({
  workstream,
  token,
  onSnapshot
}: {
  workstream: WorkstreamSummary | null;
  token?: string;
  onSnapshot?: (snapshot: TodaySnapshot) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  if (!workstream) {
    return (
      <aside className="detail-panel" aria-label="Scope detail">
        <p className="empty-state">No scope selected</p>
      </aside>
    );
  }

  const selectedWorkstream = workstream;
  const canLabel = Boolean(token && onSnapshot && selectedWorkstream.displayHints?.includes("needs_safe_label"));

  async function copyId() {
    try {
      await navigator.clipboard.writeText(selectedWorkstream.workstreamId);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  async function submitLabel(safeTitle: string) {
    if (!token || !onSnapshot) {
      throw new Error("label registration unavailable");
    }
    const snapshot = await registerSafeLabel(token, selectedWorkstream.workstreamId, safeTitle);
    onSnapshot(snapshot);
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
        <div className="detail-actions">
          <button className="hud-button" type="button" onClick={copyId}>
            {copyState === "copied" ? "Copied" : "Copy ID"}
          </button>
          {canLabel ? (
            <button className="hud-button primary" type="button" onClick={() => setIsModalOpen(true)}>
              Label
            </button>
          ) : null}
        </div>
      </div>
      {copyState === "error" ? <p className="form-error">Copy failed</p> : null}
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
      {isModalOpen ? <SafeLabelModal onClose={() => setIsModalOpen(false)} onSubmit={submitLabel} /> : null}
    </aside>
  );
}
