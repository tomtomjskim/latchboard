import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TodaySnapshot } from "../../src/shared/contracts";
import { App, AppView } from "../../src/ui/App";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
      displayHints: ["needs_safe_label"],
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

const aliasedWorkspaceSnapshot: TodaySnapshot = {
  ...activityOnlySnapshot,
  workstreams: [
    {
      ...activityOnlySnapshot.workstreams[0],
      scopeAlias: { kind: "repo", label: "stock-auto" },
      activity: {
        state: "running_tool",
        summary: "Editing dashboard activity panel",
        plan: "Add active session inspector",
        lastTool: "Bash"
      }
    }
  ]
};

const emptyRealSnapshot: TodaySnapshot = {
  ...activityOnlySnapshot,
  sourceStatus: {
    connected: true,
    parsedLineCount: 0,
    malformedLineCount: 0,
    partialLineCount: 0
  },
  attention: [],
  workstreams: [],
  dailySummary: { unresolved: 0, verifiedDone: 0, carryOver: 0 }
};

const sourceIssueSnapshot: TodaySnapshot = {
  ...activityOnlySnapshot,
  sourceStatus: {
    ...activityOnlySnapshot.sourceStatus,
    malformedLineCount: 2,
    partialLineCount: 1
  }
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

const groupedScopeSnapshot: TodaySnapshot = {
  ...activityOnlySnapshot,
  workstreams: [
    ...linkedScopeSnapshot.workstreams,
    {
      workstreamId: "ws_cmux_events_pane_cccccccc33333333",
      label: "pane cccccc",
      scopeKind: "pane",
      lastActivityAt: "2026-07-02T14:28:00.000+09:00",
      rawState: "running",
      lastSignalCode: "activity_seen",
      classification: {
        workstreamId: "ws_cmux_events_pane_cccccccc33333333",
        attentionReason: null,
        severity: "low",
        certainty: "explicit",
        evidenceCodes: [],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-02T14:28:00.000+09:00"
      }
    }
  ]
};

const filterableWorkstreamSnapshot: TodaySnapshot = {
  ...activityOnlySnapshot,
  workstreams: [
    {
      workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
      label: "Review stock automation",
      scopeKind: "workspace",
      scopeAlias: { kind: "repo", label: "stock-auto" },
      lastActivityAt: "2026-07-02T14:31:00.000+09:00",
      rawState: "running",
      lastSignalCode: "activity_seen",
      activity: {
        state: "running_tool",
        summary: "Editing dashboard activity panel",
        lastTool: "Bash"
      },
      classification: {
        workstreamId: "ws_cmux_events_workspace_aaaaaaaa11111111",
        attentionReason: null,
        severity: "low",
        certainty: "explicit",
        evidenceCodes: [],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-02T14:31:00.000+09:00"
      }
    },
    {
      workstreamId: "ws_cmux_events_workspace_bbbbbbbb22222222",
      label: "Review dashboard polish",
      scopeKind: "workspace",
      scopeAlias: { kind: "repo", label: "latchboard" },
      lastActivityAt: "2026-07-02T14:20:00.000+09:00",
      rawState: "unknown",
      lastSignalCode: "activity_seen",
      activity: {
        state: "idle",
        summary: "Reviewing idle scope",
        lastTool: "Read"
      },
      classification: {
        workstreamId: "ws_cmux_events_workspace_bbbbbbbb22222222",
        attentionReason: null,
        severity: "low",
        certainty: "weak",
        evidenceCodes: [],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-02T14:20:00.000+09:00"
      }
    },
    {
      workstreamId: "ws_cmux_events_workspace_cccccccc33333333",
      label: "workspace cccccc",
      scopeKind: "workspace",
      displayHints: ["needs_safe_label"],
      lastActivityAt: "2026-07-02T14:10:00.000+09:00",
      rawState: "running",
      lastSignalCode: "activity_seen",
      classification: {
        workstreamId: "ws_cmux_events_workspace_cccccccc33333333",
        attentionReason: null,
        severity: "low",
        certainty: "weak",
        evidenceCodes: [],
        nextStepStatus: "unclear",
        nextStepPromptTemplateId: "no_prompt",
        since: "2026-07-02T14:10:00.000+09:00"
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
    expect(screen.getByRole("heading", { name: "Workspace Groups" })).toBeTruthy();
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
    expect(screen.getAllByText("Disconnected").length).toBeGreaterThan(0);
    expect(screen.queryByText("Live local data")).toBeNull();
  });

  it("renders real activity-only workstreams without attention prompts", () => {
    render(<AppView snapshot={activityOnlySnapshot} />);

    expect(screen.getByText("Real")).toBeTruthy();
    expect(screen.getByText("Live local data")).toBeTruthy();
    expect(screen.getByText("Connected, no attention items")).toBeTruthy();
    expect(screen.getByText("1 observed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View workspace aaaaaa details" })).toBeTruthy();
    expect(screen.getAllByText("Needs label").length).toBeGreaterThan(0);
    expect(screen.getByText("Safe label missing")).toBeTruthy();
    expect(screen.getAllByText("workspace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("activity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clear").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No attention").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No next-step prompt is required.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Write the next step before continuing.")).toBeNull();
    expect(screen.queryByText("Run the planned validation and review the result.")).toBeNull();
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
  });

  it("copies the selected generated workstream id without rendering it as text", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<AppView snapshot={activityOnlySnapshot} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy ID" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("ws_cmux_events_workspace_aaaaaaaa11111111"));
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
  });

  it("opens a safe label modal and applies the returned snapshot", async () => {
    const updatedSnapshot: TodaySnapshot = {
      ...activityOnlySnapshot,
      workstreams: [
        {
          ...activityOnlySnapshot.workstreams[0],
          label: "Review validation queue",
          displayHints: undefined
        }
      ]
    };
    const onSnapshot = vi.fn();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ snapshot: updatedSnapshot }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<AppView snapshot={activityOnlySnapshot} token="test-token" onSnapshot={onSnapshot} />);

    fireEvent.click(screen.getByRole("button", { name: "Label" }));
    expect(screen.getByRole("dialog", { name: "Safe label" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Safe title"), { target: { value: "Review validation queue" } });
    fireEvent.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith(updatedSnapshot));
    expect(fetch).toHaveBeenCalledWith("/api/workstreams/ws_cmux_events_workspace_aaaaaaaa11111111/label", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ safeTitle: "Review validation queue" })
    });
    expect(screen.queryByRole("dialog", { name: "Safe label" })).toBeNull();
  });

  it("keeps the safe label modal open when registration fails", async () => {
    const fetch = vi.fn(async () => new Response("Bad Request", { status: 400 }));
    vi.stubGlobal("fetch", fetch);
    render(<AppView snapshot={activityOnlySnapshot} token="test-token" onSnapshot={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Label" }));
    fireEvent.change(screen.getByLabelText("Safe title"), { target: { value: "Fix customer Acme refund issue" } });
    fireEvent.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() => expect(screen.getByRole("dialog", { name: "Safe label" })).toBeTruthy());
    expect(screen.getByText("Label registration failed")).toBeTruthy();
  });

  it("closes the safe label modal with Escape without writing", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<AppView snapshot={activityOnlySnapshot} token="test-token" onSnapshot={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Label" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Safe label" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("renders source-aware empty states when no scopes are observed today", () => {
    render(<AppView snapshot={emptyRealSnapshot} />);

    expect(screen.getByText("Connected, no attention items")).toBeTruthy();
    expect(screen.getByText("No observed scopes for today")).toBeTruthy();
    expect(screen.getByText("0 observed")).toBeTruthy();
  });

  it("shows malformed and partial source line counts when present", () => {
    render(<AppView snapshot={sourceIssueSnapshot} />);

    expect(screen.getByText("Malformed 2")).toBeTruthy();
    expect(screen.getByText("Partial 1")).toBeTruthy();
  });

  it("renders safe cmux repo aliases without exposing workspace ids or paths", () => {
    render(<AppView snapshot={aliasedWorkspaceSnapshot} />);

    expect(screen.getAllByText("repo stock-auto").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "View workspace aaaaaa details" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
    expect(document.body.textContent).not.toContain("/workspace/projects/stock-auto");
  });

  it("renders active session inspector details from sanitized metadata", () => {
    render(<AppView snapshot={aliasedWorkspaceSnapshot} />);

    expect(screen.getAllByText("Editing dashboard activity panel").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Running tool").length).toBeGreaterThan(0);
    expect(screen.getByText("Add active session inspector")).toBeTruthy();
    expect(screen.getByText("Bash")).toBeTruthy();
    expect(document.body.textContent).not.toContain("toolInputJSON");
    expect(document.body.textContent).not.toContain("/workspace/projects/stock-auto");
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
  });

  it("surfaces row current work, last tool, and activity age for fast scanning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T14:50:00.000+09:00"));
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    const list = screen.getByRole("list", { name: "Workspace groups" });

    expect(list.textContent).toContain("Current Work Editing dashboard activity panel");
    expect(list.textContent).toContain("Tool Bash");
    expect(list.textContent).toContain("19m ago");
    expect(list.textContent).toContain("Idle Reviewing idle scope");
    expect(list.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
  });

  it("surfaces active work as a focused now strip", () => {
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    const activeNow = screen.getByLabelText("Active now");
    const search = screen.getByLabelText("Search workspace groups");
    expect(activeNow.textContent).toContain("Active now 2");
    expect(activeNow.textContent).toContain("Review stock automation");
    expect(activeNow.textContent).toContain("Editing dashboard activity panel");
    expect(activeNow.textContent).toContain("workspace cccccc");
    expect(activeNow.textContent).not.toContain("Review dashboard polish");

    fireEvent.change(search, { target: { value: "dashboard polish" } });
    expect(screen.getByText("1 of 3 observed")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Review dashboard polish" })).toBeTruthy();

    fireEvent.click(within(activeNow).getByRole("button", { name: "Focus active workspace cccccc" }));

    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "All 3" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "workspace cccccc" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_cccccccc33333333");
  });

  it("renders parent workspace hints for linked cmux session scopes", () => {
    render(<AppView snapshot={linkedScopeSnapshot} />);

    expect(screen.getByRole("button", { name: "View session bbbbbb details" })).toBeTruthy();
    expect(screen.getAllByText("Parent workspace aaaaaa").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
    expect(document.body.textContent).not.toContain("ws_cmux_events_session_bbbbbbbb22222222");
  });

  it("groups child scopes below their parent workspace and keeps ungrouped scopes separate", () => {
    render(<AppView snapshot={groupedScopeSnapshot} />);

    expect(screen.getByRole("heading", { name: "Workspace Groups" })).toBeTruthy();
    expect(screen.getByText("1 child scope")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View session bbbbbb details" })).toBeTruthy();
    expect(screen.getByText("Ungrouped Scopes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View pane cccccc details" })).toBeTruthy();
    expect(document.body.textContent).not.toContain("ws_cmux_events_workspace_aaaaaaaa11111111");
    expect(document.body.textContent).not.toContain("ws_cmux_events_session_bbbbbbbb22222222");
    expect(document.body.textContent).not.toContain("ws_cmux_events_pane_cccccccc33333333");
  });

  it("filters workspace groups by active, idle, and label needs", () => {
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    expect(screen.getByText("3 observed")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Workspace groups" });
    expect(list.textContent).toContain("Review stock automation");
    expect(list.textContent).toContain("Review dashboard polish");
    expect(list.textContent).toContain("workspace cccccc");

    fireEvent.click(screen.getByRole("button", { name: "Active 2" }));
    expect(screen.getByText("2 of 3 observed")).toBeTruthy();
    expect(list.textContent).toContain("Review stock automation");
    expect(list.textContent).not.toContain("Review dashboard polish");
    expect(list.textContent).toContain("workspace cccccc");

    fireEvent.click(screen.getByRole("button", { name: "Idle 1" }));
    expect(list.textContent).not.toContain("Review stock automation");
    expect(list.textContent).toContain("Review dashboard polish");
    expect(list.textContent).not.toContain("workspace cccccc");

    fireEvent.click(screen.getByRole("button", { name: "Needs label 1" }));
    expect(list.textContent).not.toContain("Review stock automation");
    expect(list.textContent).not.toContain("Review dashboard polish");
    expect(list.textContent).toContain("workspace cccccc");
  });

  it("counts raw running workstreams as active without activity metadata", async () => {
    render(<AppView snapshot={activityOnlySnapshot} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "workspace aaaaaa" })).toBeTruthy());
    const list = screen.getByRole("list", { name: "Workspace groups" });

    fireEvent.click(screen.getByRole("button", { name: "Active 1" }));

    expect(screen.getByText("1 observed")).toBeTruthy();
    expect(list.textContent).toContain("workspace aaaaaa");
    expect(screen.getByRole("heading", { name: "workspace aaaaaa" })).toBeTruthy();
  });

  it("clears the selected detail when a filter has no matching workspace groups", async () => {
    render(<AppView snapshot={activityOnlySnapshot} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "workspace aaaaaa" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Idle 0" }));

    expect(screen.getByText("0 of 1 observed")).toBeTruthy();
    expect(screen.getByText("No scopes match this view")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("No scope selected")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "workspace aaaaaa" })).toBeNull();
  });

  it("sorts workspace groups by safe repo alias when requested", () => {
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    const list = screen.getByRole("list", { name: "Workspace groups" });
    fireEvent.change(screen.getByLabelText("Sort workspace groups"), { target: { value: "repo" } });

    const latchboardIndex = list.textContent?.indexOf("Review dashboard polish") ?? -1;
    const stockIndex = list.textContent?.indexOf("Review stock automation") ?? -1;
    const unlabeledIndex = list.textContent?.indexOf("workspace cccccc") ?? -1;
    expect(latchboardIndex).toBeGreaterThanOrEqual(0);
    expect(stockIndex).toBeGreaterThan(latchboardIndex);
    expect(unlabeledIndex).toBeGreaterThan(stockIndex);
  });

  it("searches workspace groups by safe repo and activity text", () => {
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    const search = screen.getByLabelText("Search workspace groups");
    const list = screen.getByRole("list", { name: "Workspace groups" });

    fireEvent.change(search, { target: { value: "idle scope" } });
    expect(screen.getByText("1 of 3 observed")).toBeTruthy();
    expect(list.textContent).not.toContain("Review stock automation");
    expect(list.textContent).toContain("Review dashboard polish");
    expect(list.textContent).not.toContain("workspace cccccc");

    fireEvent.change(search, { target: { value: "stock-auto" } });
    expect(screen.getByText("1 of 3 observed")).toBeTruthy();
    expect(list.textContent).toContain("Review stock automation");
    expect(list.textContent).not.toContain("Review dashboard polish");
    expect(list.textContent).not.toContain("workspace cccccc");
  });

  it("filters workspace groups by safe repo alias quick buttons", () => {
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    const list = screen.getByRole("list", { name: "Workspace groups" });

    fireEvent.click(screen.getByRole("button", { name: "latchboard 1" }));
    expect(screen.getByText("1 of 3 observed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Active 0" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Idle 1" })).toBeTruthy();
    expect(list.textContent).not.toContain("Review stock automation");
    expect(list.textContent).toContain("Review dashboard polish");
    expect(list.textContent).not.toContain("workspace cccccc");

    fireEvent.click(screen.getByRole("button", { name: "All repos 3" }));
    expect(screen.getByText("3 observed")).toBeTruthy();
    expect(list.textContent).toContain("Review stock automation");
    expect(list.textContent).toContain("Review dashboard polish");
    expect(list.textContent).toContain("workspace cccccc");
  });

  it("applies saved quick views after search and repo filters narrow the board", () => {
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    const list = screen.getByRole("list", { name: "Workspace groups" });
    const quickViews = within(screen.getByLabelText("Saved quick views"));
    const search = screen.getByLabelText("Search workspace groups");
    const sort = screen.getByLabelText("Sort workspace groups") as HTMLSelectElement;

    fireEvent.change(search, { target: { value: "stock-auto" } });
    fireEvent.change(sort, { target: { value: "repo" } });
    fireEvent.click(screen.getByRole("button", { name: "stock-auto 1" }));
    expect(screen.getByText("1 of 3 observed")).toBeTruthy();
    expect(list.textContent).toContain("Review stock automation");
    expect(list.textContent).not.toContain("workspace cccccc");

    fireEvent.click(quickViews.getByRole("button", { name: "Needs labels 1" }));
    expect((search as HTMLInputElement).value).toBe("");
    expect(sort.value).toBe("activity");
    expect(screen.getByRole("button", { name: "All repos 3" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Needs label 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(quickViews.getByRole("button", { name: "Needs labels 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(list.textContent).not.toContain("Review stock automation");
    expect(list.textContent).not.toContain("Review dashboard polish");
    expect(list.textContent).toContain("workspace cccccc");

    fireEvent.click(quickViews.getByRole("button", { name: "Active work 2" }));
    expect(screen.getByRole("button", { name: "Active 2" }).getAttribute("aria-pressed")).toBe("true");
    expect(quickViews.getByRole("button", { name: "Active work 2" }).getAttribute("aria-pressed")).toBe("true");
    expect(list.textContent).toContain("Review stock automation");
    expect(list.textContent).not.toContain("Review dashboard polish");
    expect(list.textContent).toContain("workspace cccccc");
  });

  it("summarizes the current workspace view and resets every view control", () => {
    render(<AppView snapshot={filterableWorkstreamSnapshot} />);

    const viewSummary = screen.getByLabelText("Workspace view summary");
    const search = screen.getByLabelText("Search workspace groups");
    const sort = screen.getByLabelText("Sort workspace groups") as HTMLSelectElement;
    const list = screen.getByRole("list", { name: "Workspace groups" });

    expect(viewSummary.textContent).toContain("View All scopes");
    expect(viewSummary.textContent).toContain("3 observed");
    expect(viewSummary.textContent).toContain("Activity first");
    expect(viewSummary.textContent).toContain("All Repos");
    expect(screen.queryByRole("button", { name: "Reset view" })).toBeNull();

    fireEvent.change(search, { target: { value: "stock-auto" } });
    fireEvent.change(sort, { target: { value: "repo" } });
    fireEvent.click(screen.getByRole("button", { name: "stock-auto 1" }));

    expect(viewSummary.textContent).toContain("View All scopes");
    expect(viewSummary.textContent).toContain("1 of 3 observed");
    expect(viewSummary.textContent).toContain("Repo");
    expect(viewSummary.textContent).toContain("Repo stock-auto");
    expect(viewSummary.textContent).toContain("Search stock-auto");
    expect(list.textContent).toContain("Review stock automation");
    expect(list.textContent).not.toContain("workspace cccccc");

    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));

    expect((search as HTMLInputElement).value).toBe("");
    expect(sort.value).toBe("activity");
    expect(screen.getByRole("button", { name: "All 3" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "All repos 3" }).getAttribute("aria-pressed")).toBe("true");
    expect(viewSummary.textContent).toContain("View All scopes");
    expect(viewSummary.textContent).toContain("3 observed");
    expect(viewSummary.textContent).toContain("Activity first");
    expect(viewSummary.textContent).toContain("All Repos");
    expect(viewSummary.textContent).not.toContain("Search stock-auto");
    expect(screen.queryByRole("button", { name: "Reset view" })).toBeNull();
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

  it("renders a compact evidence trail with reason, code, and next-step prompt", () => {
    render(<AppView snapshot={snapshot} />);
    const detail = within(screen.getByLabelText("Scope detail"));

    expect(detail.getByRole("heading", { name: "Workstream 1" })).toBeTruthy();
    expect(detail.getByText("Evidence Trail")).toBeTruthy();
    expect(detail.getByText("Reason Missing validation")).toBeTruthy();
    expect(detail.getByText("Code completion_claim_without_validation")).toBeTruthy();
    expect(detail.getByText("Completion was claimed without a validation signal.")).toBeTruthy();
    expect(detail.getByText("Prompt Run the planned validation and review the result.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("ws_attention");
  });
});

describe("App", () => {
  it("fetches the snapshot with the bootstrap token", async () => {
    window.__LATCHBOARD_BOOTSTRAP__ = { token: "test-token" };
    const fetch = vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    render(<App />);

    expect(screen.getByLabelText("Loading dashboard skeleton")).toBeTruthy();
    expect(screen.queryByText("Loading Latchboard")).toBeNull();
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Snapshot unavailable")).toBeNull();
    expect(screen.getByRole("heading", { name: "Workspace Groups" })).toBeTruthy();
    expect(screen.getByText("Retrying")).toBeTruthy();
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
    const nextSnapshot: TodaySnapshot = {
      ...refreshedSnapshot,
      sourceStatus: {
        ...refreshedSnapshot.sourceStatus,
        parsedLineCount: 15
      },
      generatedAt: "2026-07-02T14:32:00.000+09:00"
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(activityOnlySnapshot), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(refreshedSnapshot), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(nextSnapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    render(<App pollMs={1000} />);

    await waitFor(() => expect(screen.getByText("12")).toBeTruthy());
    const initialPulse = screen.getByRole("status", { name: "Last snapshot update: Watching" });
    expect(initialPulse.textContent).toContain("Watching");

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(screen.getByText("13")).toBeTruthy();
    const firstPulse = screen.getByRole("status", { name: "Last snapshot update: Lines +1" });
    expect(firstPulse.textContent).toContain("Lines +1");
    const firstPulseKey = firstPulse.getAttribute("data-pulse-key");

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3), { timeout: 2500 });
    expect(screen.getByText("15")).toBeTruthy();
    const secondPulse = screen.getByRole("status", { name: "Last snapshot update: Lines +2" });
    expect(secondPulse.getAttribute("data-pulse-key")).not.toBe(firstPulseKey);
  });

  it("renders an error state when no bootstrap token is available", async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText("Snapshot unavailable")).toBeTruthy());
  });
});
