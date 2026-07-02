import { describe, expect, it } from "vitest";
import { reduceWorkstreams } from "../../src/server/reducer";
import type { SafeFact, SafeFactCode } from "../../src/shared/contracts";

function fact(
  id: string,
  workstreamId: string,
  occurredAt: string,
  code: SafeFactCode,
  sourceType: SafeFact["sourceType"] = "demo"
): SafeFact {
  return {
    id,
    sourceType,
    occurredAt,
    workstreamId,
    code,
    sourceEventType: "assistant"
  };
}

describe("reduceWorkstreams", () => {
  it("groups and sorts safe facts into generic workstream labels", () => {
    const workstreams = reduceWorkstreams([
      fact("fact_b2", "ws_b", "2026-07-01T09:03:00.000Z", "next_step_signal_seen"),
      fact("fact_a2", "ws_a", "2026-07-01T09:01:00.000Z", "completion_claim_seen"),
      fact("fact_a1", "ws_a", "2026-07-01T09:00:00.000Z", "session_started"),
      fact("fact_b1", "ws_b", "2026-07-01T09:02:00.000Z", "tool_started")
    ]);

    expect(workstreams.map((workstream) => workstream.id)).toEqual(["ws_a", "ws_b"]);
    expect(workstreams.map((workstream) => workstream.label)).toEqual(["Workstream 1", "Workstream 2"]);
    const workstreamA = workstreams.find((workstream) => workstream.id === "ws_a");
    expect(workstreamA?.facts.map((item) => item.id)).toEqual(["fact_a1", "fact_a2"]);
    expect(workstreamA).toMatchObject({
      createdAt: "2026-07-01T09:00:00.000Z",
      updatedAt: "2026-07-01T09:01:00.000Z",
      lastActivityAt: "2026-07-01T09:01:00.000Z",
      rawState: "done_claimed"
    });
  });

  it("sorts cmux workstreams by latest activity and uses stable safe labels", () => {
    const workstreams = reduceWorkstreams([
      fact(
        "fact_old",
        "ws_cmux_events_aaaaaaaa11111111",
        "2026-07-02T05:00:00.000Z",
        "activity_seen",
        "cmux_events"
      ),
      fact(
        "fact_new",
        "ws_cmux_events_bbbbbbbb22222222",
        "2026-07-02T05:10:00.000Z",
        "tool_started",
        "cmux_events"
      )
    ]);

    expect(workstreams.map((workstream) => workstream.id)).toEqual([
      "ws_cmux_events_bbbbbbbb22222222",
      "ws_cmux_events_aaaaaaaa11111111"
    ]);
    expect(workstreams.map((workstream) => workstream.label)).toEqual(["cmux bbbbbb", "cmux aaaaaa"]);
  });

  it("marks verified done only when validation occurs with or after completion", () => {
    const workstreams = reduceWorkstreams([
      fact("fact_verified_b", "ws_verified", "2026-07-01T09:00:00.000Z", "completion_claim_seen"),
      fact("fact_verified_a", "ws_verified", "2026-07-01T09:00:00.000Z", "validation_signal_seen"),
      fact("fact_unverified_1", "ws_unverified", "2026-07-01T10:00:00.000Z", "validation_signal_seen"),
      fact("fact_unverified_2", "ws_unverified", "2026-07-01T10:01:00.000Z", "completion_claim_seen")
    ]);
    const verified = workstreams.find((workstream) => workstream.id === "ws_verified");
    const unverified = workstreams.find((workstream) => workstream.id === "ws_unverified");

    expect(verified?.rawState).toBe("verified_done");
    expect(unverified?.rawState).toBe("done_claimed");
  });

  it("keeps a later completion claim unverified until another validation occurs", () => {
    const [workstream] = reduceWorkstreams([
      fact("fact_1", "ws_reclaimed", "2026-07-01T09:00:00.000Z", "completion_claim_seen"),
      fact("fact_2", "ws_reclaimed", "2026-07-01T09:05:00.000Z", "validation_signal_seen"),
      fact("fact_3", "ws_reclaimed", "2026-07-01T09:10:00.000Z", "completion_claim_seen")
    ]);

    expect(workstream.rawState).toBe("done_claimed");
  });

  it("uses id tie-break ordering for same-timestamp facts", () => {
    const [workstream] = reduceWorkstreams([
      fact("fact_b", "ws_tie", "2026-07-01T09:00:00.000Z", "completion_claim_seen"),
      fact("fact_a", "ws_tie", "2026-07-01T09:00:00.000Z", "validation_signal_seen")
    ]);

    expect(workstream.facts.map((item) => item.id)).toEqual(["fact_a", "fact_b"]);
    expect(workstream.rawState).toBe("verified_done");
  });

  it("marks waiting when next-step signal exists without verified completion", () => {
    const [workstream] = reduceWorkstreams([
      fact("fact_1", "ws_waiting", "2026-07-01T09:00:00.000Z", "tool_finished"),
      fact("fact_2", "ws_waiting", "2026-07-01T09:01:00.000Z", "next_step_signal_seen")
    ]);

    expect(workstream.rawState).toBe("waiting");
  });
});
