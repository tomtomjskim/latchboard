import type { RawState, SafeFact, WorkstreamState } from "../shared/contracts";

function compareFacts(left: SafeFact, right: SafeFact): number {
  const timeDelta = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
  return timeDelta === 0 ? left.id.localeCompare(right.id) : timeDelta;
}

function hasValidationAtOrAfterCompletion(facts: SafeFact[]): boolean {
  const completionTimes = facts
    .filter((fact) => fact.code === "completion_claim_seen")
    .map((fact) => Date.parse(fact.occurredAt));

  if (completionTimes.length === 0) {
    return false;
  }

  const latestCompletionTime = Math.max(...completionTimes);

  return facts.some(
    (fact) =>
      fact.code === "validation_signal_seen" &&
      Date.parse(fact.occurredAt) >= latestCompletionTime
  );
}

function rawStateFor(facts: SafeFact[]): RawState {
  if (facts.length === 0) {
    return "unknown";
  }

  if (hasValidationAtOrAfterCompletion(facts)) {
    return "verified_done";
  }

  if (facts.some((fact) => fact.code === "completion_claim_seen")) {
    return "done_claimed";
  }

  if (facts.some((fact) => fact.code === "next_step_signal_seen")) {
    return "waiting";
  }

  return "running";
}

export function reduceWorkstreams(facts: SafeFact[]): WorkstreamState[] {
  const grouped = new Map<string, SafeFact[]>();

  for (const fact of facts) {
    const existing = grouped.get(fact.workstreamId);
    if (existing) {
      existing.push(fact);
    } else {
      grouped.set(fact.workstreamId, [fact]);
    }
  }

  return Array.from(grouped.entries())
    .map(([id, workstreamFacts]) => {
      const sortedFacts = [...workstreamFacts].sort(compareFacts);
      const firstFact = sortedFacts[0];
      const lastFact = sortedFacts[sortedFacts.length - 1];

      return {
        id,
        sourceType: firstFact?.sourceType ?? "demo",
        label: "",
        createdAt: firstFact?.occurredAt ?? new Date(0).toISOString(),
        updatedAt: lastFact?.occurredAt ?? new Date(0).toISOString(),
        lastActivityAt: lastFact?.occurredAt ?? new Date(0).toISOString(),
        facts: sortedFacts,
        rawState: rawStateFor(sortedFacts)
      };
    })
    .sort((left, right) => {
      const timeDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
      return timeDelta === 0 ? left.id.localeCompare(right.id) : timeDelta;
    })
    .map((workstream, index) => ({
      ...workstream,
      label: `Workstream ${index + 1}`
    }));
}
