export type SourceType = "cmux_events" | "demo";

export type SafeFactCode =
  | "activity_seen"
  | "session_started"
  | "tool_started"
  | "tool_finished"
  | "tool_failed"
  | "completion_claim_seen"
  | "validation_signal_seen"
  | "next_step_signal_seen"
  | "blocked_signal_seen"
  | "idle_signal_seen"
  | "unknown_safe_event";

export type SafeSourceEventType = "session" | "tool" | "assistant" | "system" | "unknown";
export type ScopeKind = "workspace" | "session" | "surface" | "pane" | "window" | "workstream";

export type SafeFact = {
  id: string;
  sourceType: SourceType;
  occurredAt: string;
  workstreamId: string;
  relatedScopeIds?: string[];
  code: SafeFactCode;
  sourceEventType: SafeSourceEventType;
};

export type RawState = "running" | "waiting" | "done_claimed" | "verified_done" | "unknown";

export type WorkstreamState = {
  id: string;
  sourceType: SourceType;
  label: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  facts: SafeFact[];
  rawState: RawState;
};

export type AttentionReason = "missing_validation" | "missing_next_step" | "blocked" | "stale";
export type Certainty = "explicit" | "inferred" | "weak";
export type NextStepStatus = "present" | "missing" | "unclear" | "not_required";

export type NextStepPromptTemplateId =
  | "run_validation"
  | "write_next_step"
  | "resolve_blocker"
  | "review_stale_work"
  | "no_prompt";

export type EvidenceCode =
  | "completion_claim_without_validation"
  | "no_next_step_signal"
  | "blocked_signal_without_resolution"
  | "inactive_past_stale_threshold"
  | "validation_signal_present";

export type Classification = {
  workstreamId: string;
  attentionReason: AttentionReason | null;
  severity: "high" | "medium" | "low";
  certainty: Certainty;
  evidenceCodes: EvidenceCode[];
  nextStepStatus: NextStepStatus;
  nextStepPromptTemplateId: NextStepPromptTemplateId;
  since: string;
};

export type SourceStatus = {
  connected: boolean;
  parsedLineCount: number;
  malformedLineCount: number;
  partialLineCount: number;
};

export type AttentionRow = {
  workstreamId: string;
  label: string;
  scopeKind: ScopeKind;
  parentScopeId?: string;
  parentLabel?: string;
  parentScopeKind?: ScopeKind;
  lastActivityAt: string;
  lastSignalCode: SafeFactCode;
  classification: Classification;
};

export type WorkstreamSummary = {
  workstreamId: string;
  label: string;
  scopeKind: ScopeKind;
  parentScopeId?: string;
  parentLabel?: string;
  parentScopeKind?: ScopeKind;
  lastActivityAt: string;
  rawState: RawState;
  lastSignalCode: SafeFactCode;
  classification: Classification;
};

export type TodaySnapshot = {
  mode: "demo" | "real";
  date: string;
  timezone: string;
  generatedAt: string;
  sourceStatus: SourceStatus;
  attention: AttentionRow[];
  workstreams: WorkstreamSummary[];
  dailySummary: {
    unresolved: number;
    verifiedDone: number;
    carryOver: number;
  };
};

const evidenceLabels: Record<EvidenceCode, string> = {
  completion_claim_without_validation: "Completion was claimed without a validation signal.",
  no_next_step_signal: "No next-step signal was detected.",
  blocked_signal_without_resolution: "Blocked work has no later resolution signal.",
  inactive_past_stale_threshold: "No activity was detected past the stale threshold.",
  validation_signal_present: "Validation signal is present."
};

const promptLabels: Record<NextStepPromptTemplateId, string> = {
  run_validation: "Run the planned validation and review the result.",
  write_next_step: "Write the next step before continuing.",
  resolve_blocker: "Resolve or restate the blocker before closing.",
  review_stale_work: "Review stale work and decide whether to continue or carry over.",
  no_prompt: "No next-step prompt is required."
};

export function evidenceLabel(code: EvidenceCode): string {
  return evidenceLabels[code];
}

export function nextStepPromptLabel(id: NextStepPromptTemplateId): string {
  return promptLabels[id];
}
