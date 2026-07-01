import { describe, expect, it } from "vitest";
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

async function withServer<T>(run: (url: string) => Promise<T>): Promise<T> {
  const server = await createLatchboardServer({
    host: "127.0.0.1",
    port: 0,
    token: "test-token",
    getSnapshot: snapshot
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
});
