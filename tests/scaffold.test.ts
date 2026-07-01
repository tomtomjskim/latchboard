import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

async function waitForDemoUrl(demo: ReturnType<typeof spawn>) {
  let output = "";
  const deadline = Date.now() + 5_000;

  demo.stdout?.setEncoding("utf8");
  demo.stderr?.setEncoding("utf8");
  demo.stdout?.on("data", (chunk) => {
    output += chunk;
  });
  demo.stderr?.on("data", (chunk) => {
    output += chunk;
  });

  while (Date.now() < deadline) {
    const url = output.match(/Latchboard running at (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    const token = output.match(/API token: ([A-Za-z0-9_-]+)/)?.[1];
    if (url && token) {
      return { url, token };
    }

    if (demo.exitCode !== null) {
      throw new Error(`demo process exited before serving:\n${output}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`demo server did not print URL/token:\n${output}`);
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
    const dir = mkdtempSync(join(tmpdir(), "latchboard-scaffold-"));
    const demo = spawn("npm", ["run", "demo", "--", "--port", "0", "--state", join(dir, "state.json")], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    try {
      const { url } = await waitForDemoUrl(demo);
      const response = await waitForDemoServer(url);
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("Latchboard");
      expect(demo.exitCode).toBeNull();
    } finally {
      demo.kill();
    }
  }, 7_000);
});
