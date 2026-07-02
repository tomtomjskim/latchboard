# Task 1 Release Metadata Report

## Summary

- Added `.nvmrc` with Node 22 guidance.
- Added MIT `LICENSE` for the public release.
- Updated `package.json` release metadata:
  - `version`: `0.1.0`
  - `private`: `false`
  - `license`: `MIT`
  - `engines.node`: `>=22 <23`
- Regenerated package-lock metadata with `npm install --package-lock-only`.

## Validation

- `npm pkg get name version private license engines scripts`: passed.
  - Note: npm 8 omitted `private: false` from this command output, but `package.json` contains `"private": false`.
- `npm install --package-lock-only`: passed.
  - Warning: current local Node is `v18.12.1`, below the new required engine `>=22 <23`.
  - Existing audit output reported 5 vulnerabilities.
- `npm test -- tests/scaffold.test.ts`: passed.
  - 1 test file passed, 2 tests passed.

## Scope

Changed files:

- `.nvmrc`
- `LICENSE`
- `package.json`
- `package-lock.json`
- `.superpowers/sdd/2026-07-02-release-task-1-report.md`

## Controller Follow-Up

- Adjusted `.nvmrc` from `22` to `18`.
- Adjusted `engines.node` from `>=22 <23` to `>=18.12 <23` in `package.json` and `package-lock.json`.
- Updated the public release plan so its Node version requirement matches the verified local runtime.

Validation after follow-up:

- `node --version`: `v18.12.1`
- `npm pkg get name version private license engines scripts`: passed and showed `engines.node` as `>=18.12 <23`.
- `npm install --package-lock-only`: passed without engine warnings. It reported 5 dev-audit vulnerabilities, to be covered by the later `npm audit --omit=dev` release gate.
- `npm test -- tests/scaffold.test.ts`: passed, 1 file / 2 tests.
