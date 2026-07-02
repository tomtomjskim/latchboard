# Latchboard Public Release and Dogfood Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Latchboard for a public GitHub release and first real dogfood run without weakening its local-only privacy model.

**Architecture:** Keep v0 as a local Node/React app with sanitized JSONL input, loopback HTTP, and no remote sync. Add release metadata and operator-facing docs only; defer collectors, Planning Inbox, and CLI execution to later specs.

**Tech Stack:** Node.js 22, npm lockfile, TypeScript, React, Vite, Vitest, Playwright.

## Global Constraints

- Do not add production dependencies.
- Do not implement Planning Inbox, collectors, telemetry, external sync, or CLI execution in this plan.
- Do not expose raw prompts, terminal output, repository paths, branch names, commands, secrets, tokens, or private customer terms in public docs, fixtures, sidecars, REST, SSE, DOM, or reports.
- Keep the server loopback-only by default.
- Keep all release instructions runnable from a fresh clone with `npm ci`, `npm run build`, and `npm run demo`.
- Treat GitHub repository creation and public push as an external publishing step that requires explicit remote/owner confirmation if no remote exists.

---

### Task 1: Release Metadata

**Files:**
- Create: `.nvmrc`
- Create: `LICENSE`
- Modify: `package.json`

**Interfaces:**
- Consumes: Existing npm scripts in `package.json`.
- Produces: Public package metadata and Node version guidance used by README and release checklist.

- [ ] **Step 1: Add a Node version file**

Create `.nvmrc` with:

```text
22
```

- [ ] **Step 2: Add MIT license**

Create `LICENSE` with:

```text
MIT License

Copyright (c) 2026 Tom

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Update package metadata**

Modify `package.json` so it includes:

```json
{
  "version": "0.1.0",
  "private": false,
  "license": "MIT",
  "engines": {
    "node": ">=22 <23"
  }
}
```

Keep existing scripts and dependencies unchanged.

- [ ] **Step 4: Validate metadata**

Run:

```bash
npm pkg get name version private license engines scripts
npm install --package-lock-only
npm test -- tests/scaffold.test.ts
```

Expected:

- package metadata shows `version` `0.1.0`, `private` `false`, `license` `MIT`, and Node engine `>=22 <23`.
- lockfile remains valid.
- scaffold tests pass.

- [ ] **Step 5: Commit**

```bash
git add .nvmrc LICENSE package.json package-lock.json
git commit -m "chore: add public release metadata"
```

---

### Task 2: Public README and Release Checklist

**Files:**
- Modify: `README.md`
- Create: `docs/release-checklist.md`

**Interfaces:**
- Consumes: Runtime flags from `src/server/config.ts` and scripts from `package.json`.
- Produces: Fresh-clone instructions, local operating model, and repeatable release checks.

- [ ] **Step 1: Rewrite README for fresh clone**

Update `README.md` with these sections in this order:

```markdown
# Latchboard

Local AI work completion gate.

## What It Does

## Privacy Model

## Requirements

## Quick Start

## Real Events Mode

## Runtime Flags

## Validation

## Release Checklist

## Roadmap

## Design Docs

## License
```

The Quick Start section must use:

```bash
npm ci
npm run build
npm run demo
```

The smoke-test note must say Playwright browser binaries may require:

```bash
npx playwright install chromium
```

- [ ] **Step 2: Add release checklist**

Create `docs/release-checklist.md` with sections:

```markdown
# Latchboard Release Checklist

## Preflight

## Validation Commands

## Privacy Checks

## GitHub Publish

## Fresh Clone Smoke

## Dogfood Start

## Rollback
```

The GitHub Publish section must not assume a remote exists. It must instruct the operator to add `origin` only after choosing the public repository owner and URL.

- [ ] **Step 3: Validate docs links and commands**

Run:

```bash
rg -n "docs/release-checklist.md|npx playwright install chromium|npm ci|npm run demo|MIT" README.md docs/release-checklist.md
npm test -- tests/scaffold.test.ts
```

Expected:

- The search finds all release docs anchors and required commands.
- scaffold tests pass.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/release-checklist.md
git commit -m "docs: prepare public release guide"
```

---

### Task 3: Dogfood Runbook

**Files:**
- Create: `docs/dogfood-runbook.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: v0 attention reasons from `src/shared/contracts.ts` and v0.2 deferral decision from `docs/reviews/2026-07-01-planning-inbox-review.md`.
- Produces: A first real-use routine for TOM to run Latchboard against actual local events without adding collectors yet.

- [ ] **Step 1: Add dogfood runbook**

Create `docs/dogfood-runbook.md` with sections:

```markdown
# Latchboard Dogfood Runbook

## Objective

## Daily Routine

## Event Source Contract

## Review Questions

## False Positive Log

## False Negative Log

## B/D Failure Focus

## Exit Criteria for v0.2
```

The Event Source Contract section must document sanitized JSONL fields that v0 accepts today:

```json
{
  "time": "2026-07-02T09:10:00.000+09:00",
  "source": "cmux",
  "sessionId": "opaque-session-id",
  "kind": "assistant_turn",
  "signals": ["completion_claim_seen", "next_step_signal_seen"]
}
```

The runbook must explicitly say not to paste raw prompts, terminal output, full paths, repo names, branch names, commands, or secrets into event records.

- [ ] **Step 2: Link runbook from README**

Add `docs/dogfood-runbook.md` under README Design Docs or a new Operations section.

- [ ] **Step 3: Validate doc references**

Run:

```bash
rg -n "dogfood|B/D|completion_claim_seen|next_step_signal_seen|raw prompts|docs/dogfood-runbook.md" README.md docs/dogfood-runbook.md
```

Expected:

- The search confirms the dogfood routine, B/D focus, safe event contract, and README link.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/dogfood-runbook.md
git commit -m "docs: add latchboard dogfood runbook"
```

---

### Task 4: Release Privacy and Publishing Gate

**Files:**
- Create: `scripts/release-preflight.mjs`
- Modify: `package.json`
- Modify: `docs/release-checklist.md`

**Interfaces:**
- Consumes: tracked repository files from `git ls-files`.
- Produces: `npm run release:preflight`, a local check for public-release blockers.

- [ ] **Step 1: Add release preflight script**

Create `scripts/release-preflight.mjs` that:

- runs `git ls-files`,
- scans tracked text files,
- ignores `package-lock.json`,
- fails if tracked files contain `BEGIN PRIVATE KEY`, `OPENAI_API_KEY=`, `ANTHROPIC_API_KEY=`, `ghp_`, `xoxb-`, or `sk-`,
- fails if `package.json` has `"private": true`,
- fails if `LICENSE`, `.nvmrc`, `README.md`, `docs/privacy.md`, `docs/release-checklist.md`, and `docs/dogfood-runbook.md` are missing,
- prints `Release preflight passed` on success.

- [ ] **Step 2: Add npm script**

Modify `package.json`:

```json
{
  "scripts": {
    "release:preflight": "node scripts/release-preflight.mjs"
  }
}
```

Keep existing scripts unchanged.

- [ ] **Step 3: Document preflight**

Add `npm run release:preflight` to `docs/release-checklist.md` validation commands.

- [ ] **Step 4: Prove blocker detection**

Run:

```bash
node -e "const fs=require('fs'); fs.writeFileSync('/tmp/latchboard-preflight-canary.txt','OPENAI_API_KEY=canary')"
npm run release:preflight
```

Expected:

- The script still passes because `/tmp/latchboard-preflight-canary.txt` is not tracked.

Then temporarily append `OPENAI_API_KEY=canary` to a tracked scratch file, run `npm run release:preflight`, confirm it fails, restore the file, and run it again to confirm it passes.

- [ ] **Step 5: Full validation**

Run:

```bash
npm run release:preflight
npm test
npm run typecheck
npm run build
npm run test:smoke
npm audit --omit=dev
```

Expected:

- All commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/release-preflight.mjs docs/release-checklist.md
git commit -m "chore: add release preflight gate"
```

---

### Task 5: Final Review and Publish Decision

**Files:**
- Modify only if final review finds issues.

**Interfaces:**
- Consumes: all prior commits on `chore/public-release-prep`.
- Produces: final decision report: merge-ready locally, blocked on remote owner, or fix required.

- [ ] **Step 1: Generate review package**

Run:

```bash
/Users/jeongsik/.codex/plugins/cache/claude-plugins-official/superpowers/6.1.0/skills/subagent-driven-development/scripts/review-package main HEAD
```

- [ ] **Step 2: Run final review**

Dispatch read-only reviewers for:

- docs/release UX,
- security/privacy,
- reproducibility/QA.

- [ ] **Step 3: Fix Critical/Important findings**

If reviewers return `[HIGH]` or `[MED]`, dispatch one fix subagent with the complete findings list and re-review.

- [ ] **Step 4: Final validation**

Run:

```bash
npm run release:preflight
npm test
npm run typecheck
npm run build
npm run test:smoke
npm audit --omit=dev
```

- [ ] **Step 5: Report publish status**

If no remote exists, report:

```text
Local release prep is complete. GitHub publish is blocked only on choosing the public repo owner and remote URL.
```

If a remote exists, report the remote and ask before pushing public code.
