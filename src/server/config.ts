import { randomBytes } from "node:crypto";
import { basename, resolve } from "node:path";

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
  const parseIntegerFlag = (
    flag: string,
    fallback: number,
    isValid: (value: number) => boolean,
    message: string
  ): number => {
    const index = argv.indexOf(flag);
    if (index === -1) {
      return fallback;
    }

    const raw = argv[index + 1];
    if (raw === undefined || raw.startsWith("--")) {
      throw new Error(message);
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value) || !isValid(value)) {
      throw new Error(message);
    }
    return value;
  };

  const mode = (get("--mode") ?? "real") as RuntimeMode;
  if (mode !== "demo" && mode !== "real") {
    throw new Error(`unsupported mode: ${mode}`);
  }

  const input = get("--input");
  if (mode === "real" && !input) {
    throw new Error("real mode requires --input");
  }
  if (mode === "real" && basename(input as string) !== "events.jsonl") {
    throw new Error("real mode --input must be named events.jsonl");
  }

  const inputPath = mode === "demo" ? resolve("fixtures/demo-attention-gate.jsonl") : resolve(input as string);
  const port = parseIntegerFlag(
    "--port",
    8787,
    (value) => value >= 0 && value <= 65535,
    "--port must be an integer from 0 to 65535"
  );
  const staleThresholdMs = parseIntegerFlag(
    "--stale-ms",
    2 * 60 * 60 * 1000,
    (value) => value > 0,
    "--stale-ms must be a positive integer"
  );

  return {
    mode,
    inputPath,
    statePath: resolve(get("--state") ?? ".latchboard/state.json"),
    host: "127.0.0.1",
    port,
    token: randomBytes(18).toString("base64url"),
    timezone: get("--timezone") ?? "Asia/Seoul",
    staleThresholdMs,
    now: deps.now
  };
}
