# Latchboard Input Format

## File Name Requirement

Real mode requires an explicit input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

On a local cmux setup that writes `~/.cmuxterm/events.jsonl`, run:

```bash
npm run dev:cmux
```

To opt in to local repo aliases from cmux workspace `cwd` basenames, run:

```bash
npm run dev:cmux:aliases
```

Files with other names are rejected in real mode.

## Native cmux Event

Each line must be one native cmux JSON object. Real mode reads allowlisted
metadata from the event envelope and ignores top-level `signals`.

A minimal neutral activity event is:

```json
{"type":"event","name":"window.keyed","occurred_at":"2026-07-02T05:19:42.996Z","payload":{"workspace_id":"opaque-workspace-id","window_id":"opaque-window-id"}}
```

A minimal tool lifecycle event is:

```json
{"type":"event","name":"agent.hook.PreToolUse","occurred_at":"2026-07-02T05:10:00.000Z","payload":{"session_id":"opaque-session-id"}}
```

## Accepted Identity Fields

Latchboard groups events into privacy-safe observed scopes from the first
non-empty identity field in the event-specific priority order.

For agent and tool activity, Latchboard prefers session identity:

- `payload.session_id`
- top-level `session_id`
- `payload.workspace_id`
- top-level `workspace_id`
- `payload.surface_id`
- top-level `surface_id`
- `payload.pane_id`
- top-level `pane_id`
- `payload.window_id`
- top-level `window_id`

For neutral UI activity such as focus, selection, window, pane, surface,
workspace, and notification events, Latchboard prefers workspace identity before
surface, pane, window, and finally session. This reduces window/pane noise in
the browser view.

When one accepted cmux event contains multiple identity fields, Latchboard may
keep additional generated ids internally as `relatedScopeIds`. If a session,
surface, pane, or window scope is related to a workspace scope that is present
in the same snapshot, public summaries may include:

- `parentScopeId`
- `parentLabel`
- `parentScopeKind`

These fields are generated labels only. They are not raw cmux ids and are not
repo names, paths, branch names, prompts, commands, or task titles.

When `--show-repo-aliases` is enabled, public summaries may also include:

- `scopeAlias`
- `parentScopeAlias`

Only constrained `repo <name>` aliases derived from the final `cwd` path segment
are emitted. This is an explicit local opt-in because a repo basename can still
be sensitive. Full paths are never emitted.

Use opaque identifiers. Do not use repo names, paths, branch names, customer
names, or other meaningful local labels as identifiers.

## Accepted Native Events

Native cmux event names are reduced to safe signal names:

- `agent.hook.SessionStart` and `agent.hook.UserPromptSubmit` become
  `session_started`.
- `agent.hook.PreToolUse` and `feed.item.received` become `tool_started`.
- `feed.item.completed` becomes `tool_finished`.
- `agent.hook.Stop` becomes `activity_seen`.
- Neutral UI events such as `window.*`, `pane.*`, `surface.*`,
  `workspace.*`, and `notification.*` become `activity_seen`.
- Unknown native cmux event names are ignored.

`activity_seen` means a live source was active, but no actionable task state was
observed. Recent activity-only workstreams are visible but do not create a
missing-next-step or stale alert.

Native cmux `agent.hook.Stop` is treated as lifecycle activity, not as
`completion_claim_seen`. Completion, validation, and next-step state are not
inferred from `Stop` or arbitrary top-level `signals`.

## Demo Fixture Signals

The `signals` array is only trusted for demo fixtures and internal tests, not
for real cmux mode. Demo fixtures may use:

- `activity_seen`
- `session_started`
- `tool_started`
- `tool_finished`
- `tool_failed`
- `completion_claim_seen`
- `validation_signal_seen`
- `next_step_signal_seen`
- `blocked_signal_seen`
- `idle_signal_seen`

Current v0 blocked-work resolution is derived from a later
`validation_signal_seen` or `next_step_signal_seen`.

## Privacy Rules

Do not include raw prompts, terminal output, full paths, repo names, branch
names, commands, tokens, secrets, or customer identifiers.

If `--show-repo-aliases` is enabled, ensure the final `cwd` path segment is safe
to show in the local browser, snapshot sidecar, REST API, and SSE stream.

Input events should contain only:

- timestamp metadata,
- an allowlisted native cmux event name,
- one opaque workstream identity field,
- safe cmux envelope metadata.

## Malformed Records

Malformed JSONL lines are counted as malformed source records. Latchboard should
keep serving sanitized source status instead of exposing the raw malformed line.

Records with missing or unknown fields are normalized to safe fallback values
where possible. Unknown native cmux event names are ignored.

## Example File

```jsonl
{"type":"event","name":"window.keyed","occurred_at":"2026-07-02T05:19:42.996Z","payload":{"workspace_id":"opaque-workspace-1","window_id":"opaque-window-1"}}
{"type":"event","name":"agent.hook.PreToolUse","occurred_at":"2026-07-02T05:20:00.000Z","payload":{"session_id":"opaque-session-1"}}
{"type":"event","name":"feed.item.completed","occurred_at":"2026-07-02T05:20:30.000Z","payload":{"session_id":"opaque-session-1"}}
```
