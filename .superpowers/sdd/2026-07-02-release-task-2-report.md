# Task 2 Report: Public README and Release Docs

## Scope

Updated only the assigned public documentation files:

- `README.md`
- `docs/release-checklist.md`
- `docs/input-format.md`
- `docs/troubleshooting.md`
- `SECURITY.md`
- `CONTRIBUTING.md`

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

## Notes

The task brief requires `unblocked_signal_seen` in `docs/input-format.md`.
Current v0 source does not include that signal in `SafeFactCode` or the
normalizer allowlist. The docs include the required signal for producer
compatibility and also state that v0 currently resolves blocked work from later
`validation_signal_seen` or `next_step_signal_seen`.
