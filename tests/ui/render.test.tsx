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
      scopeKind: "workstream",
      lastActivityAt: "2026-07-01T09:00:00.000+09:00",
      lastSignalCode: "completion_claim_seen",
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
      scopeKind: "workstream",
      lastActivityAt: "2026-07-01T09:00:00.000+09:00",
      rawState: "done_claimed",
      lastSignalCode: "completion_claim_seen",
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
      scopeKind: "workstream",
      lastActivityAt: "2026-07-01T09:30:00.000+09:00",
      rawState: "verified_done",
      lastSignalCode: "validation_signal_seen",
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
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      label: "workspace aaaaaa",
      scopeKind: "workspace",
      lastActivityAt: "2026-07-02T14:29:00.000+09:00",
      rawState: "running",
      lastSignalCode: "activity_seen",
      classification: {
        workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
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

const linkedScopeSnapshot: TodaySnapshot = {
  ...activityOnlySnapshot,
  workstreams: [
    {
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      label: "workspace aaaaaa",
      scopeKind: "workspace",
      lastActivityAt: "2026-07-02T14:29:00.000+09:00",
      rawState: "running",
      lastSignalCode: "activity_seen",
      classification: {
        workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
        attentionReason: null,
        severity: "low",
        certainty: "explicit",
        evidenceCodes: [],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-02T14:29:00.000+09:00"
      }
    },
    {
      workstreamId: "ws_cmux_events_session_bbbbbbbb22222222",
      label: "session bbbbbb",
      scopeKind: "session",
      parentScopeId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      parentLabel: "workspace aaaaaa",
      parentScopeKind: "workspace",
      lastActivityAt: "2026-07-02T14:30:00.000+09:00",
      rawState: "running",
      lastSignalCode: "tool_started",
      classification: {
        workstreamId: "ws_cmux_events_session_bbbbbbbb22222222",
        attentionReason: null,
        severity: "low",
        certainty: "explicit",
        evidenceCodes: [],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-02T14:30:00.000+09:00"
      }
    }
  ]
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete window.__LATCHBOARD_BOOTSTRAP__;
});

describe("AppView", () => {
  it("renders dashboard regions from sanitized snapshot data only", () => {
    render(<AppView snapshot={snapshot} />);

    expect(screen.getByText("Latchboard")).toBeTruthy();
    expect(screen.getByText("Demo fixture")).toBeTruthy();
    expect(screen.getByText("Not live data")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Attention Queue" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Observed Scopes" })).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "View workspace aaaaaa details" })).toBeTruthy();
    expect(screen.getAllByText("workspace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("activity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clear").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No attention").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No next-step prompt is required.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Write the next step before continuing.")).toBeNull();
    expect(screen.queryByText("Run the planned validation and review the result.")).toBeNull();
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
  });

  it("renders parent workspace hints for linked cmux session scopes", () => {
    render(<AppView snapshot={linkedScopeSnapshot} />);

    expect(screen.getByRole("button", { name: "View session bbbbbb details" })).toBeTruthy();
    expect(screen.getAllByText("Parent workspace aaaaaa").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
    expect(document.body.textContent).not.toContain("ws_cmux_events_session_bbbbbbbb22222222");
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
    expect(screen.getAllByText("validation").length).toBeGreaterThan(0);
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

  it("renders immediately from a bootstrap snapshot before the first network refresh", async () => {
    vi.useFakeTimers();
    window.__LATCHBOARD_BOOTSTRAP__ = { token: "test-token", snapshot: activityOnlySnapshot };
    const refreshedSnapshot: TodaySnapshot = {
      ...activityOnlySnapshot,
      sourceStatus: {
        ...activityOnlySnapshot.sourceStatus,
        parsedLineCount: 13
      }
    };
    const fetch = vi.fn(async () => new Response(JSON.stringify(refreshedSnapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    render(<App pollMs={1000} />);

    expect(screen.queryByText("Loading Latchboard")).toBeNull();
    expect(screen.getByText("Live local data")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps a bootstrap snapshot visible when the first refresh fails", async () => {
    vi.useFakeTimers();
    window.__LATCHBOARD_BOOTSTRAP__ = { token: "test-token", snapshot: activityOnlySnapshot };
    const fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetch);

    render(<App pollMs={1000} />);

    expect(screen.queryByText("Loading Latchboard")).toBeNull();
    expect(screen.getByText("Live local data")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Snapshot unavailable")).toBeNull();
    expect(screen.getByRole("heading", { name: "Observed Scopes" })).toBeTruthy();
  });

  it("refreshes the snapshot without a page reload", async () => {
    window.__LATCHBOARD_BOOTSTRAP__ = { token: "test-token" };
    const refreshedSnapshot: TodaySnapshot = {
      ...activityOnlySnapshot,
      sourceStatus: {
        ...activityOnlySnapshot.sourceStatus,
        parsedLineCount: 13
      },
      generatedAt: "2026-07-02T14:31:00.000+09:00"
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(activityOnlySnapshot), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(refreshedSnapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    render(<App pollMs={1000} />);

    await waitFor(() => expect(screen.getByText("12")).toBeTruthy());

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(screen.getByText("13")).toBeTruthy();
  });

  it("renders an error state when no bootstrap token is available", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Snapshot unavailable")).toBeTruthy());
  });
});
