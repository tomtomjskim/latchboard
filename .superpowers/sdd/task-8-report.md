# Task 8 Report

## Evidence

- `npm test -- tests/server/privacy-canary.test.ts` — passed, 1 file / 2 tests. Note: Node printed an experimental Fetch API warning.
- `npm test` — passed, 11 files / 58 tests. Note: Node printed experimental Fetch API warnings in server tests.
- `npm run typecheck` — passed, `tsc --noEmit`.
- `npm run build` — passed, Vite built `dist/ui`.
- `npm run test:smoke` — passed, 1 Playwright test. Note: webServer printed a NO_COLOR/FORCE_COLOR warning.
- `npm audit --omit=dev` — passed, found 0 vulnerabilities.

## Changes

- Added privacy canary release checks for normalized facts, snapshot sidecar, REST snapshot, SSE snapshot event, fallback root HTML, built root HTML/static asset serving, and rendered UI DOM.
- Strengthened demo smoke to load the dashboard and assert the shell plus key attention content.
- Added privacy documentation and updated README with quick start, real mode, validation commands, and design links.

## Review Fix Evidence

- Updated Playwright webServer command to run `npm run build && npm run demo`, so smoke does not depend on ignored local `dist/ui`.
- Added privacy canary positive controls for raw fixture contents, source connection, parsed line count, and produced facts.
- `npm test -- tests/server/privacy-canary.test.ts` — passed, 1 file / 2 tests.
- `npm run test:smoke` — passed, 1 Playwright test.
- `npm run typecheck` — passed.
