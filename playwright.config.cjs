const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests/smoke",
  use: {
    baseURL: "http://127.0.0.1:8787"
  },
  webServer: {
    command: "npm run demo",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: false,
    timeout: 30_000
  }
});
