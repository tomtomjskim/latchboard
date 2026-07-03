# Safe Label Modal And Copy ID Design

## Product Brief

Latchboard already marks cmux workspace rows that have only generated labels with `NEEDS LABEL`. The next step is to let the operator act on that state without leaving the browser:

- copy the selected generated workstream id,
- register a sanitized `safeTitle` through a local-only modal,
- refresh the dashboard so the row becomes readable.

The UI must keep the existing Open Design HUD direction: dense, dark, operational, low-decoration, no marketing layout, no broad redesign.

## Current System

- `src/server/http.ts` serves loopback HTTP on `127.0.0.1`.
- API routes require the bootstrap bearer token.
- Existing API routes are read-only: `/api/snapshot`, `/api/workstreams/:id`, `/api/stream`.
- `src/server/workstream-labels.ts` already exposes append-only safe label writing.
- `src/ui/api.ts` owns tokenized snapshot fetches.
- `src/ui/components/ScopeDetail.tsx` renders the selected scope.
- `src/ui/App.tsx` owns snapshot state and refresh polling.

## Design Options

### Option A: Copy Button Only

Add a copy-id button and keep `npm run label:cmux` as the only writer.

Tradeoff: safest and fastest, but still forces terminal context switching. It does not solve the main usability issue.

### Option B: Browser Modal With Narrow POST Endpoint

Add a local-only `POST /api/workstreams/:id/label` endpoint and modal. The endpoint accepts only `safeTitle`, reuses the same sanitizer as the CLI, writes only to configured `workstream.jsonl`, and returns the updated snapshot.

Tradeoff: slightly larger API surface, but it keeps the workflow inside Latchboard while preserving the privacy contract.

### Option C: Browser Modal That Calls A CLI

Have the server shell out to `npm run label:cmux`.

Tradeoff: duplicates command parsing, introduces process execution risk, and is harder to test. Reject this path.

## Chosen Approach

Use Option B.

Rationale:

- It reuses existing local server auth and sanitizer boundaries.
- It avoids shell execution.
- It keeps file writes restricted to `workstream.jsonl`.
- It gives immediate feedback through a refreshed snapshot.

## Server Contract

Extend `createLatchboardServer()` options:

```ts
type LatchboardServerOptions = {
  host: "127.0.0.1";
  port: number;
  token: string;
  getSnapshot: () => TodaySnapshot;
  registerSafeLabel?: (workstreamId: string, safeTitle: string) => TodaySnapshot;
  subscribeToSnapshots?: (listener: (snapshot: TodaySnapshot) => void) => () => void;
  staticRoot?: string;
};
```

Add route:

```text
POST /api/workstreams/:id/label
Authorization: Bearer <bootstrap-token>
Content-Type: application/json
Body: {"safeTitle":"Review validation queue"}
```

Responses:

- `200 {"snapshot": TodaySnapshot}` when label registration succeeds.
- `400` for malformed id, malformed JSON, missing `safeTitle`, or sanitizer rejection.
- `401` for missing or invalid token.
- `404` when the generated workstream id is not in the current snapshot.
- `405` for non-POST methods on the label route.
- `409` when the server has no label registration backend, which happens outside `dev:cmux:full` or without `--workstream-input`.

The endpoint must not accept raw `title`, `cwd`, `prompt`, `command`, `output`, branch, path, or arbitrary metadata.

## Runtime Integration

Add a runtime method:

```ts
registerSafeLabel(workstreamId: string, safeTitle: string): TodaySnapshot
```

Behavior:

1. Confirm `workstreamInputPath` exists in runtime options.
2. Confirm current snapshot contains `workstreamId`.
3. Append one sanitized record through `appendWorkstreamLabel(workstreamInputPath, { workstreamId, safeTitle })`.
4. Rebuild the snapshot immediately so metadata is reflected without waiting for the next event poll.
5. Write `.latchboard/state.json`.
6. Publish the updated snapshot to SSE listeners.
7. Return the updated snapshot.

This method writes only sanitized metadata and never writes raw event data.

## UI Contract

### Scope Detail Actions

Add compact icon/text buttons in the selected scope detail header:

- `Copy ID`
- `Label`, shown when `displayHints` includes `needs_safe_label`

Button behavior:

- `Copy ID` uses `navigator.clipboard.writeText(workstream.workstreamId)`.
- On success, button text changes to `Copied` briefly.
- If clipboard is unavailable or fails, use a small inline error message.
- No generated id is rendered as visible text outside the button action.

### Modal

Create `SafeLabelModal` as a small focused component.

Fields and controls:

- title: `Safe label`
- one text input with label `Safe title`
- submit button `Save label`
- cancel button `Cancel`
- status text for saving/error

Interaction:

- Open from `Label`.
- Initial input empty.
- Submit calls `registerSafeLabel(token, workstreamId, safeTitle)` from `src/ui/api.ts`.
- On success, close modal and replace App snapshot with returned snapshot.
- On failure, keep modal open and show the sanitized server error.
- Escape and Cancel close without writing.

The modal must not include visible instructional paragraphs. It should be compact, operational, and match existing HUD styling.

## Frontend State Flow

`AppView` becomes a controlled shell:

```ts
type AppViewProps = {
  snapshot: TodaySnapshot;
  refreshStatus?: RefreshStatus;
  onSnapshot?: (snapshot: TodaySnapshot) => void;
};
```

`App` passes `setState` through `onSnapshot` so modal submissions can replace the current snapshot immediately.

Tests can render `AppView` with a stub `onSnapshot`.

## Security And Privacy Rules

- Route must bind only through the existing `127.0.0.1` server.
- Route must require the existing bearer token.
- Route must be disabled when `workstreamInputPath` is absent.
- Route must only write to a path already accepted by config as `workstream.jsonl`.
- Server must re-run `sanitizeWorkstreamTitle`.
- Client must not pre-validate as the only guard. Client can show basic empty input feedback, but server remains the source of truth.
- Response bodies must not include raw rejected input except short generic error text.
- Tests must assert that unsafe safeTitle values do not get written.

## Error Handling

Server errors:

- invalid JSON: `400 Bad Request`
- missing safe title: `400 Bad Request`
- unsafe safe title: `400 Bad Request`
- no registration backend: `409 Label registration unavailable`
- unknown workstream id: `404 Not Found`

Client states:

- idle,
- saving,
- saved,
- error.

The modal disables submit while saving. It must not close on error.

## File Plan

Create:

- `src/ui/components/SafeLabelModal.tsx`

Modify:

- `src/server/http.ts`
- `src/server/main.ts`
- `src/server/store.ts`
- `src/ui/App.tsx`
- `src/ui/api.ts`
- `src/ui/components/DashboardShell.tsx`
- `src/ui/components/ScopeDetail.tsx`
- `src/ui/styles.css`
- `tests/server/http.test.ts`
- `tests/server/store.test.ts`
- `tests/ui/render.test.tsx`

## Testing Strategy

Server:

- `POST /api/workstreams/:id/label` requires bearer token.
- rejects when registration backend is absent.
- rejects unknown id.
- rejects unsafe safeTitle.
- appends safe label and returns updated snapshot.
- publishes update through runtime registration path.

UI:

- `Copy ID` calls clipboard with selected generated id and shows copied state.
- `Label` button opens modal for `needs_safe_label`.
- successful submit calls API, closes modal, and updates snapshot.
- failed submit keeps modal open and shows error.
- no raw workstream id becomes visible in body text.

Validation:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run test:smoke`
- `npm run release:preflight`
- `git diff --check`
- local `npm run dev:cmux:full` screenshot check.

## Review Loop

### Round 1: Scope Review

Finding: Adding a full task editor or scheduling surface would exceed this slice.

Resolution: Scope is limited to copy id and safeTitle registration. Planning, scheduling, prompt recommendation, and CLI agent execution remain out of scope.

### Round 2: Security Review

Finding: A browser write endpoint can become risky if it accepts arbitrary metadata or shell-executes the CLI.

Resolution: Endpoint accepts only `safeTitle`, reuses server sanitizer, requires bearer token, rejects absent backend, and does not execute shell commands.

### Round 3: UX Review

Finding: Showing generated ids directly in the detail panel would add clutter and increase accidental leakage in screenshots.

Resolution: Generated id is only copied through an explicit action. The visible UI keeps `NEEDS LABEL` and `Safe label missing`.

### Round 4: Testability Review

Finding: If the modal owns global app state directly, tests become coupled to polling.

Resolution: `AppView` receives `onSnapshot`, and `App` wires it to state. UI tests can inject a stub without timers.

### Round 5: Implementation Readiness Review

Checklist:

- No incomplete markers remain.
- Public API signatures are named.
- Error status codes are specified.
- Files to create and modify are listed.
- Security rules are explicit.
- Test cases map to each behavior.

Result: Ready for implementation.
