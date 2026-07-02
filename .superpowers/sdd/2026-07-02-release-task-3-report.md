# 2026-07-02 Release Task 3 Report

## Scope

- Added `docs/dogfood-runbook.md`.
- Linked the runbook from `README.md`.
- Kept changes within the assigned documentation scope.

## Source of Truth

- `src/shared/contracts.ts` for v0 safe fact codes, source event kinds,
  attention reasons, evidence codes, and next-step prompt labels.
- `docs/input-format.md` for current safe JSONL input format.
- `docs/reviews/2026-07-01-planning-inbox-review.md` for deferring Planning
  Inbox until v0 dogfood validates the attention model.

## Validation

- Passed: `rg -n "dogfood|completion_claim_seen|next_step_signal_seen|raw prompts|docs/dogfood-runbook.md|kind\":\"assistant\"" README.md docs/dogfood-runbook.md`
- Passed: `rg -n "docs/dogfood-runbook.md|completion_claim_seen|next_step_signal_seen|raw prompts|kind\":\"assistant\"" README.md docs/dogfood-runbook.md`
- Passed: `npm test -- tests/scaffold.test.ts`

## Notes

- The runbook uses `kind:"assistant"` and the current v0 signal list.
- The runbook emphasizes the two highest-value failure classes: missing
  validation and missing next step.
- The event contract explicitly excludes raw prompts, terminal output, full
  paths, repo names, branch names, commands, tokens, secrets, customer
  identifiers, and private logs.

## Review Follow-Up

- Replaced public private-operator-name references with generic operator
  language.
- Removed letter-based failure mapping from the public runbook and used explicit
  reason names.
- Corrected the missing-next-step probe to use `tool_finished` or
  `idle_signal_seen` without `next_step_signal_seen`, matching current
  classifier priority.
- Added `tool_finished` and `idle_signal_seen` to the dogfood signal list so the
  documented missing-next-step probe can be represented with current v0 signals.
- Added the false-negative fallback `missing safe source signal` for next-step
  cases that cannot be represented with current safe v0 signals.
- Made v0.2 exit criteria measurable over a 5-working-day dogfood window.
