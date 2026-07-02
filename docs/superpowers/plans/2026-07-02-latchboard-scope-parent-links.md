# Latchboard Scope Parent Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link observed cmux session/tool scopes to their parent workspace using only privacy-safe generated scope ids.

**Architecture:** The normalizer will derive all allowlisted cmux scope ids for each event and store them as `relatedScopeIds` on `SafeFact`. The store will derive parent workspace metadata for public summaries only when both the child and workspace scopes exist in the same snapshot. The UI will render parent hints without exposing raw ids.

**Tech Stack:** TypeScript, Vitest, React Testing Library, Playwright smoke tests, existing local-only Latchboard server.

## Global Constraints

- No raw cmux payload, prompt text, terminal output, command text, full path, repo name, branch name, token, or customer identifier may cross the normalizer boundary.
- `relatedScopeIds` must contain only generated ids matching `ws_cmux_events_(workspace|session|surface|pane|window)_[a-f0-9]{16}`.
- Parent fields must be omitted when the related workspace scope is not present in the same snapshot.
- Workspace scopes do not receive a parent in this version.
- Do not add production dependencies.

---

## File Structure

- Modify `src/shared/contracts.ts`: add optional `relatedScopeIds` to `SafeFact`, and parent fields to `AttentionRow` and `WorkstreamSummary`.
- Modify `src/server/normalizer.ts`: factor cmux scope id derivation so primary and related ids use the same hashing logic.
- Modify `src/server/store.ts`: derive parent workspace summaries from workstream facts and existing snapshot rows.
- Modify `src/ui/App.tsx`: render parent hints and detail row.
- Modify `src/ui/styles.css`: add compact parent hint styles.
- Modify tests in `tests/server/normalizer.test.ts`, `tests/server/store.test.ts`, and `tests/ui/render.test.tsx`.
- Update `docs/input-format.md` and the scope parent design doc with the public snapshot fields.

## Task 1: Normalize Related Scope IDs

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/server/normalizer.ts`
- Test: `tests/server/normalizer.test.ts`

**Interfaces:**
- Produces: `SafeFact.relatedScopeIds?: string[]`
- Produces: all related ids use the same safe generated id format as `workstreamId`.

- [ ] **Step 1: Write the failing test**

Add a test to `tests/server/normalizer.test.ts`:

```ts
it("keeps related cmux workspace scope ids without leaking raw identity values", () => {
  const facts = normalizeRecords(
    [
      {
        lineNumber: 191,
        value: {
          type: "event",
          name: "agent.hook.PreToolUse",
          occurred_at: "2026-07-02T05:20:00.000Z",
          payload: {
            session_id: "opaque-session-1",
            workspace_id: "opaque-workspace-1",
            cwd: "/example/private/acme",
            tool_input: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW"
          }
        }
      }
    ],
    "cmux_events"
  );

  expect(facts[0].workstreamId).toMatch(/^ws_cmux_events_session_[a-f0-9]{16}$/);
  expect(facts[0].relatedScopeIds).toEqual([
    expect.stringMatching(/^ws_cmux_events_workspace_[a-f0-9]{16}$/)
  ]);
  expect(facts[0].relatedScopeIds).not.toContain(facts[0].workstreamId);
  expect(JSON.stringify(facts)).not.toContain("opaque-session-1");
  expect(JSON.stringify(facts)).not.toContain("opaque-workspace-1");
  expect(JSON.stringify(facts)).not.toContain("/example/private/acme");
  expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/normalizer.test.ts`

Expected: FAIL because `relatedScopeIds` is undefined.

- [ ] **Step 3: Implement minimal code**

Add `relatedScopeIds?: string[]` to `SafeFact`.

In `src/server/normalizer.ts`, add helpers:

```ts
function cmuxScopeId(field: CmuxIdentityField, raw: string): string {
  const digest = createHash("sha256").update(`${field}:${raw}`).digest("hex").slice(0, 16);
  return `ws_cmux_events_${field.replace("_id", "")}_${digest}`;
}

function cmuxScopeIdsFor(value: Record<string, unknown>, fields: CmuxIdentityField[]): string[] {
  const payload = payloadRecord(value);
  const ids: string[] = [];
  for (const field of fields) {
    const raw = stringField(payload, field) ?? stringField(value, field);
    if (raw) {
      ids.push(cmuxScopeId(field, raw));
    }
  }
  return Array.from(new Set(ids));
}
```

Use `cmuxScopeIdsFor()` in `workstreamIdFor()` and in `normalizeRecords()` to set `relatedScopeIds` to all cmux scope ids except the primary id. Omit the property when the list is empty.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/normalizer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/shared/contracts.ts src/server/normalizer.ts tests/server/normalizer.test.ts
git commit -m "feat: retain safe related scope ids"
```

## Task 2: Derive Parent Workspace Fields in Snapshots

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/server/store.ts`
- Test: `tests/server/store.test.ts`

**Interfaces:**
- Produces optional `parentScopeId`, `parentLabel`, `parentScopeKind` on `AttentionRow` and `WorkstreamSummary`.

- [ ] **Step 1: Write the failing test**

Add a test to `tests/server/store.test.ts`:

```ts
it("links a cmux session summary to its related workspace summary", () => {
  const workspaceFact: SafeFact = {
    id: "fact_workspace",
    sourceType: "cmux_events",
    occurredAt: "2026-07-02T05:00:00.000Z",
    workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
    code: "activity_seen",
    sourceEventType: "system"
  };
  const sessionFact: SafeFact = {
    id: "fact_session",
    sourceType: "cmux_events",
    occurredAt: "2026-07-02T05:05:00.000Z",
    workstreamId: "ws_cmux_events_session_bbbbbbbb22222222",
    relatedScopeIds: ["ws_cmux_events_workspace_aaaaaaaa11111111"],
    code: "tool_started",
    sourceEventType: "tool"
  };
  const snapshot = buildSnapshot({
    mode: "real",
    date: "2026-07-02",
    timezone: "Asia/Seoul",
    generatedAt: "2026-07-02T05:10:00.000Z",
    sourceStatus,
    workstreams: [
      workstream("ws_cmux_events_workspace_aaaaaaaa11111111", "running", [workspaceFact]),
      workstream("ws_cmux_events_session_bbbbbbbb22222222", "running", [sessionFact])
    ],
    classifications: [
      classification("ws_cmux_events_workspace_aaaaaaaa11111111", null),
      classification("ws_cmux_events_session_bbbbbbbb22222222", null)
    ]
  });

  const session = snapshot.workstreams.find((row) => row.scopeKind === "session");
  expect(session).toMatchObject({
    parentScopeId: "ws_cmux_events_workspace_aaaaaaaa11111111",
    parentLabel: "workspace aaaaaa",
    parentScopeKind: "workspace"
  });
  expect(JSON.stringify(snapshot)).not.toContain("opaque-workspace");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/store.test.ts`

Expected: FAIL because parent fields are missing.

- [ ] **Step 3: Implement minimal code**

Add optional parent fields to `AttentionRow` and `WorkstreamSummary`:

```ts
parentScopeId?: string;
parentLabel?: string;
parentScopeKind?: ScopeKind;
```

In `buildSnapshot()`, first build summaries, then create a `Map<string, WorkstreamSummary>`. For each non-workspace cmux summary, inspect its source `WorkstreamState.facts` for a related id whose summary has `scopeKind === "workspace"`. Copy the safe parent fields onto the child summary. Copy the same fields into attention rows.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/store.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/shared/contracts.ts src/server/store.ts tests/server/store.test.ts
git commit -m "feat: link scopes to parent workspace"
```

## Task 3: Render Parent Hints in the UI

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Test: `tests/ui/render.test.tsx`

**Interfaces:**
- Consumes: `WorkstreamSummary.parentLabel` and `AttentionRow.parentLabel`.

- [ ] **Step 1: Write the failing test**

Extend `activityOnlySnapshot` or create `linkedSnapshot` in `tests/ui/render.test.tsx` with both workspace and session rows. Assert:

```ts
expect(screen.getByRole("button", { name: "View session bbbbbb details" })).toBeTruthy();
expect(screen.getAllByText("Parent workspace aaaaaa").length).toBeGreaterThan(0);
expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/ui/render.test.tsx`

Expected: FAIL because parent labels are not rendered.

- [ ] **Step 3: Implement minimal code**

Add a `ParentHint` helper in `src/ui/App.tsx`:

```tsx
function ParentHint({ scope }: { scope: { parentLabel?: string } }) {
  return scope.parentLabel ? <span className="parent-hint">Parent {scope.parentLabel}</span> : null;
}
```

Render `ParentHint` under labels in queue rows and observed scope rows. In `DetailPanel`, add a `Parent` row when `workstream.parentLabel` exists.

Add CSS:

```css
.parent-hint {
  color: #53616d;
  font-size: 12px;
  font-weight: 600;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/ui/render.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/ui/App.tsx src/ui/styles.css tests/ui/render.test.tsx
git commit -m "feat: show parent workspace hints"
```

## Task 4: Docs, Full Validation, and PR

**Files:**
- Modify: `docs/input-format.md`
- Modify: `docs/superpowers/specs/2026-07-02-latchboard-scope-parent-links-design.md`
- Optional modify: `README.md`

**Interfaces:**
- Documents public parent fields and the limitation that human-readable repo/task metadata remains out of scope.

- [ ] **Step 1: Update docs**

Document `relatedScopeIds` as internal sanitized facts and public parent fields as optional snapshot metadata. State that raw ids and human-readable repo/task metadata remain prohibited.

- [ ] **Step 2: Run full validation**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run release:preflight
```

For smoke, stop any local server on `127.0.0.1:8787`, then run:

```bash
npm run test:smoke
```

Expected: all commands pass.

- [ ] **Step 3: Run real cmux check**

Run:

```bash
npm run dev:cmux
```

Open `http://127.0.0.1:8787` and verify:

- `Observed Scopes` renders.
- `Loading Latchboard` is absent after DOM content load.
- Session rows show `Parent workspace ...` when real events contain both session and workspace identity.

- [ ] **Step 4: Commit docs if not already committed**

Run:

```bash
git add docs/input-format.md docs/superpowers/specs/2026-07-02-latchboard-scope-parent-links-design.md README.md
git commit -m "docs: describe safe scope parent links"
```

- [ ] **Step 5: Push and open PR**

Run:

```bash
git push -u origin codex/scope-parent-links
git gh-tomtomjskim pr create --base main --head codex/scope-parent-links --draft --title "Link safe cmux scopes to parent workspaces" --body "## Summary
- keep privacy-safe related cmux scope ids on normalized facts
- derive parent workspace metadata for session/tool scope summaries
- render compact parent workspace hints in the dashboard

## Validation
- npm test
- npm run typecheck
- npm run build
- npm run release:preflight
- npm run test:smoke
- live dev:cmux DOM check"
```
