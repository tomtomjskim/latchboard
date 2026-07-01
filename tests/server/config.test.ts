import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "../../src/server/config";

describe("parseRuntimeConfig", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");

  it("defaults to loopback and a per-run token", () => {
    const config = parseRuntimeConfig(["--mode", "demo"], { now });

    expect(config.mode).toBe("demo");
    expect(config.host).toBe("127.0.0.1");
    expect(config.token.length).toBeGreaterThanOrEqual(24);
  });

  it("requires explicit input in real mode", () => {
    expect(() => parseRuntimeConfig(["--mode", "real"], { now })).toThrow("real mode requires --input");
  });

  it("requires real mode input to be named events.jsonl", () => {
    expect(() => parseRuntimeConfig(["--mode", "real", "--input", "/tmp/latchboard.jsonl"], { now })).toThrow(
      "real mode --input must be named events.jsonl"
    );
  });

  it("accepts integer port and stale threshold values", () => {
    const config = parseRuntimeConfig(
      ["--mode", "real", "--input", "/tmp/events.jsonl", "--port", "3000", "--stale-ms", "60000"],
      { now }
    );

    expect(config.port).toBe(3000);
    expect(config.staleThresholdMs).toBe(60000);
  });

  it.each(["NaN", "Infinity", "0", "-1", "3000.5", "65536"])("rejects invalid port %s", (port) => {
    expect(() => parseRuntimeConfig(["--mode", "demo", "--port", port], { now })).toThrow(
      "--port must be an integer from 1 to 65535"
    );
  });

  it.each(["NaN", "Infinity", "0", "-1", "60000.5"])("rejects invalid stale-ms %s", (staleMs) => {
    expect(() => parseRuntimeConfig(["--mode", "demo", "--stale-ms", staleMs], { now })).toThrow(
      "--stale-ms must be a positive integer"
    );
  });
});
