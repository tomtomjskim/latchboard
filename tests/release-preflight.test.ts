import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const preflightScript = join(repoRoot, "scripts", "release-preflight.mjs");
const blockedAssignment = ["OPENAI_API_KEY", "=", "canary"].join("");

const tempRoots: string[] = [];

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function writeRepoFile(cwd: string, relativePath: string, body: string): void {
  const fullPath = join(cwd, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, body);
}

function createReleaseReadyRepo(): string {
  const cwd = mkdtempSync(join(tmpdir(), "latchboard-release-preflight-"));
  tempRoots.push(cwd);

  git(cwd, ["init"]);
  writeRepoFile(cwd, "package.json", JSON.stringify({ private: false }, null, 2));
  writeRepoFile(cwd, "LICENSE", "MIT\n");
  writeRepoFile(cwd, ".nvmrc", "22\n");
  writeRepoFile(cwd, "README.md", "# Test repo\n");
  writeRepoFile(cwd, "docs/privacy.md", "# Privacy\n");
  writeRepoFile(cwd, "docs/release-checklist.md", "# Release\n");
  writeRepoFile(cwd, "docs/dogfood-runbook.md", "# Dogfood\n");
  git(cwd, ["add", "."]);

  return cwd;
}

function runPreflight(cwd: string) {
  return spawnSync(process.execPath, [preflightScript], {
    cwd,
    encoding: "utf8"
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("release preflight", () => {
  it("ignores untracked files outside git and fails on tracked blocked tokens", () => {
    const cwd = createReleaseReadyRepo();
    writeFileSync(join(tmpdir(), "latchboard-preflight-canary.txt"), blockedAssignment);

    const untrackedResult = runPreflight(cwd);
    expect(untrackedResult.status).toBe(0);
    expect(untrackedResult.stdout).toContain("Release preflight passed");

    writeRepoFile(cwd, "docs/tracked-scratch.md", blockedAssignment);
    git(cwd, ["add", "docs/tracked-scratch.md"]);

    const trackedResult = runPreflight(cwd);
    expect(trackedResult.status).not.toBe(0);
    expect(`${trackedResult.stdout}${trackedResult.stderr}`).toContain("docs/tracked-scratch.md");
  });

  it("allows ordinary words that contain the short key prefix as a substring", () => {
    const cwd = createReleaseReadyRepo();
    writeRepoFile(cwd, "docs/task-note.md", "release task-6 notes\n");
    git(cwd, ["add", "docs/task-note.md"]);

    const result = runPreflight(cwd);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release preflight passed");
  });
});
