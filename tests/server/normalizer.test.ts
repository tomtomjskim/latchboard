import { describe, expect, it } from "vitest";
import { normalizeRecords } from "../../src/server/normalizer";

describe("normalizeRecords", () => {
  it("maps demo signals into SafeFact records", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 1,
          value: {
            kind: "demo",
            scenario: "missing_validation",
            time: "2026-07-01T09:00:00.000+09:00",
            signals: ["session_started", "completion_claim_seen"]
          }
        }
      ],
      "demo"
    );

    expect(facts.map((fact) => fact.code)).toEqual(["session_started", "completion_claim_seen"]);
  });

  it("does not leak canary payload into normalized facts", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 1,
          value: {
            kind: "demo",
            scenario: "missing_validation",
            time: "2026-07-01T09:00:00.000+09:00",
            signals: ["session_started"],
            payload: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW /example/private/acme"
          }
        }
      ],
      "demo"
    );

    expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
    expect(JSON.stringify(facts)).not.toContain("/example/private/acme");
  });

  it("does not pass untrusted metadata strings through SafeFact fields", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 12,
          value: {
            kind: "terminal: LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW",
            scenario: "/example/private/acme",
            time: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW /example/private/acme",
            signals: ["prompt: /example/private/acme"]
          }
        }
      ],
      "demo"
    );

    expect(facts).toEqual([
      expect.objectContaining({
        occurredAt: "1970-01-01T00:00:00.000Z",
        code: "unknown_safe_event",
        sourceEventType: "unknown"
      })
    ]);
    expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
    expect(JSON.stringify(facts)).not.toContain("/example/private/acme");
  });

  it("does not derive workstream identity from raw scenario values", () => {
    const stableRecord = {
      lineNumber: 7,
      value: {
        kind: "demo",
        scenario: "missing_validation",
        time: "2026-07-01T09:00:00.000+09:00",
        signals: ["session_started"]
      }
    };
    const canaryRecord = {
      lineNumber: 7,
      value: {
        kind: "demo",
        scenario: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW /example/private/acme/customer-repo",
        time: "2026-07-01T09:00:00.000+09:00",
        signals: ["session_started"]
      }
    };

    const [stableFact] = normalizeRecords([stableRecord], "demo");
    const [canaryFact] = normalizeRecords([canaryRecord], "demo");

    expect(canaryFact.workstreamId).toBe(stableFact.workstreamId);
    expect(canaryFact.id).toBe(stableFact.id);
  });

  it("groups records by hashed allowlisted opaque session id", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 1,
          value: {
            kind: "demo",
            sessionId: "opaque-session-123",
            scenario: "first",
            time: "2026-07-01T09:00:00.000+09:00",
            signals: ["session_started"]
          }
        },
        {
          lineNumber: 2,
          value: {
            kind: "demo",
            sessionId: "opaque-session-123",
            scenario: "second",
            time: "2026-07-01T09:05:00.000+09:00",
            signals: ["completion_claim_seen"]
          }
        }
      ],
      "demo"
    );

    expect(facts).toHaveLength(2);
    expect(facts[0].workstreamId).toBe(facts[1].workstreamId);
    expect(facts[0].workstreamId).toMatch(/^ws_demo_[a-f0-9]{16}$/);
    expect(JSON.stringify(facts)).not.toContain("opaque-session-123");
    expect(JSON.stringify(facts)).not.toContain("first");
    expect(JSON.stringify(facts)).not.toContain("second");
  });

  it("maps cmux agent hook events into safe facts without leaking payload fields", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 101,
          value: {
            type: "event",
            name: "agent.hook.PreToolUse",
            occurred_at: "2026-07-02T05:10:00.000Z",
            workspace_id: "opaque-workspace-1",
            payload: {
              session_id: "opaque-session-1",
              cwd: "/example/private/acme",
              tool_name: "Bash",
              tool_input: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW"
            }
          }
        },
        {
          lineNumber: 102,
          value: {
            type: "event",
            name: "feed.item.completed",
            occurred_at: "2026-07-02T05:12:00.000Z",
            workspace_id: "opaque-workspace-1",
            payload: {
              session_id: "opaque-session-1",
              cwd: "/example/private/acme",
              result: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW"
            }
          }
        }
      ],
      "cmux_events"
    );

    expect(facts.map((fact) => fact.code)).toEqual(["tool_started", "tool_finished"]);
    expect(facts.map((fact) => fact.occurredAt)).toEqual([
      "2026-07-02T05:10:00.000Z",
      "2026-07-02T05:12:00.000Z"
    ]);
    expect(facts[0].workstreamId).toBe(facts[1].workstreamId);
    expect(facts[0].workstreamId).toMatch(/^ws_cmux_events_session_[a-f0-9]{16}$/);
    expect(facts[0].sourceEventType).toBe("tool");
    expect(facts[1].sourceEventType).toBe("tool");
    expect(JSON.stringify(facts)).not.toContain("opaque-session-1");
    expect(JSON.stringify(facts)).not.toContain("/example/private/acme");
    expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
  });

  it("groups neutral cmux UI events by workspace before window-like dimensions", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 181,
          value: {
            type: "event",
            name: "window.keyed",
            occurred_at: "2026-07-02T05:19:42.996Z",
            payload: {
              workspace_id: "opaque-workspace-1",
              window_id: "opaque-window-1"
            }
          }
        },
        {
          lineNumber: 182,
          value: {
            type: "event",
            name: "surface.focused",
            occurred_at: "2026-07-02T05:19:45.000Z",
            payload: {
              workspace_id: "opaque-workspace-1",
              surface_id: "opaque-surface-1"
            }
          }
        }
      ],
      "cmux_events"
    );

    expect(facts.map((fact) => fact.workstreamId)).toEqual([
      facts[0].workstreamId,
      facts[0].workstreamId
    ]);
    expect(facts[0].workstreamId).toMatch(/^ws_cmux_events_workspace_[a-f0-9]{16}$/);
    expect(JSON.stringify(facts)).not.toContain("opaque-workspace-1");
    expect(JSON.stringify(facts)).not.toContain("opaque-window-1");
    expect(JSON.stringify(facts)).not.toContain("opaque-surface-1");
  });

  it("treats cmux stop hooks as lifecycle activity, not completion claims", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 151,
          value: {
            type: "event",
            name: "agent.hook.Stop",
            occurred_at: "2026-07-02T05:12:00.000Z",
            workspace_id: "opaque-workspace-1",
            payload: {
              session_id: "opaque-session-1",
              result: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW"
            }
          }
        }
      ],
      "cmux_events"
    );

    expect(facts).toEqual([
      expect.objectContaining({
        code: "activity_seen",
        sourceEventType: "assistant"
      })
    ]);
    expect(JSON.stringify(facts)).not.toContain("opaque-session-1");
    expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
  });

  it("does not trust top-level signals from native cmux events", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 161,
          value: {
            type: "event",
            name: "window.keyed",
            occurred_at: "2026-07-02T05:19:42.996Z",
            signals: ["validation_signal_seen", "next_step_signal_seen"],
            payload: {
              workspace_id: "opaque-workspace-1"
            }
          }
        }
      ],
      "cmux_events"
    );

    expect(facts.map((fact) => fact.code)).toEqual(["activity_seen"]);
  });

  it("uses the first parseable timestamp candidate", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 171,
          value: {
            kind: "demo",
            sessionId: "opaque-session-171",
            time: "not-a-timestamp",
            occurred_at: "2026-07-02T05:19:42.996Z",
            signals: ["activity_seen"]
          }
        }
      ],
      "demo"
    );

    expect(facts[0].occurredAt).toBe("2026-07-02T05:19:42.996Z");
  });

  it.each([
    "window.keyed",
    "window.unkeyed",
    "surface.focused",
    "surface.selected",
    "pane.focused",
    "workspace.selected",
    "notification.created",
    "notification.read",
    "notification.removed"
  ])("maps neutral cmux activity %s into a safe non-actionable fact", (name) => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 201,
          value: {
            type: "event",
            name,
            occurred_at: "2026-07-02T05:19:42.996Z",
            workspace_id: "opaque-workspace-1",
            payload: {
              workspace_id: "opaque-workspace-1",
              window_id: "opaque-window-1",
              cwd: "/example/private/acme",
              message: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW"
            }
          }
        }
      ],
      "cmux_events"
    );

    expect(facts).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^fact_ws_cmux_events_workspace_[a-f0-9]{16}_201_0$/),
        sourceType: "cmux_events",
        occurredAt: "2026-07-02T05:19:42.996Z",
        workstreamId: expect.stringMatching(/^ws_cmux_events_workspace_[a-f0-9]{16}$/),
        code: "activity_seen",
        sourceEventType: "system"
      })
    ]);
    expect(JSON.stringify(facts)).not.toContain("opaque-workspace-1");
    expect(JSON.stringify(facts)).not.toContain("opaque-window-1");
    expect(JSON.stringify(facts)).not.toContain("/example/private/acme");
    expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
  });
});
