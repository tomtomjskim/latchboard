// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import React from "react";
import { classifyWorkstreams } from "../../src/server/classifier";
import { readJsonlSince } from "../../src/server/events-adapter";
import { createLatchboardServer } from "../../src/server/http";
import { normalizeRecords } from "../../src/server/normalizer";
import { reduceWorkstreams } from "../../src/server/reducer";
import { buildSnapshot, writeSnapshot } from "../../src/server/store";
import type { TodaySnapshot } from "../../src/shared/contracts";
import { AppView } from "../../src/ui/App";

const canaryStrings = [
  "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW",
  "raw prompt terminal output",
  "/Users/private/acme",
  "repo-name",
  "branch-name",
  "command-text",
  "sk-test-123456"
];

function expectNoCanary(surface: string, body: string): void {
  for (const canary of canaryStrings) {
    expect(body, `${surface} leaked ${canary}`).not.toContain(canary);
  }
}

function canarySnapshot(): TodaySnapshot {
  const read = readJsonlSince({ path: "fixtures/privacy-canary.jsonl", offset: 0 });
  const facts = normalizeRecords(read.records, "demo");
  const workstreams = reduceWorkstreams(facts);
  const classifications = classifyWorkstreams(workstreams, {
    now: new Date("2026-07-01T10:00:00.000+09:00"),
    staleThresholdMs: 2 * 60 * 60 * 1000
  });

  const snapshot = buildSnapshot({
    mode: "demo",
    date: "2026-07-01",
    timezone: "Asia/Seoul",
    generatedAt: "2026-07-01T01:00:00.000Z",
    sourceStatus: read.status,
    workstreams,
    classifications
  });

  expectNoCanary("normalized facts", JSON.stringify(facts));
  return snapshot;
}

async function readFirstStreamText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let body = "";

  try {
    while (!body.includes("event: heartbeat")) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      body += decoder.decode(next.value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    await reader.cancel();
  }
}

async function withServer<T>(
  snapshot: TodaySnapshot,
  run: (url: string) => Promise<T>,
  options: { staticRoot?: string } = {}
): Promise<T> {
  const server = await createLatchboardServer({
    host: "127.0.0.1",
    port: 0,
    token: "privacy-test-token",
    getSnapshot: () => snapshot,
    staticRoot: options.staticRoot
  });

  try {
    return await run(server.url);
  } finally {
    await server.close();
  }
}

afterEach(() => {
  cleanup();
});

describe("privacy canary release checks", () => {
  it("keeps raw canary strings out of normalized facts, snapshot sidecar, REST, and SSE", async () => {
    const snapshot = canarySnapshot();
    const sidecarDir = mkdtempSync(join(tmpdir(), "latchboard-privacy-"));
    const sidecarPath = join(sidecarDir, "state.json");

    writeSnapshot(sidecarPath, snapshot);

    expectNoCanary("snapshot object", JSON.stringify(snapshot));
    expectNoCanary("snapshot sidecar", readFileSync(sidecarPath, "utf8"));

    await withServer(snapshot, async (url) => {
      const headers = { Authorization: "Bearer privacy-test-token" };
      const rest = await fetch(`${url}/api/snapshot`, { headers });
      const stream = await fetch(`${url}/api/stream`, { headers });

      expect(rest.status).toBe(200);
      expect(stream.status).toBe(200);

      expectNoCanary("REST snapshot", await rest.text());
      expectNoCanary("SSE stream", await readFirstStreamText(stream));
    });
  });

  it("keeps raw canary strings out of fallback root, built root, and UI DOM", async () => {
    const snapshot = canarySnapshot();

    await withServer(snapshot, async (url) => {
      const root = await fetch(`${url}/`);

      expect(root.status).toBe(200);
      expectNoCanary("fallback root DOM", await root.text());
    });

    const staticRoot = mkdtempSync(join(tmpdir(), "latchboard-built-root-"));
    mkdirSync(join(staticRoot, "assets"), { recursive: true });
    writeFileSync(
      join(staticRoot, "index.html"),
      '<!doctype html><html><body><main id="root">Latchboard</main><script type="module" src="/assets/app.js"></script></body></html>'
    );
    writeFileSync(join(staticRoot, "assets", "app.js"), "window.__LATCHBOARD_BUILT_CANARY__='sanitized';");

    await withServer(
      snapshot,
      async (url) => {
        const builtRoot = await fetch(`${url}/`);
        const builtAsset = await fetch(`${url}/assets/app.js`);

        expect(builtRoot.status).toBe(200);
        expect(builtAsset.status).toBe(200);
        expectNoCanary("built root DOM", await builtRoot.text());
        expectNoCanary("built UI asset", await builtAsset.text());
      },
      { staticRoot }
    );

    render(React.createElement(AppView, { snapshot }));
    expectNoCanary("rendered UI DOM", document.body.textContent ?? "");
  });
});
