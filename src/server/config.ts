import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

export type RuntimeMode = "demo" | "real";

export type RuntimeConfig = {
  mode: RuntimeMode;
  inputPath: string;
  statePath: string;
  host: "127.0.0.1";
  port: number;
  token: string;
  timezone: string;
  staleThresholdMs: number;
  now: Date;
};

export function parseRuntimeConfig(argv: string[], deps: { now: Date } = { now: new Date() }): RuntimeConfig {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };

  const mode = (get("--mode") ?? "real") as RuntimeMode;
  if (mode !== "demo" && mode !== "real") {
    throw new Error(`unsupported mode: ${mode}`);
  }

  const input = get("--input");
  if (mode === "real" && !input) {
    throw new Error("real mode requires --input");
  }

  const inputPath = mode === "demo" ? resolve("fixtures/demo-attention-gate.jsonl") : resolve(input as string);

  return {
    mode,
    inputPath,
    statePath: resolve(get("--state") ?? ".latchboard/state.json"),
    host: "127.0.0.1",
    port: Number(get("--port") ?? "8787"),
    token: randomBytes(18).toString("base64url"),
    timezone: get("--timezone") ?? "Asia/Seoul",
    staleThresholdMs: Number(get("--stale-ms") ?? String(2 * 60 * 60 * 1000)),
    now: deps.now
  };
}
