import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { get } from "node:http";

async function waitForDemoServer(url: string) {
  const deadline = Date.now() + 3_000;

  while (Date.now() < deadline) {
    try {
      return await requestDemoServer(url);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`demo server did not respond at ${url}`);
}

async function requestDemoServer(url: string) {
  return new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ statusCode: response.statusCode ?? 0, body });
      });
    }).on("error", reject);
  });
}

describe("project scaffold", () => {
  it("defines required npm scripts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.demo).toBe("tsx src/server/main.ts --mode demo");
    expect(pkg.scripts.dev).toBe("tsx src/server/main.ts");
    expect(pkg.scripts.test).toBe("vitest run");
    expect(pkg.scripts["test:smoke"]).toBe("playwright test");
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
  });

  it("keeps the demo command serving loopback HTTP", async () => {
    const demo = spawn("npm", ["run", "demo"], {
      env: {
        ...process.env,
        LATCHBOARD_PORT: "18787"
      },
      stdio: "ignore"
    });

    try {
      const response = await waitForDemoServer("http://127.0.0.1:18787");
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("Latchboard");
      expect(demo.exitCode).toBeNull();
    } finally {
      demo.kill();
    }
  }, 7_000);
});
