import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLatchboardServer } from "../../src/server/http";
import type { TodaySnapshot } from "../../src/shared/contracts";

function snapshot(): TodaySnapshot {
  return {
    mode: "demo",
    date: "2026-07-01",
    timezone: "Asia/Seoul",
    generatedAt: "2026-07-01T09:40:00.000Z",
    sourceStatus: {
      connected: true,
      parsedLineCount: 1,
      malformedLineCount: 0,
      partialLineCount: 0
    },
    attention: [
      {
        workstreamId: "ws_attention",
        label: "Workstream 1",
        lastActivityAt: "2026-07-01T09:30:00.000Z",
        lastSignalCode: "completion_claim_seen",
        classification: {
          workstreamId: "ws_attention",
          attentionReason: "missing_validation",
          severity: "high",
          certainty: "explicit",
          evidenceCodes: ["completion_claim_without_validation"],
          nextStepStatus: "unclear",
          nextStepPromptTemplateId: "run_validation",
          since: "2026-07-01T09:30:00.000Z"
        }
      }
    ],
    workstreams: [
      {
        workstreamId: "ws_attention",
        label: "Workstream 1",
        lastActivityAt: "2026-07-01T09:30:00.000Z",
        rawState: "done_claimed",
        lastSignalCode: "completion_claim_seen",
        classification: {
          workstreamId: "ws_attention",
          attentionReason: "missing_validation",
          severity: "high",
          certainty: "explicit",
          evidenceCodes: ["completion_claim_without_validation"],
          nextStepStatus: "unclear",
          nextStepPromptTemplateId: "run_validation",
          since: "2026-07-01T09:30:00.000Z"
        }
      }
    ],
    dailySummary: { unresolved: 1, verifiedDone: 0, carryOver: 0 }
  };
}

function updatedSnapshot(): TodaySnapshot {
  return {
    ...snapshot(),
    generatedAt: "2026-07-01T09:45:00.000Z",
    attention: [],
    workstreams: [
      {
        ...snapshot().workstreams[0],
        rawState: "verified_done",
        classification: {
          workstreamId: "ws_attention",
          attentionReason: null,
          severity: "low",
          certainty: "explicit",
          evidenceCodes: ["validation_signal_present"],
          nextStepStatus: "not_required",
          nextStepPromptTemplateId: "no_prompt",
          since: "2026-07-01T09:45:00.000Z"
        }
      }
    ],
    dailySummary: { unresolved: 0, verifiedDone: 1, carryOver: 0 }
  };
}

async function withServer<T>(run: (url: string) => Promise<T>, options: { staticRoot?: string } = {}): Promise<T> {
  const server = await createLatchboardServer({
    host: "127.0.0.1",
    port: 0,
    token: "test-token",
    getSnapshot: snapshot,
    staticRoot: options.staticRoot
  });

  try {
    return await run(server.url);
  } finally {
    await server.close();
  }
}

describe("createLatchboardServer", () => {
  it("serves minimal root HTML with Latchboard and bootstrap token", async () => {
    await withServer(async (url) => {
      const response = await fetch(`${url}/`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain("Latchboard");
      expect(body).toContain("test-token");
      expect(body).not.toContain("fixtures");
      expect(body).not.toContain("events.jsonl");
    });
  });

  it("requires bearer token for snapshot API", async () => {
    await withServer(async (url) => {
      const denied = await fetch(`${url}/api/snapshot`);
      const allowed = await fetch(`${url}/api/snapshot`, {
        headers: { Authorization: "Bearer test-token" }
      });

      expect(denied.status).toBe(401);
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toEqual(snapshot());
    });
  });

  it("returns a sanitized workstream detail by id", async () => {
    await withServer(async (url) => {
      const response = await fetch(`${url}/api/workstreams/ws_attention`, {
        headers: { Authorization: "Bearer test-token" }
      });
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(JSON.parse(body)).toEqual(snapshot().workstreams[0]);
      expect(body).not.toContain("facts");
      expect(body).not.toContain("repo");
      expect(body).not.toContain("prompt");
      expect(body).not.toContain("command");
      expect(body).not.toContain("output");
    });
  });

  it("returns bad request for malformed encoded workstream ids", async () => {
    await withServer(async (url) => {
      const response = await fetch(`${url}/api/workstreams/%E0%A4%A`, {
        headers: { Authorization: "Bearer test-token" }
      });

      expect(response.status).toBe(400);
    });
  });

  it("requires bearer token for SSE stream", async () => {
    await withServer(async (url) => {
      const denied = await fetch(`${url}/api/stream`);
      const allowed = await fetch(`${url}/api/stream`, {
        headers: { Authorization: "Bearer test-token" }
      });

      expect(denied.status).toBe(401);
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("content-type")).toContain("text/event-stream");
      await allowed.body?.cancel();
    });
  });

  it("emits snapshot_updated events to open SSE clients", async () => {
    let currentSnapshot = snapshot();
    const listeners = new Set<(snapshot: TodaySnapshot) => void>();
    const server = await createLatchboardServer({
      host: "127.0.0.1",
      port: 0,
      token: "test-token",
      getSnapshot: () => currentSnapshot,
      subscribeToSnapshots: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    });

    try {
      const stream = await fetch(`${server.url}/api/stream`, {
        headers: { Authorization: "Bearer test-token" }
      });
      expect(stream.status).toBe(200);
      const reader = stream.body?.getReader();
      expect(reader).toBeDefined();
      const decoder = new TextDecoder();
      let body = "";

      while (!body.includes("event: snapshot\n")) {
        const next = await reader!.read();
        expect(next.done).toBe(false);
        body += decoder.decode(next.value, { stream: true });
      }

      currentSnapshot = updatedSnapshot();
      for (const listener of listeners) {
        listener(currentSnapshot);
      }

      while (!body.includes("event: snapshot_updated\n")) {
        const next = await reader!.read();
        expect(next.done).toBe(false);
        body += decoder.decode(next.value, { stream: true });
      }

      expect(body).toContain('"verifiedDone":1');
      await reader?.cancel();
    } finally {
      await server.close();
    }
  });

  it("serves built assets and returns not found for missing asset paths", async () => {
    const staticRoot = mkdtempSync(join(tmpdir(), "latchboard-static-"));
    mkdirSync(join(staticRoot, "assets"), { recursive: true });
    writeFileSync(join(staticRoot, "assets", "app.js"), "console.log('latchboard');");

    await withServer(
      async (url) => {
        const asset = await fetch(`${url}/assets/app.js`);
        const missing = await fetch(`${url}/assets/missing.js`);
        const directory = await fetch(`${url}/assets/`);

        expect(asset.status).toBe(200);
        expect(asset.headers.get("content-type")).toContain("text/javascript");
        expect(await asset.text()).toContain("latchboard");
        expect(missing.status).toBe(404);
        expect(directory.status).toBe(404);
      },
      { staticRoot }
    );
  });
});
