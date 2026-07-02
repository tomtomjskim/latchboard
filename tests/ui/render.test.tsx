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

const activityOnlySnapshot: TodaySnapshot = {
  mode: "real",
  date: "2026-07-02",
  timezone: "Asia/Seoul",
  generatedAt: "2026-07-02T14:30:00.000+09:00",
  sourceStatus: {
    connected: true,
    parsedLineCount: 12,
    malformedLineCount: 0,
    partialLineCount: 0
  },
  attention: [],
  workstreams: [
    {
      workstreamId: "ws_activity",
      label: "Workstream 1",
      lastActivityAt: "2026-07-02T14:29:00.000+09:00",
      rawState: "running",
      classification: {
        workstreamId: "ws_activity",
        attentionReason: null,
        severity: "low",
        certainty: "explicit",
        evidenceCodes: [],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-02T14:29:00.000+09:00"
      }
    }
  ],
  dailySummary: { unresolved: 0, verifiedDone: 0, carryOver: 0 }
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
    expect(screen.getByText("Demo fixture")).toBeTruthy();
    expect(screen.getByText("Not live data")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Attention Queue" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "All Workstreams" })).toBeTruthy();
    expect(screen.getByText("Daily Summary")).toBeTruthy();
    expect(screen.getByText("B Missing next step · D Missing validation · Blocked · Stale")).toBeTruthy();
    expect(screen.getAllByText("Missing validation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Run the planned validation and review the result.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completion was claimed without a validation signal.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).toBeNull();

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

  it("labels real snapshots as live local data", () => {
    render(<AppView snapshot={{ ...snapshot, mode: "real", date: "2026-07-02" }} />);

    expect(screen.getByText("Real")).toBeTruthy();
    expect(screen.getByText("Live local data")).toBeTruthy();
    expect(screen.queryByText("Demo fixture")).toBeNull();
    expect(screen.queryByText("Not live data")).toBeNull();
  });

  it("does not label disconnected real snapshots as live", () => {
    render(
      <AppView
        snapshot={{
          ...activityOnlySnapshot,
          sourceStatus: { ...activityOnlySnapshot.sourceStatus, connected: false }
        }}
      />
    );

    expect(screen.getByText("Real")).toBeTruthy();
    expect(screen.getByText("Source disconnected")).toBeTruthy();
    expect(screen.getByText("Disconnected")).toBeTruthy();
    expect(screen.queryByText("Live local data")).toBeNull();
  });

  it("renders real activity-only workstreams without attention prompts", () => {
    render(<AppView snapshot={activityOnlySnapshot} />);

    expect(screen.getByText("Real")).toBeTruthy();
    expect(screen.getByText("Live local data")).toBeTruthy();
    expect(screen.getByText("No attention items")).toBeTruthy();
    expect(screen.getByText("1 observed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Workstream 1 details" })).toBeTruthy();
    expect(screen.getAllByText("Clear").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No attention").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No next-step prompt is required.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Write the next step before continuing.")).toBeNull();
    expect(screen.queryByText("Run the planned validation and review the result.")).toBeNull();
    expect(document.body.textContent).not.toContain("ws_activity");
  });

  it("opens a sanitized detail panel for a selected workstream", () => {
    render(<AppView snapshot={snapshot} />);

    const verifiedButton = screen.getByRole("button", { name: "View Workstream 2 details" });
    expect(verifiedButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(verifiedButton);

    expect(verifiedButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Workstream 2" })).toBeTruthy();
    expect(screen.getAllByText("State").length).toBeGreaterThan(0);
    expect(screen.getAllByText("verified done").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Next Step").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No next-step prompt is required.").length).toBeGreaterThan(0);
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
