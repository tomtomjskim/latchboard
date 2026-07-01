# Task 6 Report: Derived Store, Snapshot Builder, and HTTP/SSE Server

## Scope

- Added `src/server/store.ts`.
- Added `src/server/http.ts`.
- Updated `src/server/main.ts`.
- Added `tests/server/store.test.ts`.
- Added `tests/server/http.test.ts`.

## Behavior

- Builds `TodaySnapshot` from safe `WorkstreamState` and `Classification` DTOs.
- Writes sanitized sidecar JSON state.
- Serves root HTML from loopback HTTP.
- Protects `/api/snapshot`, `/api/workstreams/:id`, and `/api/stream` with `Authorization: Bearer <token>`.
- Sends sanitized snapshot data over REST and the initial SSE event.
- Runs `npm run demo` as a long-lived local server until interrupted.

## Evidence

Focused tests:

```bash
npm test -- tests/server/store.test.ts tests/server/http.test.ts
```

Result: passed, 2 files / 6 tests.

Typecheck:

```bash
npm run typecheck
```

Result: passed.

Diff whitespace check:

```bash
git diff --check
```

Result: passed.

Demo runtime check:

```bash
npm run demo -- --port 8876 --state /tmp/latchboard-task-6-demo-state.json
```

Result: server started at `http://127.0.0.1:8876` and printed a per-run API token.

Manual API checks:

- Unauthenticated `GET /api/snapshot`: `401 Unauthorized`.
- Authenticated `GET /api/snapshot`: returned sanitized `TodaySnapshot`.
- `GET /`: returned minimal `Latchboard` HTML with bootstrap token.

## Notes

- Task 6 intentionally builds a startup snapshot. Continuous tailing/update loops are not implemented in this task.
- Full React dashboard rendering is deferred to Task 7.
