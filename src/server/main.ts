import { parseRuntimeConfig } from "./config";
import { createLatchboardServer } from "./http";
import { createSnapshotRuntime } from "./store";

const config = parseRuntimeConfig(process.argv.slice(2));
const sourceType = config.mode === "demo" ? "demo" : "cmux_events";
const runtime = createSnapshotRuntime({
  mode: config.mode,
  inputPath: config.inputPath,
  statePath: config.statePath,
  sourceType,
  timezone: config.timezone,
  staleThresholdMs: config.staleThresholdMs,
  now: () => new Date()
});
await runtime.pollOnce();
runtime.start();

const server = await createLatchboardServer({
  host: config.host,
  port: config.port,
  token: config.token,
  getSnapshot: runtime.getSnapshot,
  subscribeToSnapshots: runtime.subscribe
});

console.log(`Latchboard running at ${server.url}`);
console.log(`API token: ${config.token}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    runtime.stop();
    void server.close().finally(() => {
      process.exit(0);
    });
  });
}
