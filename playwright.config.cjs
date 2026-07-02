const { defineConfig } = require("@playwright/test");

const smokePort = Number.parseInt(process.env.LATCHBOARD_SMOKE_PORT || "8787", 10);
if (!Number.isInteger(smokePort) || smokePort < 1 || smokePort > 65535) {
  throw new Error("LATCHBOARD_SMOKE_PORT must be an integer from 1 to 65535");
}

const smokeBaseURL = `http://127.0.0.1:${smokePort}`;

module.exports = defineConfig({
  testDir: "tests/smoke",
  use: {
    baseURL: smokeBaseURL
  },
  webServer: {
    command: `npm run build && npm run demo -- --port ${smokePort}`,
    url: smokeBaseURL,
    reuseExistingServer: false,
    timeout: 30_000
  }
});
