# Task 2 Report: Public README and Release Docs

## Scope

Updated the assigned public documentation files:

- `README.md`
- `docs/release-checklist.md`
- `docs/input-format.md`
- `docs/troubleshooting.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `docs/privacy.md`
- `docs/superpowers/plans/2026-07-02-latchboard-public-release-dogfood.md`

## Source Of Truth Checked

- `package.json` for Node engine, npm scripts, version, license, and package
  distribution posture.
- `src/server/config.ts` for runtime flags, loopback defaults, state path, and
  real-mode `events.jsonl` requirement.
- `src/server/normalizer.ts` and `src/shared/contracts.ts` for safe identity
  fields, event kinds, and normalizer signal behavior.
- `docs/privacy.md` for privacy boundary language.
- `tests/smoke/demo.spec.cjs` for expected demo counts: 4 Attention Queue rows
  and 5 All Workstreams rows.

## Changes Made

- Rewrote `README.md` in the required public release section order.
- Added fresh-clone setup using `npm ci`, `npm run build`, and `npm run demo`.
- Documented smoke-test Chromium setup with `npx playwright install chromium`.
- Added Real Events JSONL input format and privacy rules.
- Added release checklist, input format, troubleshooting, security, and
  contributing docs.
- Marked Planning Inbox as future v0.2 work, not current v0.
- Documented GitHub publish steps without assuming `origin` exists.

## Validation

Ran the required commands from the brief:

```bash
rg -n "docs/release-checklist.md|docs/input-format.md|docs/troubleshooting.md|SECURITY.md|CONTRIBUTING.md|npx playwright install chromium|npm ci|npm run demo|MIT|>=18.12 <23|4 Attention Queue|5 All Workstreams" README.md docs/release-checklist.md docs/input-format.md docs/troubleshooting.md SECURITY.md CONTRIBUTING.md
npm test -- tests/scaffold.test.ts
```

Results:

- `rg` found the required release doc links, setup commands, smoke command,
  license, Node engine range, and demo row counts.
- `npm test -- tests/scaffold.test.ts` passed: 1 test file, 2 tests.

Task 2 review follow-up validation:

```bash
rg -n "/Users/<local-user>|assistant_turn|npm install" README.md docs/input-format.md docs/release-checklist.md docs/privacy.md SECURITY.md docs/superpowers/plans/2026-07-02-latchboard-public-release-dogfood.md
rg -n "Private Vulnerability Reporting|Generated Artifacts|dist/|.latchboard/state.json|test-results/|playwright-report/|kind\":\"assistant\"|npm ci" SECURITY.md docs/release-checklist.md README.md docs/input-format.md docs/privacy.md
npm test -- tests/scaffold.test.ts
```

Results:

- Stale string `rg` returned no matches.
- Required string `rg` found private vulnerability reporting, generated
  artifact notes, `kind":"assistant"` examples, and `npm ci`.
- `npm test -- tests/scaffold.test.ts` passed: 1 test file, 2 tests.

## Notes

Follow-up resolved the previous `unblocked_signal_seen` concern. Current v0
source does not include that signal in `SafeFactCode` or the normalizer
allowlist, so `docs/input-format.md` and the active Task 2 plan requirement now
list only the v0-supported public signals. v0 blocked-work resolution is
documented as deriving from later `validation_signal_seen` or
`next_step_signal_seen`.

Task 2 review follow-up resolved public release doc findings:

- `SECURITY.md` now routes vulnerability reports to GitHub Private
  Vulnerability Reporting when available, or another private maintainer contact
  before any public issue.
- Minimal JSONL examples now use `kind: "assistant"`, matching the v0
  normalizer's directly recognized kinds.
- The Task 2 plan no longer exposes a local absolute `/Users/...` path.
- `docs/release-checklist.md` documents generated artifacts from build, demo,
  and smoke-test commands.
- `docs/privacy.md` Quick Start and validation commands now align with the
  README and release checklist.

Concerns: none after follow-up.
