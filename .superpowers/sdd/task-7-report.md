# Task 7 Report: Dashboard UI and API Client

## Changes

- Added `src/ui/api.ts` to read the bootstrap token and fetch `/api/snapshot` with bearer auth.
- Replaced the placeholder UI with `AppView(snapshot)` plus `App` loading, error, and ready states.
- Added dense dashboard regions: Today bar, Daily Summary, Attention Queue, All Workstreams, and a selected workstream detail panel.
- Added `src/ui/main.tsx` and `index.html` for Vite UI bundling.
- Updated `src/server/http.ts` to serve the built `dist/ui` bundle when present and fall back to the existing minimal shell otherwise.
- Added jsdom React render coverage in `tests/ui/render.test.tsx`.

## Privacy Notes

- UI renders only fields from sanitized `TodaySnapshot`.
- Tests assert the DOM does not include workstream ids or raw-text markers such as repo, branch, prompt, command, output, events.jsonl, fixtures, or canary.
- Detail panel uses fixed contract labels from `evidenceLabel` and `nextStepPromptLabel`.

## Validation Evidence

- `npm test -- tests/ui/render.test.tsx`
  - PASS: 1 file, 4 tests.
- `npm test -- tests/ui/render.test.tsx tests/server/http.test.ts`
  - PASS: 2 files, 9 tests.
  - Note: Node emitted an experimental Fetch API warning during server HTTP tests.
- `npm run typecheck`
  - PASS: `tsc --noEmit`.
- `npm run build`
  - PASS: Vite built `dist/ui/index.html`, CSS, and JS assets.

## Concerns

- `npm install --save-dev @testing-library/react@^16.1.0 jsdom@^25.0.1` completed but reported 5 npm audit vulnerabilities: 3 moderate, 1 high, 1 critical. I did not run `npm audit fix --force` because it can introduce broad dependency changes.
