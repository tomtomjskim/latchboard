# Latchboard Scope Parent Links Design

## Problem

Latchboard can now show privacy-safe observed scopes such as `workspace e5cc47`
and `session a1b2c3`, but it cannot answer which workspace a session belongs
to. That makes multi-session monitoring hard even when cmux events contain both
`session_id` and `workspace_id` in the same event.

## Scope

This design adds privacy-safe parent links between observed scopes. It does not
add repo names, paths, branch names, prompts, commands, task titles, or a
human-readable metadata registry. Those remain future work.

## Approach

The normalizer keeps sanitized scope ids derived from allowlisted cmux identity
fields. When one event contains multiple identity fields, the fact keeps the
primary `workstreamId` plus a deduplicated `relatedScopeIds` list. No raw
identity values cross the normalizer boundary.

The snapshot builder derives a parent workspace for each non-workspace cmux
scope when a related workspace scope exists in today's snapshot. The public
snapshot exposes only:

- `parentScopeId`
- `parentLabel`
- `parentScopeKind`

The UI renders this as a `Parent` row in Scope Detail and a compact parent hint
under the scope label in Observed Scopes and Attention Queue.

## Data Rules

- `relatedScopeIds` contains only generated ids matching
  `ws_cmux_events_(workspace|session|surface|pane|window)_[a-f0-9]{16}`.
- The primary `workstreamId` is still chosen by event type priority:
  session-first for agent/tool events, workspace-first for neutral UI events.
- Parent links are derived only from scopes that exist in the same snapshot.
- Workspace scopes do not get a parent in this version.
- Missing related workspace data leaves parent fields undefined.

## UI Rules

- The list remains dense and operational.
- Parent hints are metadata, not actionable status.
- Parent labels use existing safe labels such as `workspace e5cc47`.
- Raw ids such as `ws_cmux_events_workspace_...` must not appear in the DOM.

## Testing

- Normalizer tests verify related scope ids are generated and raw ids do not
  leak.
- Store tests verify a session summary links to a workspace summary by safe
  label.
- UI tests verify parent labels render while raw scope ids remain hidden.
- Privacy canary and release preflight remain required before merge.
