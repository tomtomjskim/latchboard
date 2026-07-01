# Task 3 Report: Config Runtime and Events Adapter

## Status

Complete.

## Scope

- Added `src/server/config.ts`.
- Added `src/server/events-adapter.ts`.
- Added focused tests:
  - `tests/server/config.test.ts`
  - `tests/server/events-adapter.test.ts`
- Did not modify `src/server/main.ts`.
- Did not implement Planning Inbox behavior.

## Implementation Summary

### Runtime Config

- Added `RuntimeMode` and `RuntimeConfig`.
- Added `parseRuntimeConfig(argv, deps)`.
- Defaults:
  - `host`: `127.0.0.1`
  - `port`: `8787`
  - `statePath`: `.latchboard/state.json`
  - `timezone`: `Asia/Seoul`
  - `staleThresholdMs`: `7200000`
  - `token`: per-run `randomBytes(18).toString("base64url")`
- Demo mode defaults input to `fixtures/demo-attention-gate.jsonl`.
- Real mode requires `--input`.
- Unsupported mode throws.

### JSONL Events Adapter

- Added `SourceCursor`, `JsonLineRecord`, and `SourceReadResult`.
- Added `readJsonlSince(cursor)`.
- Reads complete JSONL lines from the supplied cursor offset.
- Tracks:
  - `connected`
  - `parsedLineCount`
  - `malformedLineCount`
  - `partialLineCount`
- Resets offset to `0` when the stored offset is past current file size.
- Leaves raw parsed values internal to the adapter output for downstream normalization.

## TDD Evidence

### RED

Command:

```sh
npm test -- tests/server/config.test.ts tests/server/events-adapter.test.ts
```

Result:

- Exit code: `1`
- Expected failure:
  - `../../src/server/config` did not exist.
  - `../../src/server/events-adapter` did not exist.

### GREEN

Command:

```sh
npm test -- tests/server/config.test.ts tests/server/events-adapter.test.ts
```

Result:

- Exit code: `0`
- `tests/server/config.test.ts`: 2 passed
- `tests/server/events-adapter.test.ts`: 1 passed
- Total: 3 passed

## Typecheck

Command:

```sh
npm run typecheck
```

Result:

- Exit code: `0`
- `tsc --noEmit` completed successfully.

## Files Changed

- `src/server/config.ts`
- `src/server/events-adapter.ts`
- `tests/server/config.test.ts`
- `tests/server/events-adapter.test.ts`

## Concerns

- The adapter intentionally returns parsed JSON values as `unknown` for the future Normalizer. No UI/server exposure was added in this task.
- Full test suite was not run; only the focused tests from the task brief plus typecheck were run.

## Review Fix: Task 3 Findings

### Fix Summary

- Fixed JSONL cursor advancement to use the actual consumed complete segment byte length.
- Added `SourceCursor.lineNumber` continuation and absolute-enough line numbering for append/offset reads.
- Added runtime validation for `--port` as finite integer `1..65535`.
- Added runtime validation for `--stale-ms` as finite positive integer.
- Added real-mode `--input` basename validation requiring `events.jsonl`.
- Added focused regression tests for each review finding.

### RED Evidence

Command:

```sh
npm test -- tests/server/config.test.ts tests/server/events-adapter.test.ts
```

Result:

- Exit code: `1`
- Expected failures:
  - newline-terminated JSONL cursor offset returned `30` instead of file byte length `33`
  - appended read returned no record instead of source line `3`
  - invalid `--port` values were accepted
  - invalid `--stale-ms` values were accepted
  - real-mode non-`events.jsonl` input basename was accepted

### GREEN Evidence

Command:

```sh
npm test -- tests/server/config.test.ts tests/server/events-adapter.test.ts
```

Result:

- Exit code: `0`
- `tests/server/config.test.ts`: 15 passed
- `tests/server/events-adapter.test.ts`: 3 passed
- Total: 18 passed

Command:

```sh
npm run typecheck
```

Result:

- Exit code: `0`
- `tsc --noEmit` completed successfully.

## Review Fix: Remaining Task 3 Minor CLI Parsing Finding

### Fix Summary

- Updated integer CLI flag parsing so explicitly provided `--port` and `--stale-ms` require a following value.
- Treat another flag token, such as `--port --mode demo`, as a missing value for the integer flag.
- Added focused regression coverage for missing `--port` and `--stale-ms` values.

### RED Evidence

Command:

```sh
npm test -- tests/server/config.test.ts
```

Result:

- Exit code: `1`
- Expected failures:
  - `--port` with no following token did not throw.
  - `--stale-ms` with no following token did not throw.

### GREEN Evidence

Command:

```sh
npm test -- tests/server/config.test.ts
```

Result:

- Exit code: `0`
- `tests/server/config.test.ts`: 19 passed

Command:

```sh
npm run typecheck
```

Result:

- Exit code: `0`
- `tsc --noEmit` completed successfully.

### Concerns

- Full test suite was not run; only the requested focused config test and typecheck were run.
