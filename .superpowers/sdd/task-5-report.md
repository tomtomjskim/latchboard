# Task 5 Report

## Implementation Evidence

- Added `src/server/reducer.ts` to reduce `SafeFact[]` into sorted `WorkstreamState[]` using only safe contract fields.
- Added `src/server/classifier.ts` to classify `WorkstreamState[]` by blocked, missing validation, missing next step, stale, then clean priority.
- Added focused tests:
  - `tests/server/reducer.test.ts`
  - `tests/server/classifier.test.ts`

## TDD Evidence

- RED: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`
  - Failed because `src/server/reducer` and `src/server/classifier` did not exist.
- RED: `npm test -- tests/server/reducer.test.ts`
  - Failed for same-timestamp validation/completion ordering before reducer verification logic was corrected.
- GREEN: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`
  - 2 test files passed.
  - 8 tests passed.

## Validation Evidence

- `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`
  - Passed.
  - 2 test files passed.
  - 8 tests passed.
- `npm run typecheck`
  - Passed.

## Notes

- Reducer and classifier do not consume raw JSONL records or freeform input fields.
- Workstream labels are generated as generic sorted labels: `Workstream 1`, `Workstream 2`, etc.

## Review Fix Evidence

- RED: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`
  - Failed with 2 classifier regressions:
    - validation before completion was incorrectly treated as clean with `validation_signal_present`.
    - recent non-verified next-step-only work was incorrectly returned as `not_required` with `validation_signal_present`.
- Fix:
  - Added classifier validation-after-completion detection matching reducer semantics.
  - Split clean classifier output so verified done keeps `validation_signal_present` / `not_required`, while recent non-verified work with a next step returns `evidenceCodes: []` / `nextStepStatus: "present"`.
  - Added reducer same-timestamp id tie-break coverage.
- GREEN: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`
  - Passed.
  - 2 test files passed.
  - 11 tests passed.
- Typecheck: `npm run typecheck`
  - Passed.

## Second Review Fix Evidence

- Finding:
  - Validation was accepted after any completion claim instead of requiring validation at or after the latest completion claim.
- RED: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`
  - Failed with 2 regressions:
    - Reducer returned `verified_done` for completion -> validation -> later completion.
    - Classifier returned clean/present for completion -> validation -> later completion -> next step.
- Fix:
  - Updated reducer and classifier validation checks to compare validation timestamps against the latest `completion_claim_seen` timestamp.
  - Added reducer regression coverage for completion -> validation -> later completion => `done_claimed`.
  - Added classifier regression coverage for completion -> validation -> later completion -> next step => `missing_validation`.
- GREEN: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`
  - Passed.
  - 2 test files passed.
  - 13 tests passed.
- Typecheck: `npm run typecheck`
  - Passed.
