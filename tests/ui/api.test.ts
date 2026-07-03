import { afterEach, describe, expect, it, vi } from "vitest";
import type { TodaySnapshot } from "../../src/shared/contracts";
import { registerSafeLabel } from "../../src/ui/api";

const snapshot: TodaySnapshot = {
  mode: "real",
  date: "2026-07-03",
  timezone: "Asia/Seoul",
  generatedAt: "2026-07-03T06:00:00.000Z",
  sourceStatus: {
    connected: true,
    parsedLineCount: 1,
    malformedLineCount: 0,
    partialLineCount: 0
  },
  attention: [],
  workstreams: [],
  dailySummary: { unresolved: 0, verifiedDone: 0, carryOver: 0 }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerSafeLabel", () => {
  it("posts safeTitle to the generated workstream label endpoint and returns the snapshot", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ snapshot }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(registerSafeLabel("test-token", "ws_cmux_events_workspace_aaaaaaaa11111111", "Review validation queue")).resolves.toEqual(
      snapshot
    );
    expect(fetch).toHaveBeenCalledWith("/api/workstreams/ws_cmux_events_workspace_aaaaaaaa11111111/label", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ safeTitle: "Review validation queue" })
    });
  });

  it("throws when the label endpoint rejects the request", async () => {
    const fetch = vi.fn(async () => new Response("Bad Request", { status: 400 }));
    vi.stubGlobal("fetch", fetch);

    await expect(registerSafeLabel("test-token", "ws_attention", "Fix customer Acme refund issue")).rejects.toThrow(
      "label registration failed with status 400"
    );
  });
});
