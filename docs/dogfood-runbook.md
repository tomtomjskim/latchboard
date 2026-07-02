# Latchboard Dogfood Runbook

## Objective

Run Latchboard against real local, sanitized events every working day to check
whether v0 attention reasons match TOM's actual operating needs.

This is an operations routine, not a roadmap. The goal is to learn whether the
current read-only dashboard reliably highlights work that needs attention,
especially the B/D failures TOM cares about most: missing validation and missing
next step.

## Daily Routine

1. Start with a fresh metadata-only `events.jsonl` file for the day.
2. Add one JSONL event when a local workstream reaches a meaningful state:
   completion claimed, validation observed, next step observed, or blocked.
3. Run Latchboard in real mode against the local `events.jsonl` file.
4. Review Attention Queue first, then All Workstreams.
5. For every Attention Queue row, answer the review questions below.
6. Record only counts and short sanitized notes in the false positive or false
   negative log.
7. End the day by checking whether unresolved rows represent real follow-up
   work or expected carry-over.

Do not add collectors for this routine. Manually create only the safe event
records needed to validate the v0 model.

## Event Source Contract

Use JSONL, one JSON object per line. v0 accepts sanitized metadata fields like:

```json
{"time":"2026-07-02T09:10:00.000+09:00","source":"cmux","sessionId":"opaque-session-id","kind":"assistant","signals":["completion_claim_seen","next_step_signal_seen"]}
```

Keep event records metadata-only:

- `time`: ISO timestamp with timezone.
- `source`: opaque local source label, such as `cmux`.
- one identity field: `workstreamId`, `sessionId`, `threadId`,
  `conversationId`, or `runId`.
- `kind`: safe event kind such as `assistant`, `session`, `tool`, or `system`.
- `signals`: safe signal names only.

Use these v0 signals for dogfood records:

- `completion_claim_seen`
- `validation_signal_seen`
- `next_step_signal_seen`
- `blocked_signal_seen`

Do not include raw prompts, terminal output, full paths, repo names, branch
names, commands, tokens, secrets, customer identifiers, or private logs in event
records, review notes, or reports. Use opaque identifiers instead.

## Review Questions

For each Attention Queue row:

- Is this row pointing at a real attention need?
- Which reason did it show: missing validation, missing next step, blocked, or
  stale?
- Did the row appear soon enough to change TOM's next action?
- Is the suggested next-step prompt appropriate for the observed state?
- Would TOM keep, suppress, or reclassify this signal if the same pattern
  appears again?

For All Workstreams:

- Did any workstream look done even though validation was missing?
- Did any workstream look complete even though the next step was missing?
- Did any workstream remain noisy after validation or next-step evidence was
  added?

## False Positive Log

Use this section during dogfood review. Keep entries short and sanitized.

| Date | Reason shown | Why it was false positive | Adjustment candidate |
| --- | --- | --- | --- |
|  |  |  |  |

Examples of useful notes:

- `missing_validation`: validation was intentionally not required for this
  workstream.
- `missing_next_step`: the workstream was truly finished and no follow-up was
  needed.
- `blocked`: a later validation or next-step signal should have resolved it.

## False Negative Log

Use this section when TOM noticed a workstream needing attention but Latchboard
did not show it. Keep entries short and sanitized.

| Date | Missed condition | Expected reason | Evidence signal missing |
| --- | --- | --- | --- |
|  |  |  |  |

Focus on whether the record was missing a safe signal, whether v0 classified it
incorrectly, or whether the current model cannot represent the condition yet.

## B/D Failure Focus

Prioritize B/D failures over broad workflow coverage:

- B: completion was claimed but no validation signal was observed.
- D: work ended or paused without a next-step signal.

During dogfood review, treat these as the highest-value checks:

- `completion_claim_seen` without later `validation_signal_seen` should create
  a missing validation attention row.
- `completion_claim_seen` without `next_step_signal_seen` should create a
  missing next step attention row unless the workstream clearly does not need a
  next step.
- A row that catches B/D but feels noisy is still useful to log; do not turn the
  runbook into a product backlog.

## Exit Criteria for v0.2

Do not move to Planning Inbox implementation until v0 dogfood validates the
attention model. v0.2 can start when daily use shows:

- B/D failures are consistently visible in Attention Queue.
- False positives are explainable and rare enough for daily use.
- False negatives are either rare or tied to known missing safe signals.
- Event records remain metadata-only without raw prompts, logs, paths,
  commands, repo names, branch names, tokens, secrets, customer identifiers, or
  private logs.
- TOM can decide the next local action from the dashboard without adding
  collectors or Planning Inbox behavior.
