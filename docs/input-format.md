# Latchboard Input Format

## File Name Requirement

Real mode requires an explicit input file named `events.jsonl`:

```bash
npm run dev -- --input /path/to/events.jsonl
```

Files with other names are rejected in real mode.

## Minimal JSONL Event

Each line must be one JSON object. A minimal safe event is:

```json
{"time":"2026-07-02T09:10:00.000+09:00","source":"cmux","sessionId":"opaque-session-id","kind":"assistant_turn","signals":["completion_claim_seen","next_step_signal_seen"]}
```

## Accepted Identity Fields

Latchboard groups events into workstreams from the first non-empty identity field
it finds:

- `workstreamId`
- `sessionId`
- `threadId`
- `conversationId`
- `runId`

Use opaque identifiers. Do not use repo names, paths, branch names, customer
names, or other meaningful local labels as identifiers.

## Accepted Signals

Use safe signal names only:

- `completion_claim_seen`
- `validation_signal_seen`
- `next_step_signal_seen`
- `blocked_signal_seen`
- `unblocked_signal_seen`

Current v0 blocked-work resolution is derived from a later
`validation_signal_seen` or `next_step_signal_seen`. `unblocked_signal_seen` is
listed for producer compatibility, but v0 does not require it for resolution.

The v0 normalizer also accepts implementation signals used by fixtures and
internal state derivation, including `session_started`, `tool_started`,
`tool_finished`, `tool_failed`, and `idle_signal_seen`.

## Accepted Kinds

The normalizer maps event kinds to a safe source event type. These values are
recognized directly:

- `session`
- `tool`
- `assistant`
- `system`

Any other kind is treated as `unknown`. Do not place raw source event names,
prompt text, terminal text, command text, paths, or repo names in `kind`.

## Privacy Rules

Do not include raw prompts, terminal output, full paths, repo names, branch
names, commands, tokens, secrets, or customer identifiers.

Input events should contain only:

- timestamp metadata,
- an opaque source label such as `cmux`,
- one opaque workstream identity field,
- a safe kind,
- safe signal names.

## Malformed Records

Malformed JSONL lines are counted as malformed source records. Latchboard should
keep serving sanitized source status instead of exposing the raw malformed line.

Records with missing or unknown fields are normalized to safe fallback values
where possible. Unknown signal values become `unknown_safe_event`.

## Example File

```jsonl
{"time":"2026-07-02T09:10:00.000+09:00","source":"cmux","sessionId":"opaque-session-1","kind":"assistant","signals":["completion_claim_seen"]}
{"time":"2026-07-02T09:12:00.000+09:00","source":"cmux","sessionId":"opaque-session-1","kind":"assistant","signals":["validation_signal_seen","next_step_signal_seen"]}
{"time":"2026-07-02T09:20:00.000+09:00","source":"cmux","threadId":"opaque-thread-2","kind":"system","signals":["blocked_signal_seen"]}
```
