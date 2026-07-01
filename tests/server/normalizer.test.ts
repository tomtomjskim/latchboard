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
            payload: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW /Users/private/acme"
          }
        }
      ],
      "demo"
    );

    expect(JSON.stringify(facts)).not.toContain("LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW");
    expect(JSON.stringify(facts)).not.toContain("/Users/private/acme");
  });

  it("does not pass untrusted metadata strings through SafeFact fields", () => {
    const facts = normalizeRecords(
      [
        {
          lineNumber: 12,
          value: {
            kind: "terminal: LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW",
            scenario: "/Users/private/acme",
            time: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW /Users/private/acme",
            signals: ["prompt: /Users/private/acme"]
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
    expect(JSON.stringify(facts)).not.toContain("/Users/private/acme");
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
        scenario: "LATCHBOARD_SECRET_CANARY_DO_NOT_SHOW /Users/private/acme/customer-repo",
        time: "2026-07-01T09:00:00.000+09:00",
        signals: ["session_started"]
      }
    };

    const [stableFact] = normalizeRecords([stableRecord], "demo");
    const [canaryFact] = normalizeRecords([canaryRecord], "demo");

    expect(canaryFact.workstreamId).toBe(stableFact.workstreamId);
    expect(canaryFact.id).toBe(stableFact.id);
  });
});
