import { classifyWorkstreams } from "./classifier";
import { parseRuntimeConfig } from "./config";
import { readJsonlSince } from "./events-adapter";
import { createLatchboardServer } from "./http";
import { normalizeRecords } from "./normalizer";
import { reduceWorkstreams } from "./reducer";
import { buildSnapshot, writeSnapshot } from "./store";

const config = parseRuntimeConfig(process.argv.slice(2));
const sourceType = config.mode === "demo" ? "demo" : "cmux_events";
const read = readJsonlSince({ path: config.inputPath, offset: 0 });
const facts = normalizeRecords(read.records, sourceType);
const workstreams = reduceWorkstreams(facts);
const classifications = classifyWorkstreams(workstreams, {
  now: config.now,
  staleThresholdMs: config.staleThresholdMs
});
const snapshot = buildSnapshot({
  mode: config.mode,
  date: config.now.toISOString().slice(0, 10),
  timezone: config.timezone,
  generatedAt: config.now.toISOString(),
  sourceStatus: read.status,
  workstreams,
  classifications
});

writeSnapshot(config.statePath, snapshot);

const server = await createLatchboardServer({
  host: config.host,
  port: config.port,
  token: config.token,
  getSnapshot: () => snapshot
});

console.log(`Latchboard running at ${server.url}`);
console.log(`API token: ${config.token}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void server.close().finally(() => {
      process.exit(0);
    });
  });
}
