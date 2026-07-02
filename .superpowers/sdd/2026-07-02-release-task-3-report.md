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

- Passed: `rg -n "dogfood|B/D|completion_claim_seen|next_step_signal_seen|raw prompts|docs/dogfood-runbook.md|kind\":\"assistant\"" README.md docs/dogfood-runbook.md`
- Passed: `rg -n "docs/dogfood-runbook.md|B/D|completion_claim_seen|next_step_signal_seen|raw prompts|kind\":\"assistant\"" README.md docs/dogfood-runbook.md`
- Passed: `npm test -- tests/scaffold.test.ts`

## Notes

- The runbook uses `kind:"assistant"` and the current v0 signal list.
- The runbook emphasizes TOM's B/D failure focus: missing validation and missing
  next step.
- The event contract explicitly excludes raw prompts, terminal output, full
  paths, repo names, branch names, commands, tokens, secrets, customer
  identifiers, and private logs.
