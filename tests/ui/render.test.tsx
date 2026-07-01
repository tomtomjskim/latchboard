import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TodaySnapshot } from "../../src/shared/contracts";
import { App, AppView } from "../../src/ui/App";

const snapshot: TodaySnapshot = {
  mode: "demo",
  date: "2026-07-01",
  timezone: "Asia/Seoul",
  generatedAt: "2026-07-01T10:00:00.000+09:00",
  sourceStatus: {
    connected: true,
    parsedLineCount: 5,
    malformedLineCount: 0,
    partialLineCount: 0
  },
  attention: [
    {
      workstreamId: "ws_attention",
      label: "Workstream 1",
      lastActivityAt: "2026-07-01T09:00:00.000+09:00",
      classification: {
        workstreamId: "ws_attention",
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
  workstreams: [
    {
      workstreamId: "ws_attention",
      label: "Workstream 1",
      lastActivityAt: "2026-07-01T09:00:00.000+09:00",
      rawState: "done_claimed",
      classification: {
        workstreamId: "ws_attention",
        attentionReason: "missing_validation",
        severity: "high",
        certainty: "explicit",
        evidenceCodes: ["completion_claim_without_validation"],
        nextStepStatus: "missing",
        nextStepPromptTemplateId: "run_validation",
        since: "2026-07-01T09:00:00.000+09:00"
      }
    },
    {
      workstreamId: "ws_verified",
      label: "Workstream 2",
      lastActivityAt: "2026-07-01T09:30:00.000+09:00",
      rawState: "verified_done",
      classification: {
        workstreamId: "ws_verified",
        attentionReason: null,
        severity: "low",
        certainty: "explicit",
        evidenceCodes: ["validation_signal_present"],
        nextStepStatus: "not_required",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-01T09:30:00.000+09:00"
      }
    }
  ],
  dailySummary: { unresolved: 1, verifiedDone: 1, carryOver: 0 }
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete window.__LATCHBOARD_BOOTSTRAP__;
});

describe("AppView", () => {
  it("renders dashboard regions from sanitized snapshot data only", () => {
    render(<AppView snapshot={snapshot} />);

    expect(screen.getByText("Latchboard")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Attention Queue" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "All Workstreams" })).toBeTruthy();
    expect(screen.getByText("Daily Summary")).toBeTruthy();
    expect(screen.getAllByText("Missing validation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Run the planned validation and review the result.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completion was claimed without a validation signal.").length).toBeGreaterThan(0);

    const body = document.body.textContent ?? "";
    expect(body).not.toContain("repo");
    expect(body).not.toContain("branch");
    expect(body).not.toContain("prompt");
    expect(body).not.toContain("command");
    expect(body).not.toContain("output");
    expect(body).not.toContain("events.jsonl");
    expect(body).not.toContain("fixtures");
    expect(body).not.toContain("canary");
    expect(body).not.toContain("ws_attention");
  });

  it("opens a sanitized detail panel for a selected workstream", () => {
    render(<AppView snapshot={snapshot} />);

    fireEvent.click(screen.getAllByRole("button", { name: "View Workstream 1 details" })[0]);

    expect(screen.getByRole("heading", { name: "Workstream 1" })).toBeTruthy();
    expect(screen.getAllByText("State").length).toBeGreaterThan(0);
    expect(screen.getAllByText("done claimed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Next Step").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Run the planned validation and review the result.").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("ws_attention");
  });
});

describe("App", () => {
  it("fetches the snapshot with the bootstrap token", async () => {
    window.__LATCHBOARD_BOOTSTRAP__ = { token: "test-token" };
    const fetch = vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    render(<App />);

    expect(screen.getByText("Loading Latchboard")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Attention Queue" })).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith("/api/snapshot", {
      headers: { Authorization: "Bearer test-token" }
    });
  });

  it("renders an error state when no bootstrap token is available", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Snapshot unavailable")).toBeTruthy());
  });
});
