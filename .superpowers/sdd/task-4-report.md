# Task 4 Report: Normalizer Privacy Boundary

## Status

Complete.

## Scope

- Added `src/server/normalizer.ts`.
- Added `tests/server/normalizer.test.ts`.
- Implemented `normalizeRecords(records, sourceType)` to convert `JsonLineRecord[]` into `SafeFact[]`.

## Behavior

- Maps safe demo `signals` into `SafeFact.code` values.
- Builds `workstreamId` from `sourceType` and adapter `lineNumber` without using raw scenario text.
- Returns only the `SafeFact` contract fields.
- Restricts `code` to `SafeFactCode`; unknown or unsafe signal strings become `unknown_safe_event`.
- Restricts `sourceEventType` to the safe event enum; unknown or unsafe kinds become `unknown`.
- Parses and re-serializes valid event times as ISO strings; invalid or unsafe time strings become `1970-01-01T00:00:00.000Z`.
- Does not carry raw payload, prompt, terminal output, or path fields into normalized facts.

## TDD Evidence

### RED

Command:

```bash
npm test -- tests/server/normalizer.test.ts
```

Result: failed as expected because `../../src/server/normalizer` did not exist.

Relevant failure:

```text
Error: Failed to load url ../../src/server/normalizer ... Does the file exist?
```

### GREEN

Command:

```bash
npm test -- tests/server/normalizer.test.ts
```

Result: passed.

```text
✓ tests/server/normalizer.test.ts (3 tests) 6ms
Test Files  1 passed (1)
Tests  3 passed (3)
```

## Validation

Focused normalizer tests:

```bash
npm test -- tests/server/normalizer.test.ts
```

Result: passed, 3 tests.

Typecheck:

```bash
npm run typecheck
```

Result: passed.

## Privacy Boundary Notes

- The raw `JsonLineRecord.value` is treated as untrusted input.
- The normalizer never returns the raw parsed object.
- Canaries in payload-like fields are dropped because those fields are not represented in `SafeFact`.
- Canaries in enum-like fields are replaced with safe enum fallbacks.
- Canaries in time-like fields are replaced with the epoch fallback unless the value parses as a date, in which case only the parsed ISO timestamp is returned.

## Concerns

- No unresolved implementation concerns.
- The normalizer is not yet wired into a broader ingestion/classification pipeline in this task scope.

## Security Review Fix: Raw Scenario Must Not Influence IDs

### Scope

- Updated `src/server/normalizer.ts`.
- Updated `tests/server/normalizer.test.ts`.
- Removed raw `scenario` from `workstreamId` and fact ID derivation.
- Limited normalizer identity generation to `sourceType`, adapter `lineNumber`, input record order, and signal ordinal.

### RED

Command:

```bash
npm test -- tests/server/normalizer.test.ts
```

Result: failed as expected after adding a regression test proving that changing only raw `scenario` changed `workstreamId`.

```text
× normalizeRecords > does not derive workstream identity from raw scenario values
  expected 'ws_4c8c74dc7d59' to be 'ws_69012e2e0040'
```

### GREEN

Command:

```bash
npm test -- tests/server/normalizer.test.ts
```

Result: passed.

```text
✓ tests/server/normalizer.test.ts (4 tests) 4ms
Test Files  1 passed (1)
Tests  4 passed (4)
```

### Validation

Typecheck:

```bash
npm run typecheck
```

Result: passed.

```text
> latchboard@0.0.0 typecheck
> tsc --noEmit
```

### Concerns

- No unresolved implementation concerns for the Task 4 security review findings.
