const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { expect, test } = require("@playwright/test");

function scrubServerLog(text) {
  return text.replace(/^API token: .+$/gm, "API token: [redacted]");
}

async function startRealServer({ eventsPath, statePath, workstreamPath }) {
  const child = spawn(
    "./node_modules/.bin/tsx",
    [
      "src/server/main.ts",
      "--mode",
      "real",
      "--input",
      eventsPath,
      "--workstream-input",
      workstreamPath,
      "--state",
      statePath,
      "--port",
      "0"
    ],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] }
  );
  let log = "";
  child.stdout.on("data", (chunk) => {
    log += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    log += chunk.toString();
  });

  const url = await Promise.race([
    new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const match = /Latchboard running at (http:\/\/127\.0\.0\.1:\d+)/.exec(log);
        if (match) {
          clearInterval(interval);
          resolve(match[1]);
        }
        if (child.exitCode !== null) {
          clearInterval(interval);
          reject(new Error(`real server exited early:\n${scrubServerLog(log)}`));
        }
      }, 100);
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`real server start timed out:\n${scrubServerLog(log)}`)), 10_000)
    )
  ]);

  return { child, url };
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);
}

test("real mode auto-labels workstreams from sanitized metadata title", async ({ page }) => {
  test.setTimeout(30_000);
  const dir = mkdtempSync(join(tmpdir(), "latchboard-real-autolabel-"));
  const eventsPath = join(dir, "events.jsonl");
  const workstreamPath = join(dir, "workstream.jsonl");
  const statePath = join(dir, "state.json");
  const rawWorkspaceId = "opaque-workspace-auto-label";
  let server;

  writeFileSync(
    eventsPath,
    `${JSON.stringify({
      type: "event",
      name: "workspace.selected",
      occurred_at: "2026-07-03T08:00:00.000Z",
      payload: {
        workspace_id: rawWorkspaceId
      }
    })}\n`
  );
  writeFileSync(
    workstreamPath,
    `${JSON.stringify({
      workstreamId: rawWorkspaceId,
      title: "Review validation queue",
      status: "running",
      kind: "workspace",
      cwd: "/workspace/projects/latchboard",
      updatedAt: "2026-07-03T08:01:00.000Z"
    })}\n`
  );

  try {
    server = await startRealServer({ eventsPath, statePath, workstreamPath });
    await page.goto(server.url);

    await expect(page.getByText("Latchboard").first()).toBeVisible();
    await expect(page.getByText("Real")).toBeVisible();
    await expect(page.getByText("Review validation queue").first()).toBeVisible();
    await expect(page.getByText("repo latchboard").first()).toBeVisible();
    await expect(page.getByText("Needs label")).toHaveCount(0);
    await expect(page.getByText("Safe label missing")).toHaveCount(0);

    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toContain(rawWorkspaceId);
    expect(visibleText).not.toContain("ws_cmux_events_");

    const snapshot = await page.evaluate(async () => {
      const token = window.__LATCHBOARD_BOOTSTRAP__.token;
      const response = await fetch("/api/snapshot", {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.json();
    });
    expect(snapshot.workstreams[0].label).toBe("Review validation queue");
    expect(snapshot.workstreams[0].displayHints).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain(rawWorkspaceId);
  } finally {
    if (server) {
      await stopServer(server.child);
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
