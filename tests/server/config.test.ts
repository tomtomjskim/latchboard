import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "../../src/server/config";

describe("parseRuntimeConfig", () => {
  it("defaults to loopback and a per-run token", () => {
    const config = parseRuntimeConfig(["--mode", "demo"], { now: new Date("2026-07-01T00:00:00.000Z") });

    expect(config.mode).toBe("demo");
    expect(config.host).toBe("127.0.0.1");
    expect(config.token.length).toBeGreaterThanOrEqual(24);
  });

  it("requires explicit input in real mode", () => {
    expect(() => parseRuntimeConfig(["--mode", "real"], { now: new Date("2026-07-01T00:00:00.000Z") })).toThrow(
      "real mode requires --input"
    );
  });
});
