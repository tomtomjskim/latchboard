import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { classifyWorkstreams } from "./classifier";
import { readJsonlSince, type SourceCursor } from "./events-adapter";
import { normalizeRecords, sanitizeScopeAlias } from "./normalizer";
import { reduceWorkstreams } from "./reducer";
import { readWorkstreamMetadata } from "./workstream-metadata";
import type {
  AttentionRow,
  Classification,
  SafeFact,
  ScopeAlias,
  ScopeKind,
  SourceStatus,
  SourceType,
  TodaySnapshot,
  WorkstreamMetadata,
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
  workstreamMetadata?: Map<string, WorkstreamMetadata>;
};

export type SnapshotRuntimeOptions = {
  mode: "demo" | "real";
  inputPath: string;
  statePath: string;
  sourceType: SourceType;
  workstreamInputPath?: string;
  timezone: string;
  staleThresholdMs: number;
  showRepoAliases?: boolean;
  pollIntervalMs?: number;
  now: () => Date;
};

export type SnapshotRuntime = {
  getSnapshot: () => TodaySnapshot;
  pollOnce: () => Promise<TodaySnapshot>;
  start: () => void;
  stop: () => void;
  subscribe: (listener: (snapshot: TodaySnapshot) => void) => () => void;
};

function scopeKindFor(state: WorkstreamState): ScopeKind {
  if (state.sourceType !== "cmux_events") {
    return "workstream";
  }

  const match = /^ws_cmux_events_(workspace|session|surface|pane|window)_/.exec(state.id);
  return match ? (match[1] as ScopeKind) : "workstream";
}

function relatedWorkspaceIdFor(state: WorkstreamState, summaries: Map<string, WorkstreamSummary>): string | undefined {
  if (state.sourceType !== "cmux_events" || scopeKindFor(state) === "workspace") {
    return undefined;
  }

  for (const fact of state.facts) {
    for (const relatedId of fact.relatedScopeIds ?? []) {
      if (summaries.get(relatedId)?.scopeKind === "workspace") {
        return relatedId;
      }
    }
  }

  return undefined;
}

function scopeAliasFor(state: WorkstreamState): ScopeAlias | undefined {
  for (let index = state.facts.length - 1; index >= 0; index -= 1) {
    const alias = sanitizeScopeAlias(state.facts[index].scopeAlias);
    if (alias) {
      return alias;
    }
  }

  return undefined;
}

export function buildSnapshot(input: BuildSnapshotInput): TodaySnapshot {
  const classificationsById = new Map(input.classifications.map((item) => [item.workstreamId, item]));
  const metadataById = input.workstreamMetadata ?? new Map<string, WorkstreamMetadata>();

  const workstreams: WorkstreamSummary[] = input.workstreams.map((state) => {
    const classification = classificationsById.get(state.id);
    if (!classification) {
      throw new Error(`missing classification for workstream ${state.id}`);
    }
    const metadata = metadataById.get(state.id);
    const scopeAlias = metadata?.safeRepoAlias ?? scopeAliasFor(state);

    return {
      workstreamId: state.id,
      label: metadata?.safeTitle ?? state.label,
      scopeKind: metadata?.safeKind ?? scopeKindFor(state),
      ...(scopeAlias ? { scopeAlias } : {}),
      lastActivityAt: state.lastActivityAt,
      rawState: metadata?.safeStatus ?? state.rawState,
      lastSignalCode: state.facts[state.facts.length - 1]?.code ?? "unknown_safe_event",
      classification
    };
  });
  const workstreamsById = new Map(workstreams.map((workstream) => [workstream.workstreamId, workstream]));

  input.workstreams.forEach((state) => {
    const child = workstreamsById.get(state.id);
    if (!child) {
      return;
    }

    const parentId = relatedWorkspaceIdFor(state, workstreamsById);
    const parent = parentId ? workstreamsById.get(parentId) : undefined;
    if (!parent) {
      return;
    }

    child.parentScopeId = parent.workstreamId;
    child.parentLabel = parent.label;
    child.parentScopeKind = parent.scopeKind;
    if (parent.scopeAlias) {
      child.parentScopeAlias = parent.scopeAlias;
    }
  });

  const attention: AttentionRow[] = workstreams
    .filter((row) => row.classification.attentionReason !== null)
    .map((row) => ({
      workstreamId: row.workstreamId,
      label: row.label,
      scopeKind: row.scopeKind,
      ...(row.scopeAlias ? { scopeAlias: row.scopeAlias } : {}),
      ...(row.parentScopeId
        ? {
            parentScopeId: row.parentScopeId,
            parentLabel: row.parentLabel,
            parentScopeKind: row.parentScopeKind,
            ...(row.parentScopeAlias ? { parentScopeAlias: row.parentScopeAlias } : {})
          }
        : {}),
      lastActivityAt: row.lastActivityAt,
      lastSignalCode: row.lastSignalCode,
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

function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function factLocalDateKey(fact: SafeFact, timezone: string): string {
  return localDateKey(new Date(fact.occurredAt), timezone);
}

function emptySourceStatus(connected: boolean): SourceStatus {
  return {
    connected,
    parsedLineCount: 0,
    malformedLineCount: 0,
    partialLineCount: 0
  };
}

function mergeSourceStatus(previous: SourceStatus, next: SourceStatus): SourceStatus {
  return {
    connected: next.connected,
    parsedLineCount: previous.parsedLineCount + next.parsedLineCount,
    malformedLineCount: previous.malformedLineCount + next.malformedLineCount,
    partialLineCount: next.partialLineCount
  };
}

export function createSnapshotRuntime(options: SnapshotRuntimeOptions): SnapshotRuntime {
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  let cursor: SourceCursor = { path: options.inputPath, offset: 0 };
  let facts: SafeFact[] = [];
  let sourceStatus = emptySourceStatus(false);
  let snapshot = buildCurrentSnapshot();
  let interval: NodeJS.Timeout | undefined;
  let hasWrittenSnapshot = false;
  const listeners = new Set<(snapshot: TodaySnapshot) => void>();

  function buildCurrentSnapshot(): TodaySnapshot {
    const now = options.now();
    const date = localDateKey(now, options.timezone);
    const todayFacts = facts.filter((fact) => factLocalDateKey(fact, options.timezone) === date);
    const workstreams = reduceWorkstreams(todayFacts);
    const classifications = classifyWorkstreams(workstreams, {
      now,
      staleThresholdMs: options.staleThresholdMs
    });

    return buildSnapshot({
      mode: options.mode,
      date,
      timezone: options.timezone,
      generatedAt: now.toISOString(),
      sourceStatus,
      workstreams,
      classifications,
      workstreamMetadata: readWorkstreamMetadata(options.workstreamInputPath)
    });
  }

  function publish(nextSnapshot: TodaySnapshot): void {
    for (const listener of listeners) {
      listener(nextSnapshot);
    }
  }

  function comparableSnapshot(value: TodaySnapshot): Omit<TodaySnapshot, "generatedAt"> {
    const { generatedAt: _generatedAt, ...comparable } = value;
    return comparable;
  }

  async function pollOnce(): Promise<TodaySnapshot> {
    const previousSnapshot = snapshot;
    const read = readJsonlSince(cursor);
    cursor = read.cursor;
    sourceStatus = mergeSourceStatus(sourceStatus, read.status);

    if (read.records.length > 0) {
      facts = facts.concat(
        normalizeRecords(read.records, options.sourceType, {
          showRepoAliases: options.showRepoAliases
        })
      );
    }

    const nextSnapshot = buildCurrentSnapshot();
    const changed =
      JSON.stringify(comparableSnapshot(nextSnapshot)) !== JSON.stringify(comparableSnapshot(previousSnapshot));

    if (changed || !hasWrittenSnapshot) {
      snapshot = nextSnapshot;
      writeSnapshot(options.statePath, snapshot);
      hasWrittenSnapshot = true;
    }

    if (changed) {
      publish(snapshot);
    }

    return snapshot;
  }

  return {
    getSnapshot: () => snapshot,
    pollOnce,
    start: () => {
      if (interval) {
        return;
      }
      interval = setInterval(() => {
        void pollOnce();
      }, pollIntervalMs);
    },
    stop: () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
