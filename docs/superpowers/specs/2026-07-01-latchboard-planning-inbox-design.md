# Latchboard Planning Inbox Design

## Status

Future extension. Not part of Latchboard v0 implementation.

## Product Sentence

Planning Inbox lets the operator define intended work, validation expectations,
and next-step requirements before a session begins, so Latchboard can compare
planned work against observed cmux activity.

## Adoption Decision

Adopt as v0.2 design target. Do not include in v0.

## Goals

- Reduce `missing_validation` and `missing_next_step` before work starts.
- Give each planned task a stable local `plannedTaskId`.
- Generate safe handoff prompts that can be copied into Codex, Claude, cmux, or
  another approved work surface.
- Improve monitoring precision by linking observed workstreams to an intended
  plan.
- Track planning quality without reading raw transcripts.

## Non-Goals

- It is not a shell, deploy tool, DB writer, restart tool, Telegram executor,
  or autonomous scheduling system.
- It does not call local CLIs automatically in v0.2.
- It does not write to `wiki/reviewed`, `wiki/canonical`, project files, GitHub,
  servers, calendars, or external apps.
- It does not store raw prompts, secrets, terminal output, or private logs.

## UI Entry Points

- `+ Plan` button in the Today bar.
- `Planning Inbox` side panel.
- Optional `Today Plan` strip showing planned vs observed counts.
- Attention Queue rows may show `planned` or `unplanned` once linking exists.

## Planning Intake Fields

```ts
type PlannedTaskCategory =
  | "coding"
  | "review"
  | "ops"
  | "research"
  | "deploy_prep"
  | "docs"
  | "test";

type PlannedTaskRisk = "low" | "medium" | "high";

type PlannedTask = {
  id: string;
  title: string;
  projectLabel: string;
  repoLabel: string;
  category: PlannedTaskCategory;
  priority: "low" | "medium" | "high";
  dueAt?: string;
  timeBlock?: string;
  acceptanceCriteria: string[];
  validationExpectation: string;
  nextStepRequirement: string;
  targetSurface: "codex" | "claude" | "cmux" | "hermes" | "manual";
  risk: PlannedTaskRisk;
  status: "draft" | "ready" | "handed_off" | "observed" | "carried_over";
  createdAt: string;
  updatedAt: string;
};
```

These fields are monitoring hints only. v0.2 must not provide board views,
assignment, scheduling, prioritization workflows, reminders, dependency
tracking, or task execution. Any status exists only to improve
planned-vs-observed classification.

These fields are persisted only after privacy validation. The store must reject
or redact raw prompts, terminal output, raw cmux payloads, full paths, raw repo
names, command text, secret-like strings, and copied or extracted freeform logs.
`projectLabel` and `repoLabel` must be opaque or user-sanitized display labels,
not actual repo or path names.

## Handoff Prompt Contract

Planning Inbox generates a prompt draft only. It does not execute the prompt.

```text
Goal:
Scope:
Context:
Acceptance Criteria:
Validation Required:
Next Step Required:
Closure Format:
Latchboard Planned Task ID:
```

The prompt must include:

- planned task id,
- validation requirement,
- next-step requirement,
- closure format that requires validation result and next action.

Prompt drafts must be generated only from privacy-validated planning fields.
Copy is disabled until the draft passes the same forbidden-token canary check
used for persistence.

## Agent / CLI Handoff Policy

### v0.2 Allowed

- Generate prompt draft.
- Copy prompt.
- Save local draft.
- Show prompt preview only.
- Do not render executable command previews in v0.2.

### v0.2 Forbidden

- Execute local CLI.
- Execute shell commands.
- Trigger deploy, restart, DB write, force push, credential rotation, external
  SaaS mutation, or Telegram command execution.
- Open network access beyond local Latchboard runtime.

### v1 Candidate

Limited execution may be reconsidered only with:

- allowlisted CLIs,
- explicit approval gate,
- dry-run first,
- safe command preview,
- audit log,
- no secret persistence,
- no destructive operations,
- policy matching Telegram and Hermes high-risk action gates.

## Monitoring Benefits

Planning Inbox enables Latchboard to compare:

- planned tasks vs observed workstreams,
- planned validation vs observed validation signal,
- planned next step requirement vs observed next-step signal,
- handed-off tasks vs stale/unobserved tasks,
- category/risk vs actual B/D rate.

## Metrics

v0.2 may show:

- planned count,
- observed count,
- unobserved planned tasks,
- unplanned observed workstreams,
- B/D rate by category,
- carry-over count,
- stale transition time,
- prompt-template failure rate.

Token and cost analytics are deferred until a safe metadata source exists.

## Speed Strategy

- Separate fast capture from deep planning.
- Fast capture accepts title, project label, validation expectation, and next
  step requirement.
- Deep planning generates prompt drafts in a background queue.
- Template prompt generation must work without LLM calls.
- Agent planning calls, if added later, must be asynchronous and cancellable.

## Security Boundaries

- Planning Inbox writes only to local Latchboard planning state.
- It must not write to personal-wiki reviewed/canonical content.
- It must not execute Telegram `/shell`, `/deploy`, `/restart`, `/dbwrite`,
  `/secret`, or `/env` equivalents.
- It must not render command text in v0.2.
- It follows the same no-secret persistence rule as Latchboard v0.
- High-risk action handoff must remain proposal-only until v1 approval gates are
  designed and reviewed.

## Acceptance Criteria

- Operator can create a planned task in under 30 seconds.
- Generated prompt includes validation and next-step requirements.
- Handoff is copy-only in v0.2.
- Planned task can be linked to an observed workstream without raw transcript
  access.
- Secret-like input is rejected or explicitly blocked from persistence.
- Planning fields improve B/D classification without weakening v0 privacy rules.

## Decision

Planning Inbox is adopted as a v0.2 extension and documented as future scope in
the v0 spec. It must not block the v0 read-only gate implementation.
