import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/ui/**/*.test.tsx", "jsdom"]],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
