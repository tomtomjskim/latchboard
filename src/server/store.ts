import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  AttentionRow,
  Classification,
  SourceStatus,
  TodaySnapshot,
  WorkstreamState,
  WorkstreamSummary
} from "../shared/contracts";

export type BuildSnapshotInput = {
  mode: "demo" | "real";
  date: string;
  timezone: string;
  generatedAt: string;
  sourceStatus: SourceStatus;
  workstreams: WorkstreamState[];
  classifications: Classification[];
};

export function buildSnapshot(input: BuildSnapshotInput): TodaySnapshot {
  const classificationsById = new Map(input.classifications.map((item) => [item.workstreamId, item]));

  const workstreams: WorkstreamSummary[] = input.workstreams.map((state) => {
    const classification = classificationsById.get(state.id);
    if (!classification) {
      throw new Error(`missing classification for workstream ${state.id}`);
    }

    return {
      workstreamId: state.id,
      label: state.label,
      lastActivityAt: state.lastActivityAt,
      rawState: state.rawState,
      classification
    };
  });

  const attention: AttentionRow[] = workstreams
    .filter((row) => row.classification.attentionReason !== null)
    .map((row) => ({
      workstreamId: row.workstreamId,
      label: row.label,
      lastActivityAt: row.lastActivityAt,
      classification: row.classification
    }));

  return {
    mode: input.mode,
    date: input.date,
    timezone: input.timezone,
    generatedAt: input.generatedAt,
    sourceStatus: input.sourceStatus,
    attention,
    workstreams,
    dailySummary: {
      unresolved: attention.length,
      verifiedDone: workstreams.filter((row) => row.rawState === "verified_done").length,
      carryOver: attention.filter((row) => row.classification.attentionReason === "stale").length
    }
  };
}

export function writeSnapshot(path: string, snapshot: TodaySnapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot, null, 2));
}
