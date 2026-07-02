# Latchboard v0 Implementation Plan

> **For agentic workers:** REQUIRED SUBSKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Latchboard v0 as a local, read-only AI work completion gate that turns today's cmux `events.jsonl` into an attention queue for missing validation, missing next step, blocked work, and stale work.

**Architecture:** Implement a TypeScript local web app with a strict privacy boundary: `ConfigRuntime -> EventsAdapter -> Normalizer -> WorkstreamReducer -> Classifier -> DerivedStore -> WebServer -> UI`. The server exposes sanitized REST snapshots and SSE updates; the React UI renders Today bar, Attention Queue, All Workstreams, Detail Drawer, and Daily strip. The Normalizer is the only layer allowed to see raw JSONL input, and raw content must never cross it.

**Tech Stack:** Node.js 20+, TypeScript, Vite, React, Vitest, Playwright, Node built-in HTTP/filesystem modules where practical, no production database in v0.

## Global Constraints

- v0 required input is `events.jsonl` only; `workstream.jsonl` is not implemented in v0.
- `npm run demo` must work from bundled fixtures without private logs.
- Server must bind to `127.0.0.1` only.
- All `/api/*` and `/api/stream` requests require a per-run token.
- Runtime must not load external fonts, images, scripts, telemetry, or network assets.
- Raw cmux line, raw payload, prompt text, terminal output, command text, full cwd, full path, full repo name, branch name, customer name, secret-looking string, or extracted freeform string must never cross the Normalizer boundary.
- `nextStepPromptTemplateId` is enum-only; v0 forbids freeform next-step text and raw-log-derived interpolation.
- Privacy canary leakage to sidecar store, REST, SSE, DOM, or server logs blocks release.
- Planning Inbox is excluded from v0 implementation.

---

## File Structure

- Create `package.json`: scripts and dependency declarations.
- Create `tsconfig.json`: shared TypeScript config.
- Create `vite.config.ts`: React/Vite config.
- Create `vitest.config.ts`: unit/integration test config.
- Create `playwright.config.ts`: smoke UI test config.
- Create `src/shared/contracts.ts`: shared DTOs, enums, privacy-safe types.
- Create `src/server/config.ts`: runtime config parser and token generation.
- Create `src/server/events-adapter.ts`: JSONL reading/tailing and sanitized source status.
- Create `src/server/normalizer.ts`: raw event to `SafeFact` conversion and privacy boundary.
- Create `src/server/reducer.ts`: workstream grouping from `SafeFact[]`.
- Create `src/server/classifier.ts`: deterministic B/D/blocked/stale classification.
- Create `src/server/store.ts`: in-memory derived state and sidecar snapshot writer.
- Create `src/server/http.ts`: REST/SSE/static server.
- Create `src/server/main.ts`: CLI entrypoint.
- Create `src/ui/App.tsx`: dashboard shell.
- Create `src/ui/api.ts`: snapshot/SSE client.
- Create `src/ui/styles.css`: dense operational styling.
- Create `fixtures/*.jsonl`: public fixture set.
- Create `tests/**/*.test.ts`: unit/integration tests.
- Create `tests/smoke/*.spec.ts`: Playwright smoke tests.

---

### Task 1: Project Scaffold and Runtime Scripts

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/server/main.ts`
- Create: `src/ui/App.tsx`
- Create: `src/ui/styles.css`
- Test: `tests/scaffold.test.ts`

**Interfaces:**
- Produces scripts used by every later task: `npm run demo`, `npm run dev`, `npm test`, `npm run test:smoke`, `npm run typecheck`.
- Produces the initial Vite app root for later UI work.

- [ ] **Step 1: Write the scaffold smoke test**

Create `tests/scaffold.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("project scaffold", () => {
  it("defines required npm scripts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.demo).toBe("tsx src/server/main.ts --mode demo");
    expect(pkg.scripts.dev).toBe("tsx src/server/main.ts");
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts["test:smoke"]).toBe("playwright test");
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scaffold.test.ts`

Expected: FAIL because `package.json` and test tooling do not exist yet.

- [ ] **Step 3: Add package and TypeScript config**

Create `package.json`:

```json
{
  "name": "latchboard",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "demo": "tsx src/server/main.ts --mode demo",
    "dev": "tsx src/server/main.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "playwright test",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals"],
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "*.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    outDir: "dist/ui"
  }
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/smoke",
  use: {
    baseURL: "http://127.0.0.1:8787"
  },
  webServer: {
    command: "npm run demo",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: false,
    timeout: 30_000
  }
});
```

- [ ] **Step 4: Add minimal entrypoints**

Create `src/server/main.ts`:

```ts
console.log("Latchboard server scaffold ready");
```

Create `src/ui/App.tsx`:

```tsx
import "./styles.css";

export function App() {
  return <main className="app">Latchboard</main>;
}
```

Create `src/ui/styles.css`:

```css
:root {
  color: #172026;
  background: #f6f7f9;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

.app {
  min-height: 100vh;
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: PASS and creates `package-lock.json`.

- [ ] **Step 6: Run scaffold checks**

Run: `npm test -- tests/scaffold.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts src tests
git commit -m "chore: scaffold latchboard v0"
```

---

### Task 2: Shared Contracts and Fixtures

**Files:**
- Create: `src/shared/contracts.ts`
- Create: `fixtures/demo-attention-gate.jsonl`
- Create: `fixtures/privacy-canary.jsonl`
- Create: `fixtures/malformed-partial.jsonl`
- Create: `fixtures/realtime-append.initial.jsonl`
- Create: `fixtures/realtime-append.append.jsonl`
- Create: `fixtures/today-stale-boundary.jsonl`
- Test: `tests/contracts.test.ts`

**Interfaces:**
- Produces shared enums and DTOs consumed by server and UI.
- Produces fixture files consumed by adapter, classifier, privacy, and smoke tests.

- [ ] **Step 1: Write contract tests**

Create `tests/contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  evidenceLabel,
  nextStepPromptLabel,
  type Classification,
  type SafeFact
} from "../src/shared/contracts";

describe("contracts", () => {
  it("renders fixed labels without dynamic interpolation", () => {
    expect(nextStepPromptLabel("run_validation")).toBe("Run the planned validation and review the result.");
    expect(evidenceLabel("completion_claim_without_validation")).toBe("Completion was claimed without a validation signal.");
  });

  it("keeps SafeFact metadata-only", () => {
    const fact: SafeFact = {
      id: "fact_1",
      sourceType: "demo",
      occurredAt: "2026-07-01T09:00:00.000+09:00",
      workstreamId: "ws_1",
      code: "completion_claim_seen",
      sourceEventType: "assistant"
    };
    expect(JSON.stringify(fact)).not.toContain("payload");
  });

  it("allows null attention reason for verified work", () => {
    const classification: Classification = {
      workstreamId: "ws_1",
      attentionReason: null,
      severity: "low",
      certainty: "explicit",
      evidenceCodes: ["validation_signal_present"],
      nextStepStatus: "not_required",
      nextStepPromptTemplateId: "no_prompt",
      since: "2026-07-01T09:30:00.000+09:00"
    };
    expect(classification.attentionReason).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/contracts.test.ts`

Expected: FAIL because `src/shared/contracts.ts` does not exist yet.

- [ ] **Step 3: Add shared contracts**

Create `src/shared/contracts.ts`:

```ts
export type SourceType = "cmux_events" | "demo";

export type SafeFactCode =
  | "session_started"
  | "tool_started"
  | "tool_finished"
  | "tool_failed"
  | "completion_claim_seen"
  | "validation_signal_seen"
  | "next_step_signal_seen"
  | "blocked_signal_seen"
  | "idle_signal_seen"
  | "unknown_safe_event";

export type SafeSourceEventType = "session" | "tool" | "assistant" | "system" | "unknown";

export type SafeFact = {
  id: string;
  sourceType: SourceType;
  occurredAt: string;
  workstreamId: string;
  code: SafeFactCode;
  sourceEventType: SafeSourceEventType;
};

export type RawState = "running" | "waiting" | "done_claimed" | "verified_done" | "unknown";

export type WorkstreamState = {
  id: string;
  sourceType: SourceType;
  label: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  facts: SafeFact[];
  rawState: RawState;
};

export type AttentionReason = "missing_validation" | "missing_next_step" | "blocked" | "stale";
export type Certainty = "explicit" | "inferred" | "weak";
export type NextStepStatus = "present" | "missing" | "unclear" | "not_required";

export type NextStepPromptTemplateId =
  | "run_validation"
  | "write_next_step"
  | "resolve_blocker"
  | "review_stale_work"
  | "no_prompt";

export type EvidenceCode =
  | "completion_claim_without_validation"
  | "no_next_step_signal"
  | "blocked_signal_without_resolution"
  | "inactive_past_stale_threshold"
  | "validation_signal_present";

export type Classification = {
  workstreamId: string;
  attentionReason: AttentionReason | null;
  severity: "high" | "medium" | "low";
  certainty: Certainty;
  evidenceCodes: EvidenceCode[];
  nextStepStatus: NextStepStatus;
  nextStepPromptTemplateId: NextStepPromptTemplateId;
  since: string;
};

export type SourceStatus = {
  connected: boolean;
  parsedLineCount: number;
  malformedLineCount: number;
  partialLineCount: number;
};

export type AttentionRow = {
  workstreamId: string;
  label: string;
  lastActivityAt: string;
  classification: Classification;
};

export type WorkstreamSummary = {
  workstreamId: string;
  label: string;
  lastActivityAt: string;
  rawState: RawState;
  classification: Classification;
};

export type TodaySnapshot = {
  mode: "demo" | "real";
  date: string;
  timezone: string;
  generatedAt: string;
  sourceStatus: SourceStatus;
  attention: AttentionRow[];
  workstreams: WorkstreamSummary[];
  dailySummary: {
    unresolved: number;
    verifiedDone: number;
    carryOver: number;
  };
};

const evidenceLabels: Record<EvidenceCode, string> = {
  completion_claim_without_validation: "Completion was claimed without a validation signal.",
  no_next_step_signal: "No next-step signal was detected.",
  blocked_signal_without_resolution: "Blocked work has no later resolution signal.",
  inactive_past_stale_threshold: "No activity was detected past the stale threshold.",
  validation_signal_present: "Validation signal is present."
};

const promptLabels: Record<NextStepPromptTemplateId, string> = {
  run_validation: "Run the planned validation and review the result.",
  write_next_step: "Write the next step before continuing.",
  resolve_blocker: "Resolve or restate the blocker before closing.",
  review_stale_work: "Review stale work and decide whether to continue or carry over.",
  no_prompt: "No next-step prompt is required."
};

export function evidenceLabel(code: EvidenceCode): string {
  return evidenceLabels[code];
}

export function nextStepPromptLabel(id: NextStepPromptTemplateId): string {
  return promptLabels[id];
}
```

- [ ] **Step 4: Add public fixtures**

Create `fixtures/demo-attention-gate.jsonl` with sanitized demo events:

```jsonl
{"kind":"demo","scenario":"missing_validation","time":"2026-07-01T09:00:00.000+09:00","signals":["session_started","completion_claim_seen"]}
{"kind":"demo","scenario":"missing_next_step","time":"2026-07-01T09:10:00.000+09:00","signals":["session_started","tool_finished"]}
{"kind":"demo","scenario":"blocked","time":"2026-07-01T09:20:00.000+09:00","signals":["session_started","blocked_signal_seen"]}
{"kind":"demo","scenario":"stale","time":"2026-07-01T06:00:00.000+09:00","signals":["session_started","idle_signal_seen"]}
{"kind":"demo","scenario":"verified_done","time":"2026-07-01T09:30:00.000+09:00","signals":["session_started","completion_claim_seen","validation_signal_seen","next_step_signal_seen"]}
```

Create `fixtures/privacy-canary.jsonl`:

```jsonl
{"kind":"demo","scenario":"missing_validation","time":"2026-07-01T09:00:00.000+09:00","signals":["session_started","completion_claim_seen"],"payload":"LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW raw prompt terminal output example-private-path repo-name branch-name command-text synthetic-secret-canary token-prefix-canary"}
```

Create `fixtures/malformed-partial.jsonl`:

```jsonl
{"kind":"demo","scenario":"missing_validation","time":"2026-07-01T09:00:00.000+09:00","signals":["session_started","completion_claim_seen"]}
{not-json
{"kind":"demo","scenario":"unknown","time":"2026-07-01T09:05:00.000+09:00"}
{"kind":"demo","scenario":"partial"
```

Create `fixtures/realtime-append.initial.jsonl`:

```jsonl
{"kind":"demo","scenario":"missing_next_step","time":"2026-07-01T09:00:00.000+09:00","signals":["session_started","tool_finished"]}
```

Create `fixtures/realtime-append.append.jsonl`:

```jsonl
{"kind":"demo","scenario":"verified_done","time":"2026-07-01T09:05:00.000+09:00","signals":["completion_claim_seen","validation_signal_seen","next_step_signal_seen"]}
```

Create `fixtures/today-stale-boundary.jsonl`:

```jsonl
{"kind":"demo","scenario":"stale","time":"2026-07-01T06:30:00.000+09:00","signals":["session_started","idle_signal_seen"]}
{"kind":"demo","scenario":"verified_done","time":"2026-06-30T23:30:00.000+09:00","signals":["session_started","completion_claim_seen","validation_signal_seen"]}
```

- [ ] **Step 5: Run contract tests**

Run: `npm test -- tests/contracts.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared fixtures tests/contracts.test.ts
git commit -m "feat: define safe contracts and fixtures"
```

---

### Task 3: Config Runtime and Events Adapter

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/events-adapter.ts`
- Test: `tests/server/config.test.ts`
- Test: `tests/server/events-adapter.test.ts`

**Interfaces:**
- Consumes fixtures from Task 2.
- Produces `RuntimeConfig`, `JsonLineRecord`, `SourceReadResult` for Normalizer.

- [ ] **Step 1: Write config tests**

Create `tests/server/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "../../src/server/config";

describe("parseRuntimeConfig", () => {
  it("defaults to loopback and a per-run token", () => {
    const config = parseRuntimeConfig(["--mode", "demo"], { now: new Date("2026-07-01T00:00:00.000Z") });
    expect(config.mode).toBe("demo");
    expect(config.host).toBe("127.0.0.1");
    expect(config.token.length).toBeGreaterThanOrEqual(24);
  });

  it("requires explicit input in real mode", () => {
    expect(() => parseRuntimeConfig(["--mode", "real"], { now: new Date("2026-07-01T00:00:00.000Z") })).toThrow("real mode requires --input");
  });
});
```

- [ ] **Step 2: Write adapter tests**

Create `tests/server/events-adapter.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readJsonlSince } from "../../src/server/events-adapter";

describe("readJsonlSince", () => {
  it("reads complete lines and counts malformed/partial lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-"));
    const path = join(dir, "events.jsonl");
    writeFileSync(path, "{\"ok\":true}\n{bad\n{\"partial\":");
    const result = readJsonlSince({ path, offset: 0 });
    expect(result.records).toHaveLength(1);
    expect(result.status.parsedLineCount).toBe(1);
    expect(result.status.malformedLineCount).toBe(1);
    expect(result.status.partialLineCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/server/config.test.ts tests/server/events-adapter.test.ts`

Expected: FAIL because server modules do not exist.

- [ ] **Step 4: Implement config parser**

Create `src/server/config.ts`:

```ts
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

export type RuntimeMode = "demo" | "real";

export type RuntimeConfig = {
  mode: RuntimeMode;
  inputPath: string;
  statePath: string;
  host: "127.0.0.1";
  port: number;
  token: string;
  timezone: string;
  staleThresholdMs: number;
  now: Date;
};

export function parseRuntimeConfig(argv: string[], deps: { now: Date } = { now: new Date() }): RuntimeConfig {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const mode = (get("--mode") ?? "real") as RuntimeMode;
  if (mode !== "demo" && mode !== "real") {
    throw new Error(`unsupported mode: ${mode}`);
  }
  const input = get("--input");
  if (mode === "real" && !input) {
    throw new Error("real mode requires --input");
  }
  const inputPath = mode === "demo" ? resolve("fixtures/demo-attention-gate.jsonl") : resolve(input as string);
  return {
    mode,
    inputPath,
    statePath: resolve(get("--state") ?? ".latchboard/state.json"),
    host: "127.0.0.1",
    port: Number(get("--port") ?? "8787"),
    token: randomBytes(18).toString("base64url"),
    timezone: get("--timezone") ?? "Asia/Seoul",
    staleThresholdMs: Number(get("--stale-ms") ?? String(2 * 60 * 60 * 1000)),
    now: deps.now
  };
}
```

- [ ] **Step 5: Implement JSONL adapter**

Create `src/server/events-adapter.ts`:

```ts
import { existsSync, readFileSync, statSync } from "node:fs";
import type { SourceStatus } from "../shared/contracts";

export type SourceCursor = {
  path: string;
  offset: number;
};

export type JsonLineRecord = {
  lineNumber: number;
  value: unknown;
};

export type SourceReadResult = {
  records: JsonLineRecord[];
  cursor: SourceCursor;
  status: SourceStatus;
};

export function readJsonlSince(cursor: SourceCursor): SourceReadResult {
  const status: SourceStatus = {
    connected: existsSync(cursor.path),
    parsedLineCount: 0,
    malformedLineCount: 0,
    partialLineCount: 0
  };
  if (!status.connected) {
    return { records: [], cursor, status };
  }
  const size = statSync(cursor.path).size;
  const offset = cursor.offset > size ? 0 : cursor.offset;
  const text = readFileSync(cursor.path, "utf8").slice(offset);
  const lines = text.split("\n");
  const hasPartial = text.length > 0 && !text.endsWith("\n");
  const completeLines = hasPartial ? lines.slice(0, -1) : lines;
  if (hasPartial) {
    status.partialLineCount += 1;
  }
  const records: JsonLineRecord[] = [];
  completeLines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    try {
      records.push({ lineNumber: index + 1, value: JSON.parse(line) });
      status.parsedLineCount += 1;
    } catch {
      status.malformedLineCount += 1;
    }
  });
  const consumed = completeLines.join("\n").length + (completeLines.length > 0 ? 1 : 0);
  return {
    records,
    cursor: { path: cursor.path, offset: offset + consumed },
    status
  };
}
```

- [ ] **Step 6: Run adapter/config tests**

Run: `npm test -- tests/server/config.test.ts tests/server/events-adapter.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/config.ts src/server/events-adapter.ts tests/server
git commit -m "feat: add runtime config and jsonl adapter"
```

---

### Task 4: Normalizer Privacy Boundary

**Files:**
- Create: `src/server/normalizer.ts`
- Test: `tests/server/normalizer.test.ts`

**Interfaces:**
- Consumes `JsonLineRecord`.
- Produces `SafeFact[]`.
- Enforces that raw fields and privacy canaries do not cross into `SafeFact`.

- [ ] **Step 1: Write normalizer tests**

Create `tests/server/normalizer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeRecords } from "../../src/server/normalizer";

describe("normalizeRecords", () => {
  it("maps demo signals into SafeFact records", () => {
    const facts = normalizeRecords([
      {
        lineNumber: 1,
        value: {
          kind: "demo",
          scenario: "missing_validation",
          time: "2026-07-01T09:00:00.000+09:00",
          signals: ["session_started", "completion_claim_seen"]
        }
      }
    ], "demo");
    expect(facts.map((fact) => fact.code)).toEqual(["session_started", "completion_claim_seen"]);
  });

  it("does not leak canary payload into normalized facts", () => {
    const facts = normalizeRecords([
      {
        lineNumber: 1,
        value: {
          kind: "demo",
          scenario: "missing_validation",
          time: "2026-07-01T09:00:00.000+09:00",
          signals: ["session_started"],
          payload: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW /Users/private/acme"
        }
      }
    ], "demo");
    expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
    expect(JSON.stringify(facts)).not.toContain("/Users/private/acme");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/normalizer.test.ts`

Expected: FAIL because `normalizer.ts` does not exist.

- [ ] **Step 3: Implement normalizer**

Create `src/server/normalizer.ts`:

```ts
import { createHash } from "node:crypto";
import type { SafeFact, SafeFactCode, SafeSourceEventType, SourceType } from "../shared/contracts";
import type { JsonLineRecord } from "./events-adapter";

const allowedCodes = new Set<SafeFactCode>([
  "session_started",
  "tool_started",
  "tool_finished",
  "tool_failed",
  "completion_claim_seen",
  "validation_signal_seen",
  "next_step_signal_seen",
  "blocked_signal_seen",
  "idle_signal_seen",
  "unknown_safe_event"
]);

function safeId(input: string): string {
  return `ws_${createHash("sha256").update(input).digest("hex").slice(0, 12)}`;
}

function sourceEventType(value: unknown): SafeSourceEventType {
  if (value === "session" || value === "tool" || value === "assistant" || value === "system") {
    return value;
  }
  return "unknown";
}

function safeTime(value: unknown): string {
  return typeof value === "string" ? value : new Date(0).toISOString();
}

export function normalizeRecords(records: JsonLineRecord[], sourceType: SourceType): SafeFact[] {
  const facts: SafeFact[] = [];
  records.forEach((record) => {
    const value = record.value as Record<string, unknown>;
    const scenario = typeof value.scenario === "string" ? value.scenario : `line_${record.lineNumber}`;
    const workstreamId = safeId(`${sourceType}:${scenario}`);
    const signals = Array.isArray(value.signals) ? value.signals : ["unknown_safe_event"];
    signals.forEach((signal, index) => {
      const code = allowedCodes.has(signal as SafeFactCode) ? (signal as SafeFactCode) : "unknown_safe_event";
      facts.push({
        id: `fact_${workstreamId}_${record.lineNumber}_${index}`,
        sourceType,
        occurredAt: safeTime(value.time),
        workstreamId,
        code,
        sourceEventType: sourceEventType(value.kind)
      });
    });
  });
  return facts;
}
```

- [ ] **Step 4: Run normalizer tests**

Run: `npm test -- tests/server/normalizer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/normalizer.ts tests/server/normalizer.test.ts
git commit -m "feat: enforce normalizer privacy boundary"
```

---

### Task 5: Workstream Reducer and Classifier

**Files:**
- Create: `src/server/reducer.ts`
- Create: `src/server/classifier.ts`
- Test: `tests/server/reducer.test.ts`
- Test: `tests/server/classifier.test.ts`

**Interfaces:**
- Consumes `SafeFact[]`.
- Produces `WorkstreamState[]` and `Classification`.

- [ ] **Step 1: Write reducer test**

Create `tests/server/reducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SafeFact } from "../../src/shared/contracts";
import { reduceWorkstreams } from "../../src/server/reducer";

const fact = (code: SafeFact["code"], at: string): SafeFact => ({
  id: `fact_${code}_${at}`,
  sourceType: "demo",
  occurredAt: at,
  workstreamId: "ws_1",
  code,
  sourceEventType: "assistant"
});

describe("reduceWorkstreams", () => {
  it("groups safe facts into one opaque workstream", () => {
    const states = reduceWorkstreams([
      fact("session_started", "2026-07-01T09:00:00.000+09:00"),
      fact("completion_claim_seen", "2026-07-01T09:10:00.000+09:00")
    ]);
    expect(states).toHaveLength(1);
    expect(states[0]?.label).toBe("Workstream 1");
    expect(states[0]?.rawState).toBe("done_claimed");
  });
});
```

- [ ] **Step 2: Write classifier test**

Create `tests/server/classifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { WorkstreamState } from "../../src/shared/contracts";
import { classifyWorkstream } from "../../src/server/classifier";

const base: WorkstreamState = {
  id: "ws_1",
  sourceType: "demo",
  label: "Workstream 1",
  createdAt: "2026-07-01T09:00:00.000+09:00",
  updatedAt: "2026-07-01T09:10:00.000+09:00",
  lastActivityAt: "2026-07-01T09:10:00.000+09:00",
  rawState: "done_claimed",
  facts: [
    {
      id: "fact_1",
      sourceType: "demo",
      occurredAt: "2026-07-01T09:10:00.000+09:00",
      workstreamId: "ws_1",
      code: "completion_claim_seen",
      sourceEventType: "assistant"
    }
  ]
};

describe("classifyWorkstream", () => {
  it("classifies completion without validation as missing_validation", () => {
    const classification = classifyWorkstream(base, {
      now: new Date("2026-07-01T10:00:00.000+09:00"),
      staleThresholdMs: 2 * 60 * 60 * 1000
    });
    expect(classification.attentionReason).toBe("missing_validation");
    expect(classification.nextStepPromptTemplateId).toBe("run_validation");
  });

  it("classifies inactivity past threshold as stale", () => {
    const classification = classifyWorkstream({ ...base, rawState: "waiting", facts: [] }, {
      now: new Date("2026-07-01T12:00:00.000+09:00"),
      staleThresholdMs: 2 * 60 * 60 * 1000
    });
    expect(classification.attentionReason).toBe("missing_next_step");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`

Expected: FAIL because reducer/classifier modules do not exist.

- [ ] **Step 4: Implement reducer**

Create `src/server/reducer.ts`:

```ts
import type { RawState, SafeFact, WorkstreamState } from "../shared/contracts";

function rawStateFor(facts: SafeFact[]): RawState {
  if (facts.some((fact) => fact.code === "validation_signal_seen")) {
    return "verified_done";
  }
  if (facts.some((fact) => fact.code === "completion_claim_seen")) {
    return "done_claimed";
  }
  if (facts.some((fact) => fact.code === "tool_started")) {
    return "running";
  }
  if (facts.some((fact) => fact.code === "session_started")) {
    return "waiting";
  }
  return "unknown";
}

export function reduceWorkstreams(facts: SafeFact[]): WorkstreamState[] {
  const groups = new Map<string, SafeFact[]>();
  facts.forEach((fact) => {
    groups.set(fact.workstreamId, [...(groups.get(fact.workstreamId) ?? []), fact]);
  });
  return [...groups.entries()].map(([id, group], index) => {
    const sorted = [...group].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const first = sorted[0]?.occurredAt ?? new Date(0).toISOString();
    const last = sorted.at(-1)?.occurredAt ?? first;
    return {
      id,
      sourceType: sorted[0]?.sourceType ?? "demo",
      label: `Workstream ${index + 1}`,
      createdAt: first,
      updatedAt: last,
      lastActivityAt: last,
      facts: sorted,
      rawState: rawStateFor(sorted)
    };
  });
}
```

- [ ] **Step 5: Implement classifier**

Create `src/server/classifier.ts`:

```ts
import type { Classification, WorkstreamState } from "../shared/contracts";

type ClassifierConfig = {
  now: Date;
  staleThresholdMs: number;
};

const has = (state: WorkstreamState, code: string): boolean => state.facts.some((fact) => fact.code === code);

export function classifyWorkstream(state: WorkstreamState, config: ClassifierConfig): Classification {
  const base = {
    workstreamId: state.id,
    severity: "medium" as const,
    certainty: "inferred" as const,
    since: state.lastActivityAt
  };
  if (has(state, "blocked_signal_seen")) {
    return {
      ...base,
      attentionReason: "blocked",
      severity: "high",
      evidenceCodes: ["blocked_signal_without_resolution"],
      nextStepStatus: "missing",
      nextStepPromptTemplateId: "resolve_blocker"
    };
  }
  if (has(state, "completion_claim_seen") && !has(state, "validation_signal_seen")) {
    return {
      ...base,
      attentionReason: "missing_validation",
      severity: "high",
      certainty: "explicit",
      evidenceCodes: ["completion_claim_without_validation"],
      nextStepStatus: "missing",
      nextStepPromptTemplateId: "run_validation"
    };
  }
  if (state.rawState !== "verified_done" && !has(state, "next_step_signal_seen")) {
    return {
      ...base,
      attentionReason: "missing_next_step",
      evidenceCodes: ["no_next_step_signal"],
      nextStepStatus: "missing",
      nextStepPromptTemplateId: "write_next_step"
    };
  }
  if (config.now.getTime() - new Date(state.lastActivityAt).getTime() > config.staleThresholdMs) {
    return {
      ...base,
      attentionReason: "stale",
      severity: "low",
      evidenceCodes: ["inactive_past_stale_threshold"],
      nextStepStatus: "unclear",
      nextStepPromptTemplateId: "review_stale_work"
    };
  }
  return {
    ...base,
    attentionReason: null,
    severity: "low",
    certainty: "explicit",
    evidenceCodes: ["validation_signal_present"],
    nextStepStatus: "not_required",
    nextStepPromptTemplateId: "no_prompt"
  };
}
```

- [ ] **Step 6: Run reducer/classifier tests**

Run: `npm test -- tests/server/reducer.test.ts tests/server/classifier.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/reducer.ts src/server/classifier.ts tests/server/reducer.test.ts tests/server/classifier.test.ts
git commit -m "feat: classify workstream attention states"
```

---

### Task 6: Derived Store, Snapshot Builder, and HTTP/SSE Server

**Files:**
- Create: `src/server/store.ts`
- Create: `src/server/http.ts`
- Modify: `src/server/main.ts`
- Test: `tests/server/store.test.ts`
- Test: `tests/server/http.test.ts`

**Interfaces:**
- Consumes reducer/classifier outputs.
- Produces `TodaySnapshot`.
- Provides token-protected `/api/snapshot`, `/api/workstreams/:id`, and `/api/stream`.

- [ ] **Step 1: Write store tests**

Create `tests/server/store.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeSnapshot } from "../../src/server/store";
import type { TodaySnapshot } from "../../src/shared/contracts";

describe("writeSnapshot", () => {
  it("writes sanitized derived state only", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-"));
    const path = join(dir, "state.json");
    const snapshot: TodaySnapshot = {
      mode: "demo",
      date: "2026-07-01",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-01T10:00:00.000+09:00",
      sourceStatus: { connected: true, parsedLineCount: 1, malformedLineCount: 0, partialLineCount: 0 },
      attention: [],
      workstreams: [],
      dailySummary: { unresolved: 0, verifiedDone: 0, carryOver: 0 }
    };
    writeSnapshot(path, snapshot);
    expect(readFileSync(path, "utf8")).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
  });
});
```

- [ ] **Step 2: Write HTTP tests**

Create `tests/server/http.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createLatchboardServer } from "../../src/server/http";
import type { TodaySnapshot } from "../../src/shared/contracts";

let closeServer: (() => Promise<void>) | null = null;

afterEach(async () => {
  if (closeServer) {
    await closeServer();
    closeServer = null;
  }
});

describe("createLatchboardServer", () => {
  it("requires token for snapshot API", async () => {
    const snapshot: TodaySnapshot = {
      mode: "demo",
      date: "2026-07-01",
      timezone: "Asia/Seoul",
      generatedAt: "2026-07-01T10:00:00.000+09:00",
      sourceStatus: { connected: true, parsedLineCount: 1, malformedLineCount: 0, partialLineCount: 0 },
      attention: [],
      workstreams: [],
      dailySummary: { unresolved: 0, verifiedDone: 0, carryOver: 0 }
    };
    const server = await createLatchboardServer({
      host: "127.0.0.1",
      port: 0,
      token: "test-token",
      getSnapshot: () => snapshot
    });
    closeServer = server.close;
    const denied = await fetch(`${server.url}/api/snapshot`);
    expect(denied.status).toBe(401);
    const allowed = await fetch(`${server.url}/api/snapshot`, { headers: { Authorization: "Bearer test-token" } });
    expect(allowed.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/server/store.test.ts tests/server/http.test.ts`

Expected: FAIL because store/http modules do not exist.

- [ ] **Step 4: Implement store**

Create `src/server/store.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Classification, SourceStatus, TodaySnapshot, WorkstreamState } from "../shared/contracts";

export function buildSnapshot(input: {
  mode: "demo" | "real";
  date: string;
  timezone: string;
  generatedAt: string;
  sourceStatus: SourceStatus;
  workstreams: WorkstreamState[];
  classifications: Classification[];
}): TodaySnapshot {
  const byId = new Map(input.classifications.map((item) => [item.workstreamId, item]));
  const workstreams = input.workstreams.map((state) => ({
    workstreamId: state.id,
    label: state.label,
    lastActivityAt: state.lastActivityAt,
    rawState: state.rawState,
    classification: byId.get(state.id) as Classification
  }));
  const attention = workstreams
    .filter((row) => row.classification.attentionReason !== null)
    .map((row) => ({
      workstreamId: row.workstreamId,
      label: row.label,
      lastActivityAt: row.lastActivityAt,
      classification: row.classification
    }));
  return {
    mode: input.mode,
    date: input.date,
    timezone: input.timezone,
    generatedAt: input.generatedAt,
    sourceStatus: input.sourceStatus,
    attention,
    workstreams,
    dailySummary: {
      unresolved: attention.length,
      verifiedDone: workstreams.filter((row) => row.rawState === "verified_done").length,
      carryOver: attention.filter((row) => row.classification.attentionReason === "stale").length
    }
  };
}

export function writeSnapshot(path: string, snapshot: TodaySnapshot): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot, null, 2));
}
```

- [ ] **Step 5: Implement HTTP/SSE server**

Create `src/server/http.ts`:

```ts
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { TodaySnapshot } from "../shared/contracts";

type ServerOptions = {
  host: "127.0.0.1";
  port: number;
  token: string;
  getSnapshot: () => TodaySnapshot;
};

function authorized(header: string | undefined, token: string): boolean {
  return header === `Bearer ${token}`;
}

export async function createLatchboardServer(options: ServerOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if (req.url === "/api/snapshot") {
      if (!authorized(req.headers.authorization, options.token)) {
        res.writeHead(401).end("Unauthorized");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(options.getSnapshot()));
      return;
    }
    if (req.url === "/api/stream") {
      if (!authorized(req.headers.authorization, options.token)) {
        res.writeHead(401).end("Unauthorized");
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache"
      });
      res.write("event: snapshot_updated\n");
      res.write("data: {}\n\n");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><html><body><div id=\"root\">Latchboard</div></body></html>");
  });
  await new Promise<void>((resolve) => server.listen(options.port, options.host, resolve));
  const address = server.address() as AddressInfo;
  return {
    url: `http://${options.host}:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}
```

- [ ] **Step 6: Update main entrypoint**

Replace `src/server/main.ts`:

```ts
import { classifyWorkstream } from "./classifier";
import { parseRuntimeConfig } from "./config";
import { readJsonlSince } from "./events-adapter";
import { createLatchboardServer } from "./http";
import { normalizeRecords } from "./normalizer";
import { reduceWorkstreams } from "./reducer";
import { buildSnapshot, writeSnapshot } from "./store";

const config = parseRuntimeConfig(process.argv.slice(2));
const read = readJsonlSince({ path: config.inputPath, offset: 0 });
const facts = normalizeRecords(read.records, config.mode === "demo" ? "demo" : "cmux_events");
const workstreams = reduceWorkstreams(facts);
const classifications = workstreams.map((state) =>
  classifyWorkstream(state, { now: config.now, staleThresholdMs: config.staleThresholdMs })
);
const snapshot = buildSnapshot({
  mode: config.mode,
  date: config.now.toISOString().slice(0, 10),
  timezone: config.timezone,
  generatedAt: config.now.toISOString(),
  sourceStatus: read.status,
  workstreams,
  classifications
});
writeSnapshot(config.statePath, snapshot);

const server = await createLatchboardServer({
  host: config.host,
  port: config.port,
  token: config.token,
  getSnapshot: () => snapshot
});

console.log(`Latchboard running at ${server.url}`);
console.log(`API token: ${config.token}`);
```

- [ ] **Step 7: Run server tests**

Run: `npm test -- tests/server/store.test.ts tests/server/http.test.ts`

Expected: PASS.

Run: `npm run demo`

Expected: stdout contains `Latchboard running at http://127.0.0.1:8787` and `API token:`.

- [ ] **Step 8: Commit**

```bash
git add src/server tests/server
git commit -m "feat: serve sanitized latchboard snapshot"
```

---

### Task 7: Dashboard UI and API Client

**Files:**
- Create: `src/ui/api.ts`
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/styles.css`
- Create: `src/ui/main.tsx`
- Test: `tests/ui/render.test.tsx`

**Interfaces:**
- Consumes `TodaySnapshot` DTO.
- Renders Today bar, Attention Queue, All Workstreams, Detail Drawer, and Daily strip.

- [ ] **Step 1: Add UI test dependency**

Update `package.json` devDependencies:

```json
"@testing-library/react": "^16.1.0",
"jsdom": "^25.0.1"
```

Update `vitest.config.ts` so UI tests use jsdom when filename contains `/ui/`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environmentMatchGlobs: [["tests/ui/**/*.test.tsx", "jsdom"]],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
```

- [ ] **Step 2: Write UI render test**

Create `tests/ui/render.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppView } from "../../src/ui/App";
import type { TodaySnapshot } from "../../src/shared/contracts";

const snapshot: TodaySnapshot = {
  mode: "demo",
  date: "2026-07-01",
  timezone: "Asia/Seoul",
  generatedAt: "2026-07-01T10:00:00.000+09:00",
  sourceStatus: { connected: true, parsedLineCount: 5, malformedLineCount: 0, partialLineCount: 0 },
  attention: [
    {
      workstreamId: "ws_1",
      label: "Workstream 1",
      lastActivityAt: "2026-07-01T09:00:00.000+09:00",
      classification: {
        workstreamId: "ws_1",
        attentionReason: "missing_validation",
        severity: "high",
        certainty: "explicit",
        evidenceCodes: ["completion_claim_without_validation"],
        nextStepStatus: "missing",
        nextStepPromptTemplateId: "run_validation",
        since: "2026-07-01T09:00:00.000+09:00"
      }
    }
  ],
  workstreams: [],
  dailySummary: { unresolved: 1, verifiedDone: 0, carryOver: 0 }
};

describe("AppView", () => {
  it("renders attention queue without raw text", () => {
    render(<AppView snapshot={snapshot} />);
    expect(screen.getByText("Latchboard")).toBeTruthy();
    expect(screen.getByText("Missing validation")).toBeTruthy();
    expect(screen.getByText("Run the planned validation and review the result.")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run UI test to verify it fails**

Run: `npm test -- tests/ui/render.test.tsx`

Expected: FAIL because `AppView` does not exist.

- [ ] **Step 4: Implement UI API client**

Create `src/ui/api.ts`:

```ts
import type { TodaySnapshot } from "../shared/contracts";

export async function fetchSnapshot(token: string): Promise<TodaySnapshot> {
  const response = await fetch("/api/snapshot", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(`snapshot failed: ${response.status}`);
  }
  return response.json() as Promise<TodaySnapshot>;
}
```

- [ ] **Step 5: Implement dashboard view**

Replace `src/ui/App.tsx`:

```tsx
import type { TodaySnapshot, AttentionReason } from "../shared/contracts";
import { evidenceLabel, nextStepPromptLabel } from "../shared/contracts";
import "./styles.css";

const reasonLabels: Record<AttentionReason, string> = {
  missing_validation: "Missing validation",
  missing_next_step: "Missing next step",
  blocked: "Blocked",
  stale: "Stale"
};

export function AppView({ snapshot }: { snapshot: TodaySnapshot }) {
  return (
    <main className="app">
      <header className="topbar">
        <strong>Latchboard</strong>
        <span>{snapshot.mode}</span>
        <span>{snapshot.date}</span>
        <span>Attention {snapshot.attention.length}</span>
      </header>
      <section className="queue">
        <h1>Attention Queue</h1>
        <div className="rows">
          {snapshot.attention.map((row) => (
            <article className={`row ${row.classification.attentionReason ?? "none"}`} key={row.workstreamId}>
              <span>{row.classification.attentionReason ? reasonLabels[row.classification.attentionReason] : "No attention"}</span>
              <span>{row.label}</span>
              <span>{row.classification.certainty}</span>
              <span>{row.classification.evidenceCodes.map(evidenceLabel).join(" ")}</span>
              <span>{nextStepPromptLabel(row.classification.nextStepPromptTemplateId)}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="matrix">
        <h2>All Workstreams</h2>
        <p>{snapshot.workstreams.length} workstreams observed</p>
      </section>
      <aside className="daily">
        <span>Unresolved {snapshot.dailySummary.unresolved}</span>
        <span>Verified {snapshot.dailySummary.verifiedDone}</span>
        <span>Carry-over {snapshot.dailySummary.carryOver}</span>
      </aside>
    </main>
  );
}

export function App() {
  return <main className="app">Loading Latchboard</main>;
}
```

Create `src/ui/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
```

- [ ] **Step 6: Implement dashboard styles**

Replace `src/ui/styles.css`:

```css
:root {
  color: #172026;
  background: #f6f7f9;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

.app {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 48px minmax(280px, 1fr) 140px 36px;
  gap: 12px;
  padding: 12px;
}

.topbar,
.daily,
.row,
.matrix {
  background: #ffffff;
  border: 1px solid #dde3ea;
  border-radius: 6px;
}

.topbar,
.daily {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 12px;
}

.queue h1,
.matrix h2 {
  font-size: 16px;
  margin: 0 0 8px;
}

.rows {
  display: grid;
  gap: 8px;
}

.row {
  min-height: 44px;
  display: grid;
  grid-template-columns: 160px 140px 90px 1fr 260px;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
}

.missing_validation {
  border-left: 4px solid #b7791f;
}

.missing_next_step {
  border-left: 4px solid #277da1;
}

.blocked {
  border-left: 4px solid #b91c1c;
}

.stale {
  border-left: 4px solid #6b7280;
}
```

- [ ] **Step 7: Run UI tests**

Run: `npm install`

Expected: PASS after new dependencies.

Run: `npm test -- tests/ui/render.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/ui tests/ui
git commit -m "feat: render latchboard dashboard"
```

---

### Task 8: Release Smoke, Privacy Canary, and Documentation

**Files:**
- Create: `tests/smoke/demo.spec.ts`
- Create: `tests/server/privacy-canary.test.ts`
- Create: `docs/privacy.md`
- Modify: `README.md`

**Interfaces:**
- Consumes complete v0 server/UI.
- Enforces release blockers.

- [ ] **Step 1: Write privacy canary test**

Create `tests/server/privacy-canary.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readJsonlSince } from "../../src/server/events-adapter";
import { normalizeRecords } from "../../src/server/normalizer";

describe("privacy canary", () => {
  it("does not leak forbidden strings past normalizer", () => {
    const canary = "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW";
    const result = readJsonlSince({ path: "fixtures/privacy-canary.jsonl", offset: 0 });
    const facts = normalizeRecords(result.records, "demo");
    expect(JSON.stringify(facts)).not.toContain(canary);
    expect(readFileSync("fixtures/privacy-canary.jsonl", "utf8")).toContain(canary);
  });
});
```

- [ ] **Step 2: Write Playwright smoke test**

Create `tests/smoke/demo.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("demo page renders latchboard shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText("Latchboard");
});
```

- [ ] **Step 3: Run tests to verify current gaps**

Run: `npm test -- tests/server/privacy-canary.test.ts`

Expected: PASS if Task 4 boundary is intact.

Run: `npm run test:smoke`

Expected: PASS once demo server serves the static UI shell.

- [ ] **Step 4: Add privacy documentation**

Create `docs/privacy.md`:

```md
# Privacy Model

Latchboard v0 is local, read-only, and metadata-only.

The Normalizer is the privacy boundary. Raw cmux lines, payloads, prompts,
terminal output, command text, full paths, repo names, branch names, customer
names, secret-looking strings, and extracted freeform text must not cross that
boundary.

Release is blocked if the privacy canary appears in sidecar state, REST, SSE,
DOM, or server logs.
```

- [ ] **Step 5: Update README run instructions**

Replace `README.md` with:

````md
# Latchboard

Local AI work completion gate.

Latchboard turns today's local cmux events into a read-only attention queue for
missing validation, missing next step, blocked work, and stale work.

## Status

v0 implementation is local-only, read-only, and metadata-only.

## Quick Start

```bash
npm install
npm run demo
```

Real cmux events mode:

```bash
npm run dev -- --input ~/.cmuxterm/events.jsonl
```

Run checks:

```bash
npm test
npm run typecheck
npm run test:smoke
```

## Privacy

Latchboard does not store or display raw prompts, raw terminal output, raw cmux
payloads, command text, full paths, repo names, branch names, or secret-looking
strings. See `docs/privacy.md`.

## Design Docs

- `docs/superpowers/specs/2026-07-01-latchboard-v0-design.md`
- `docs/superpowers/specs/2026-07-01-latchboard-planning-inbox-design.md`
- `docs/superpowers/plans/2026-07-01-latchboard-v0-implementation.md`
````

- [ ] **Step 6: Run full validation**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test:smoke`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md docs tests/smoke tests/server/privacy-canary.test.ts
git commit -m "test: add latchboard release smoke gates"
```

---

## Self-Review

Spec coverage:

- v0 local demo mode: Tasks 1, 2, 6, 8.
- `events.jsonl` adapter: Task 3.
- Normalizer privacy boundary: Tasks 4 and 8.
- Workstream reducer/classifier: Task 5.
- REST/SSE server: Task 6.
- UI regions: Task 7.
- Fixtures and release blockers: Tasks 2 and 8.
- Planning Inbox exclusion: Global Constraints; no implementation tasks include it.

Placeholder scan:

- Every task uses concrete paths and includes its required tests.
- v0.2 Planning Inbox is deliberately excluded from this implementation plan.

Type consistency:

- `SafeFact`, `WorkstreamState`, `Classification`, `TodaySnapshot`, `AttentionRow`, `SourceStatus`, and `WorkstreamSummary` are defined in Task 2 and reused by later tasks.
- `nextStepPromptTemplateId` remains enum-only throughout.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-01-latchboard-v0-implementation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.
