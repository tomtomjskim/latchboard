# Task 4 Report: Release Privacy and Publishing Gate

## Summary

- Added `scripts/release-preflight.mjs`.
- Added `npm run release:preflight`.
- Added release checklist validation coverage.
- Added Vitest coverage for tracked versus untracked canary behavior and a short-prefix false-positive guard.

## Privacy Gate Behavior

- Scans files returned by `git ls-files`.
- Skips binary files and `package-lock.json`.
- Fails when `package.json` sets `private` to `true`.
- Fails when required release files are missing.
- Allows existing synthetic canary coverage only in explicit safe paths:
  - `fixtures/privacy-canary.jsonl`
  - `tests/server/privacy-canary.test.ts`
  - `docs/superpowers/plans/`

## Security Nuance Decision

I chose to ignore historical Superpowers plan examples in `docs/superpowers/plans/` rather than editing those plan files, because the user scope did not allow unrelated docs edits and the brief explicitly called out existing plan examples. The active release checklist uses the command without embedding secret-like examples.

The short key prefix check is token-boundary aware to avoid false positives such as `task-6`, while still catching a tracked synthetic key prefix at a token boundary.

## Validation

- RED: `npm test -- tests/release-preflight.test.ts` failed before implementation because the preflight script was missing.
- RED: `npm test -- tests/release-preflight.test.ts` failed for the `task-6` false-positive guard before the short-prefix scanner fix.
- GREEN: `npm test -- tests/release-preflight.test.ts` passed.
- `/tmp` untracked canary proof: `npm run release:preflight` passed.
- tracked canary proof: temporary canary in `docs/release-checklist.md` failed preflight, then passed after exact restoration.
- `npm run release:preflight` passed.
- `npm test` passed: 12 files, 66 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test:smoke` passed: 1 Playwright test.
- `npm audit --omit=dev` passed: 0 vulnerabilities.

## Notes

- `npm test` still prints the existing Node Fetch API experimental warning in server-related tests.
- `npm run test:smoke` still prints the existing `NO_COLOR` and `FORCE_COLOR` warning from the web server process.
