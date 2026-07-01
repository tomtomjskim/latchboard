import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("project scaffold", () => {
  it("defines required npm scripts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.demo).toBe("tsx src/server/main.ts --mode demo");
    expect(pkg.scripts.dev).toBe("tsx src/server/main.ts");
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts["test:smoke"]).toBe("playwright test");
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
  });
});
