# Open Design Dashboard Refactor Design

## Product Sentence

Latchboard becomes a local operational console for AI work monitoring: it must show what is live, what is stale, what needs attention, and which safe project/workspace context each workstream belongs to without exposing raw prompts, commands, paths, output, or secrets.

## Approved Direction

Use the `open-design` HUD design system as the visual and interaction reference.

- Source repo: local `open-design` checkout.
- Reference system: `open-design/design-systems/hud`.
- Token source: `open-design/design-systems/hud/tokens.css`.
- Product Design context: local Product Design saved context.

This refactor follows option B from the planning discussion: data trust, loading/status UX, and Open Design HUD UI refactor. It deliberately avoids building a full task runner, kanban board, CLI execution surface, or planning assistant modal in this slice.

## Current Problems

### Loading And Trust

The current UI renders `Loading Latchboard` as plain text when no bootstrap snapshot exists. That gives no feedback about whether the server, API token, snapshot fetch, or cmux source is working. It also makes slow first paint feel like a hung app.

The current status bar shows generated dates and parsed counts, but it does not distinguish:

- cached bootstrap snapshot available,
- first API fetch pending,
- last refresh succeeded,
- refresh retrying after a transient API error,
- source file disconnected,
- real data with no attention items.

### Data Context

The current real mode reads only `~/.cmuxterm/events.jsonl`. Recent cmux samples show `events.jsonl` is dominated by workspace, pane, surface, window, and notification events. It often has no `session_id`. That means Latchboard can show activity, but it often cannot explain the workstream well enough for quick operator judgement.

`~/.cmuxterm/workstream.jsonl` contains safe candidate metadata keys such as `workstreamId`, `cwd`, `title`, `status`, `kind`, `createdAt`, and `updatedAt`. These must be ingested as opt-in safe metadata, with strict sanitization.

### Alias Quality

The current repo alias can show `dev` because it derives the alias from the last cwd segment. A generic parent folder like `<home>/dev` is not a useful repo alias. Alias derivation needs to prefer actual git roots or repo-like cwd segments, and it must reject local account names and generic container folders.

### UI Structure

`src/ui/App.tsx` currently owns data derivation, formatting, loading, layout, attention queue, grouped scope rendering, and detail panel behavior in one file. This makes UI changes slow and fragile.

## Goals

- First viewport must answer in under 10 seconds of visual scan:
  - Is this live, cached, demo, disconnected, or retrying?
  - When was the last successful refresh?
  - How many workstreams need attention?
  - Which safe project/workspace labels are active?
  - Which item should be reviewed first?
- Replace plain loading text with a HUD-style skeleton that preserves the final layout shape.
- Keep bootstrap snapshot visible while refreshes happen in the background.
- Add explicit refresh state copy: `Loading`, `Live`, `Refreshing`, `Retrying`, `Disconnected`, `Demo`.
- Introduce a safe workstream metadata enrichment path from `workstream.jsonl`.
- Improve alias quality so generic parent folders such as `dev` are not presented as project identity.
- Split UI into focused modules with clear responsibilities.
- Preserve loopback-only, token-protected, local-first operation.
- Keep all existing release privacy invariants.

## Non-Goals

- No raw transcript browser.
- No raw terminal output, command text, prompt text, branch name, full path, file content, or freeform extracted task text in UI, state, REST, SSE, logs, or tests.
- No remote telemetry.
- No database migration.
- No modal planning assistant or CLI execution feature in this slice.
- No dependency on external fonts, images, scripts, or CDN assets.
- No new production dependency unless separately approved.

## Open Design HUD Adaptation

Latchboard should not become a decorative cockpit. It uses the HUD system because the product is a dense operational display.

Use these HUD rules:

- Dark native canvas.
- Monospace readouts for time, counts, and state values.
- Compact all-caps labels for fixed metadata.
- Thin borders and flat surfaces; no heavy shadows.
- Status dots or bars for live, warning, alert, demo, and disconnected states.
- Warning/alert colors only for meaningful state.
- No gradients, no decorative animation, no marketing hero, no nested cards.
- Motion is limited to skeleton shimmer and refresh status transitions.

Implementation should copy only the relevant token contract into `src/ui/styles.css`, namespaced for Latchboard where practical. It should not import `open-design` as a runtime dependency.

## Information Architecture

### Shell

The shell owns source trust, refresh state, and the main dense grid.

Top strip:

- product name,
- mode badge,
- source state badge,
- generated date,
- last successful refresh age,
- parsed/malformed/partial counts,
- refresh interval.

### Command Row

A compact command/status row below the top strip:

- Attention count,
- Active workstream count,
- Workspace count,
- Stale/carry-over count,
- Last source activity,
- API refresh state.

This is display-only in this slice. It must not trigger shell commands or mutate files.

### Attention Queue

The attention queue remains the highest priority region. It should show:

- reason chip,
- safe display label,
- safe project/workspace alias when available,
- state,
- last signal,
- last activity,
- evidence label,
- fixed next-step prompt.

Rows must remain buttons with accessible labels and selected state.

### Workspace Map

The workspace map replaces the current table-like `Workspace Groups` block.

It groups scopes by safe project/workspace identity:

- Workspace/project header row,
- child scope rows under the parent,
- ungrouped scope section for scopes without a parent,
- per-row activity age and attention state.

If only workspace-level data exists, the UI must make that clear instead of implying missing child sessions are hidden.

### Detail Panel

The detail panel shows the selected row with fixed safe fields:

- scope kind,
- alias,
- parent alias,
- raw state enum label,
- attention reason,
- certainty,
- last activity,
- last signal,
- evidence,
- next-step prompt.

It should also show a compact trust note when data is metadata-only.

### Daily Summary

Daily summary is secondary and moves below the critical operational regions. It stays compact.

## Loading And Refresh State

Define a UI load model independent from the snapshot contract:

```ts
type RefreshStatus = "bootstrapping" | "ready" | "refreshing" | "retrying" | "disconnected";
```

Rules:

- If bootstrap snapshot exists, render it immediately.
- If no bootstrap snapshot exists, render a full skeleton with HUD panels.
- First successful `/api/snapshot` moves to `ready`.
- Background refresh starts from visible data and temporarily shows `refreshing`.
- Failed background refresh keeps the previous snapshot visible and shows `retrying`.
- Initial fetch failure with no snapshot shows an error panel with recovery copy.
- Source disconnected is derived from `snapshot.sourceStatus.connected === false`.

Skeleton must have stable layout dimensions so first paint does not jump.

## Safe Metadata Enrichment

Add optional real-mode support for `workstream.jsonl`.

### New Safe Contract

```ts
type WorkstreamMetadata = {
  workstreamId: string;
  safeTitle?: string;
  safeStatus?: "running" | "waiting" | "done_claimed" | "verified_done" | "unknown";
  safeKind?: "workspace" | "session" | "surface" | "pane" | "window" | "workstream";
  safeRepoAlias?: ScopeAlias;
  createdAt?: string;
  updatedAt?: string;
};
```

`safeTitle` is optional and must not be copied from arbitrary prompts or output. It may only be kept when it passes a conservative title sanitizer:

- length 2 through 80,
- no absolute paths,
- no URLs,
- no common secret fragments,
- no shell-like command prefixes,
- no JSON-looking payload,
- no local username,
- no raw `.env` or token-looking strings.

If any title is questionable, drop it. Showing less is better than leaking.

### Source Behavior

- Default `dev:cmux` remains safe and does not require metadata enrichment.
- Add an opt-in CLI flag such as `--workstream-input ~/.cmuxterm/workstream.jsonl`.
- Add package script `dev:cmux:full` for local dogfooding with events plus metadata.
- Metadata enrichment never overrides attention classification evidence.
- Metadata can improve display label, alias, kind, and status only after sanitization.

## Alias Derivation

Alias logic must reject:

- `dev`,
- `src`,
- `Users`,
- local username,
- home folder names,
- generic workspace/container folders,
- secret-looking names.

For cwd aliases:

1. Prefer actual git root basename when the cwd is inside a git repository.
2. Otherwise use the nearest repo-like segment that contains package or git markers if available from safe local inspection.
3. Otherwise drop alias rather than showing a misleading generic folder.

The UI may show opaque generated labels when no safe alias exists.

## File Structure

Refactor UI into focused files:

- `src/ui/App.tsx`: top-level state orchestration only.
- `src/ui/view-model.ts`: derived UI view model, grouping, counts, status labels.
- `src/ui/format.ts`: date, age, enum label formatting.
- `src/ui/components/StatusBadge.tsx`: source and refresh badges.
- `src/ui/components/LoadingSkeleton.tsx`: stable first-load skeleton.
- `src/ui/components/DashboardShell.tsx`: layout composition.
- `src/ui/components/AttentionQueue.tsx`: attention row list.
- `src/ui/components/WorkspaceMap.tsx`: grouped workstream map.
- `src/ui/components/ScopeDetail.tsx`: selected item detail panel.
- `src/ui/components/DailySummary.tsx`: compact daily counts.

Server-side enrichment should stay in server modules:

- `src/server/workstream-metadata.ts`: read and sanitize `workstream.jsonl`.
- `src/server/config.ts`: parse optional `--workstream-input`.
- `src/server/store.ts`: merge safe metadata into snapshot summaries.
- `src/shared/contracts.ts`: add safe metadata-derived fields only if needed by public snapshot.

## Testing

Minimum validation:

- Unit tests for title sanitizer and alias sanitizer.
- Store tests for metadata enrichment without raw leak.
- UI render tests for skeleton, refresh status, grouped workspace map, metadata-only note, and no raw id/path leakage.
- Smoke test for demo server first viewport.
- Existing privacy canary and release preflight must pass.

Commands required before merge:

```bash
npm test
npm run typecheck
npm run build
npm run test:smoke
npm run release:preflight
git diff --check
```

## Acceptance Criteria

- A cold UI load shows a structured skeleton, not plain text.
- A bootstrap snapshot renders immediately while background refresh proceeds.
- The dashboard visibly distinguishes live, demo, disconnected, refreshing, and retrying states.
- The main screen makes it clearer whether data is only workspace-level or enriched with session/workstream metadata.
- Safe repo aliases do not show generic `dev` for `<home>/dev`.
- No raw prompt, command, output, full path, branch, local username, token-like text, or raw JSONL payload reaches public snapshot or DOM.
- The UI is visually aligned with Open Design HUD: dark operational canvas, dense readouts, restrained motion, and high-contrast status labels.
- Existing tests plus new targeted tests pass.
