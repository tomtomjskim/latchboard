# Latchboard v0 Design

## Product Sentence

Latchboard is a local, read-only AI work completion gate that turns today's
cmux events into an attention queue for missing validation, missing next step,
blocked work, and stale work.

## Goals

- Let the operator find real `missing_validation` and `missing_next_step` risks
  within two minutes at end of day.
- Make the first run useful without private logs through a bundled demo fixture.
- Keep the runtime local, read-only, and metadata-only.
- Make every B/D attention item explainable through fixed safe facts, not raw
  prompts or terminal output.

## Non-Goals

- It is not an IDE, session transcript browser, PM board, kanban, or task runner.
- It does not mutate cmux logs, project files, shells, servers, or remote tools.
- It does not store or display raw prompts, raw terminal output, raw log lines,
  full local paths, raw repo names, command text, diffs, file contents, secrets,
  or extracted freeform next-step text.
- It does not support manual override, annotations, mute, SQLite history,
  Telegram/Hermes control, browser terminal integration, or CLI execution in v0.

## Modes

### Demo Mode

`npm run demo` loads `fixtures/demo-attention-gate.jsonl`.

Demo mode must show:

- one `missing_validation` item,
- one `missing_next_step` item,
- one `blocked` item,
- one `stale` item,
- one `verified_done` item outside the attention queue.

### Real Mode

`npm run dev -- --input ~/.cmuxterm/events.jsonl`

Real mode is explicit. The v0 required source is `events.jsonl` only.
`workstream.jsonl` enrichment is deferred.

## Architecture

```text
ConfigRuntime
  -> EventsAdapter
  -> Normalizer
  -> WorkstreamReducer
  -> Classifier
  -> DerivedStore
  -> WebServer
  -> UI
```

### Modules

- `ConfigRuntime`: parses demo/real mode, input path, timezone, bind address,
  port, per-run token, and test clock.
- `EventsAdapter`: reads and tails `events.jsonl`, tracks cursor, tolerates
  malformed and partial lines, and emits sanitized adapter errors.
- `Normalizer`: converts raw lines into `SafeFact` enum facts and discards raw
  line and raw payload data.
- `WorkstreamReducer`: groups safe facts into today's workstream state.
- `Classifier`: computes attention reason, evidence codes, certainty,
  next-step status, and fixed prompt template id.
- `DerivedStore`: keeps in-memory derived state and writes sidecar snapshots
  that contain only safe derived data.
- `WebServer`: serves static UI, REST snapshot/detail APIs, and SSE events over
  loopback with token protection.

## Security Invariant

Raw cmux line, raw payload, prompt text, terminal output, command text, full cwd,
full path, full repo name, branch name, customer name, secret-looking string,
or extracted freeform string must never cross the `Normalizer` boundary and must
never appear in `DerivedStore`, REST, SSE, DOM, or server logs.

This invariant is release-blocking and must be verified by privacy canary tests.

## Data Contracts

### SafeFact

```ts
type SafeFactCode =
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

type SafeSourceEventType =
  | "session"
  | "tool"
  | "assistant"
  | "system"
  | "unknown";

type SafeFact = {
  id: string;
  sourceType: "cmux_events" | "demo";
  occurredAt: string;
  workstreamId: string;
  code: SafeFactCode;
  sourceEventType: SafeSourceEventType;
};
```

`SafeFact` must not contain raw path, raw payload, raw command, raw prompt,
raw output, raw error line, or user-provided free text.

`sourceEventType` is an allowlisted normalized enum, not the raw cmux event type
string. Unknown or unsupported raw event types map to `"unknown"`.

### Workstream Identity and Labels

`workstreamId` must be generated before raw data crosses the Normalizer
boundary. If cmux provides an opaque session or thread id, use a deterministic
safe id derived from that id. If not, allocate a local ordinal id from adapter
cursor order. Do not hash or expose raw path, repo name, cwd, branch, prompt, or
command text into the id.

`label` in v0 is generated display text such as `Workstream 1`, optionally
suffixed only by safe enum state. It must not be derived from repo name, path,
branch, prompt, command, or freeform event text.

### WorkstreamState

```ts
type WorkstreamState = {
  id: string;
  sourceType: "cmux_events" | "demo";
  label: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  facts: SafeFact[];
  rawState: "running" | "waiting" | "done_claimed" | "verified_done" | "unknown";
};
```

`label` is opaque or sanitized. Full local path and raw repo name are not stored
in v0.

### Classification

```ts
type AttentionReason =
  | "missing_validation"
  | "missing_next_step"
  | "blocked"
  | "stale";

type Certainty = "explicit" | "inferred" | "weak";

type NextStepStatus = "present" | "missing" | "unclear" | "not_required";

type NextStepPromptTemplateId =
  | "run_validation"
  | "write_next_step"
  | "resolve_blocker"
  | "review_stale_work"
  | "no_prompt";

type EvidenceCode =
  | "completion_claim_without_validation"
  | "no_next_step_signal"
  | "blocked_signal_without_resolution"
  | "inactive_past_stale_threshold"
  | "validation_signal_present";

type Classification = {
  workstreamId: string;
  attentionReason: AttentionReason | null;
  severity: "high" | "medium" | "low";
  certainty: Certainty;
  evidenceCodes: EvidenceCode[];
  nextStepStatus: NextStepStatus;
  nextStepPromptTemplateId: NextStepPromptTemplateId;
  since: string;
};
```

`nextStepPromptTemplateId` is the only next-step prompt field in v0. Freeform
strings and raw-log-derived interpolation are forbidden.

### Classification Rules

Classification priority is:

1. `blocked`
2. `missing_validation`
3. `missing_next_step`
4. `stale`
5. no attention reason

Rules:

- `blocked`: `blocked_signal_seen` exists and no later
  `validation_signal_seen` or `next_step_signal_seen` resolves it.
- `missing_validation`: `completion_claim_seen` exists and no later
  `validation_signal_seen` exists.
- `missing_next_step`: workstream is not `verified_done`, has no
  `next_step_signal_seen`, and is not currently classified as blocked.
- `stale`: `lastActivityAt` is older than the configured stale threshold. v0
  default stale threshold is 2 hours.
- `verified_done`: excluded from Attention Queue when `validation_signal_seen`
  exists after `completion_claim_seen`.

All rule comparisons use `occurredAt` normalized to `ConfigRuntime` timezone and
must be reproducible with the test clock.

## UI

The first viewport is a dense operational screen:

1. `Today bar`: mode, date, connection, last update, attention counters.
2. `Attention Queue`: largest region; shows rows needing operator attention.
3. `All Workstreams`: compact table for non-attention context.
4. `Detail Drawer`: opens only on row selection.
5. `Daily strip`: compact unresolved/verified/carry-over summary.

Attention Queue rows show only:

- reason chip: `B`, `D`, `Blocked`, `Stale`,
- sanitized workstream label,
- last activity,
- certainty,
- fixed evidence label,
- fixed next-step prompt copy rendered from template id.

No UI text may be rendered directly from raw event payload, raw log line, prompt,
terminal output, full path, or non-dynamic extracted string.

## Runtime Security

- Bind to `127.0.0.1` only.
- Generate a per-run token.
- Protect all `/api/*` and `/api/stream` access.
- Do not load external runtime network assets, fonts, images, scripts, or
  telemetry.
- Do not require `.env` for demo mode.
- Do not print raw JSONL lines in errors or logs.

## API

- `GET /api/snapshot`: returns the derived Today snapshot.
- `GET /api/workstreams/:id`: returns sanitized detail data.
- `GET /api/stream`: SSE with token protection.

Minimum DTOs:

```ts
type TodaySnapshot = {
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

type AttentionRow = {
  workstreamId: string;
  label: string;
  lastActivityAt: string;
  classification: Classification;
};

type WorkstreamSummary = {
  workstreamId: string;
  label: string;
  lastActivityAt: string;
  rawState: WorkstreamState["rawState"];
  classification: Classification;
};

type SourceStatus = {
  connected: boolean;
  parsedLineCount: number;
  malformedLineCount: number;
  partialLineCount: number;
};
```

SSE events:

- `snapshot_updated`: client reloads `/api/snapshot`.
- `source_status`: sanitized source availability and parse counts.

## Fixtures

- `demo-attention-gate.jsonl`: demo B/D/blocked/stale/verified_done coverage.
- `privacy-canary.jsonl`: canary strings embedded in raw prompt, terminal
  output, raw payload, command text, full path, raw repo name,
  repo/customer-like names, branch-like names, secret-like values, and extracted
  freeform text. No canary value may cross the Normalizer boundary.
- `malformed-partial.jsonl`: malformed, partial, unknown, and missing fields.
- `realtime-append.jsonl`: append and duplicate suppression coverage.
- `today-stale-boundary.jsonl`: today-only, stale threshold, timezone coverage.

## Required Smoke Tests

v0 release requires automated or scripted smoke coverage for:

- Demo fixture: `npm run demo` loads `fixtures/demo-attention-gate.jsonl` and
  shows exactly one `missing_validation`, one `missing_next_step`, one
  `blocked`, one `stale`, and one `verified_done` workstream outside the
  attention queue.
- Privacy canary: `fixtures/privacy-canary.jsonl` contains canary strings in
  raw prompt, terminal output, raw payload, command text, full path, raw repo
  name, repo/customer-like names, branch-like names, secret-like values, and
  extracted freeform text. None may appear in sidecar store, REST, SSE, DOM, or
  server logs.
- Malformed JSONL: `fixtures/malformed-partial.jsonl` includes malformed lines,
  partial trailing line, unknown event type, and missing fields. Server and UI
  must stay up and expose sanitized parse/source status only.
- Realtime append: `fixtures/realtime-append.jsonl` append simulation updates
  `/api/stream` and `/api/snapshot` without restart and suppresses duplicate
  events.
- Today/stale boundary: `fixtures/today-stale-boundary.jsonl` runs with a test
  clock and timezone setting to verify today-only filtering and stale threshold
  boundaries.

## Release Blockers

- `npm install && npm run demo` fails on a clean checkout.
- Demo mode does not show exactly one B, one D, one blocked, and one stale
  attention row, or does not show one `verified_done` workstream outside the
  attention queue.
- Tokenless REST or SSE access succeeds.
- Server binds outside `127.0.0.1`.
- Any privacy canary appears in sidecar store, REST, SSE, DOM, or server logs.
- Malformed or partial JSONL crashes the server or UI.
- Today/stale behavior cannot be reproduced with a test clock.
- Appended JSONL events do not update SSE/snapshot without restart, or duplicate
  appended events create duplicate workstreams or facts.

## Future Extension

Latchboard v0 intentionally remains read-only. A future Planning Inbox will let
operators define intended work, validation expectations, and next-step
requirements before sessions begin, improving monitoring precision without
allowing automatic execution.

See `2026-07-01-latchboard-planning-inbox-design.md`.
