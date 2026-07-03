# Safe Label Registration Design

## Goal

Make Latchboard usable when cmux only provides workspace-level activity by giving the operator a safe, local way to attach display labels and by marking unlabeled workspace rows as context-poor.

## Scope

This slice adds:

- an append-only local CLI for writing sanitized `safeTitle` records to `workstream.jsonl`,
- a public snapshot hint for generated workspace labels that still need safe context,
- compact UI treatment for that hint in rows and detail.

This slice does not add an in-browser editor, remote agent scheduling, task execution, prompt capture, or raw transcript parsing.

## CLI Contract

Add a local command:

```bash
npm run label:cmux -- --workstream-id <id> --safe-title <safe label>
```

Optional flags:

- `--input <path>` defaults to `~/.cmuxterm/workstream.jsonl`.
- `--status <running|waiting|done_claimed|verified_done|unknown>`.
- `--kind <workspace|session|surface|pane|window|workstream>`.
- `--cwd <path>` may derive a safe repo alias through the existing sanitizer.

The command appends one complete JSONL record. It rejects unsafe titles and invalid file basenames before writing.

## Snapshot Hint

Add `displayHints?: ("needs_safe_label")[]` to workstream and attention rows. A cmux workspace row gets this hint when it has no `safeTitle` metadata and no safe repo alias. The hint is public because it contains only derived state, not raw source data.

## UI

Rows show a small `NEEDS LABEL` chip when the hint is present. The detail panel shows `Context: safe label missing`. This keeps the screen honest: the operator can distinguish “no active issue” from “monitoring data exists but the workstream is not yet named safely.”

## Validation

- Unit test CLI record building and append behavior.
- Unit test snapshot hint derivation.
- UI test row/detail rendering.
- Full validation: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:smoke`, `npm run release:preflight`, `git diff --check`.
