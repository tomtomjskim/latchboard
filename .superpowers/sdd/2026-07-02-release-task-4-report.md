# Task 4 Report: Release Privacy and Publishing Gate

## Summary

- Added `scripts/release-preflight.mjs`.
- Added `npm run release:preflight`.
- Added release checklist validation coverage.
- Added Vitest coverage for tracked versus untracked canary behavior and a short-prefix false-positive guard.
- Tightened preflight scanning so only `package-lock.json` is skipped.
- Added Vitest coverage for missing required files, `package.json` private mode, and formerly whitelisted canary paths.

## Privacy Gate Behavior

- Scans files returned by `git ls-files`.
- Skips binary files and `package-lock.json`.
- Fails when `package.json` sets `private` to `true`.
- Fails when required release files are missing.
- Scans synthetic canary fixtures, privacy tests, and Superpowers plan docs like other tracked text files.

## Security Nuance Decision

Historical Superpowers plan examples were rewritten to avoid contiguous blocked prefixes while preserving their canary intent. The active release checklist uses the command without embedding secret-like examples.

The short key prefix check is token-boundary aware to avoid false positives inside ordinary words, while still catching a tracked synthetic key prefix at a token boundary.

## Validation

- RED: `npm test -- tests/release-preflight.test.ts` failed because the broad whitelist allowed tracked blocked patterns in synthetic canary paths.
- GREEN: `npm test -- tests/release-preflight.test.ts` passed: 5 tests.
- `npm test -- tests/server/privacy-canary.test.ts` passed: 2 tests.
- `npm run release:preflight` passed.
- The requested blocked-pattern `rg` check returned no matches.
- `npm test` passed: 12 files, 69 tests.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run test:smoke` passed: 1 Playwright test.
- `npm audit --omit=dev` passed: 0 vulnerabilities.

## Notes

- `npm test` still prints the existing Node Fetch API experimental warning in server-related tests.
- `npm run test:smoke` still prints the existing `NO_COLOR` and `FORCE_COLOR` warning from the web server process.
