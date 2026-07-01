import type { Classification, WorkstreamState } from "../shared/contracts";

type ClassificationOptions = {
  now: Date;
  staleThresholdMs: number;
};

function sortedFacts(workstream: WorkstreamState) {
  return [...workstream.facts].sort((left, right) => {
    const timeDelta = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    return timeDelta === 0 ? left.id.localeCompare(right.id) : timeDelta;
  });
}

function hasUnresolvedBlockedSignal(workstream: WorkstreamState): boolean {
  const facts = sortedFacts(workstream);
  let lastBlockedIndex = -1;

  for (let index = facts.length - 1; index >= 0; index -= 1) {
    if (facts[index].code === "blocked_signal_seen") {
      lastBlockedIndex = index;
      break;
    }
  }

  if (lastBlockedIndex < 0) {
    return false;
  }

  return !facts
    .slice(lastBlockedIndex + 1)
    .some((fact) => fact.code === "validation_signal_seen" || fact.code === "next_step_signal_seen");
}

function hasCode(workstream: WorkstreamState, code: WorkstreamState["facts"][number]["code"]): boolean {
  return workstream.facts.some((fact) => fact.code === code);
}

export function classifyWorkstreams(
  workstreams: WorkstreamState[],
  options: ClassificationOptions
): Classification[] {
  return workstreams.map((workstream) => {
    const since = workstream.lastActivityAt;
    const hasCompletionClaim = hasCode(workstream, "completion_claim_seen");
    const hasValidationSignal = hasCode(workstream, "validation_signal_seen");
    const hasNextStepSignal = hasCode(workstream, "next_step_signal_seen");
    const isVerifiedDone = workstream.rawState === "verified_done";

    if (hasUnresolvedBlockedSignal(workstream)) {
      return {
        workstreamId: workstream.id,
        attentionReason: "blocked",
        severity: "high",
        certainty: "explicit",
        evidenceCodes: ["blocked_signal_without_resolution"],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "resolve_blocker",
        since
      };
    }

    if (hasCompletionClaim && !hasValidationSignal) {
      return {
        workstreamId: workstream.id,
        attentionReason: "missing_validation",
        severity: "high",
        certainty: "explicit",
        evidenceCodes: ["completion_claim_without_validation"],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "run_validation",
        since
      };
    }

    if (!hasNextStepSignal && !isVerifiedDone) {
      return {
        workstreamId: workstream.id,
        attentionReason: "missing_next_step",
        severity: "medium",
        certainty: "inferred",
        evidenceCodes: ["no_next_step_signal"],
        nextStepStatus: "missing",
        nextStepPromptTemplateId: "write_next_step",
        since
      };
    }

    if (!isVerifiedDone && options.now.getTime() - Date.parse(workstream.lastActivityAt) > options.staleThresholdMs) {
      return {
        workstreamId: workstream.id,
        attentionReason: "stale",
        severity: "low",
        certainty: "weak",
        evidenceCodes: ["inactive_past_stale_threshold"],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "review_stale_work",
        since
      };
    }

    return {
      workstreamId: workstream.id,
      attentionReason: null,
      severity: "low",
      certainty: "explicit",
      evidenceCodes: ["validation_signal_present"],
      nextStepStatus: "not_required",
      nextStepPromptTemplateId: "no_prompt",
      since
    };
  });
}
