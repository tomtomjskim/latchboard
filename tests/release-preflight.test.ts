import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..");
const preflightScript = join(repoRoot, "scripts", "release-preflight.mjs");
const blockedAssignment = ["OPENAI_API_KEY", "=", "canary"].join("");
const blockedPatternMessage = ["Blocked pattern OPENAI_API_KEY", "= found in package-lock.json"].join("");
const macHomePath = ["/", "Users", "/private/acme"].join("");
const linuxHomePath = ["/", "home", "/private/acme"].join("");
const windowsHomePath = ["C:", "\\", "Users", "\\private\\acme"].join("");
const privateOperatorAliases = [
  ["T", "om"].join(""),
  ["T", "O", "M"].join("")
];

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
  writeRepoFile(
    cwd,
    "package.json",
    JSON.stringify(
      {
        name: "latchboard",
        version: "0.1.0",
        private: false,
        license: "MIT",
        engines: { node: ">=18.12 <23" },
        files: [
          ".nvmrc",
          "CONTRIBUTING.md",
          "SECURITY.md",
          "docs/dogfood-runbook.md",
          "docs/input-format.md",
          "docs/privacy.md",
          "docs/release-checklist.md",
          "docs/troubleshooting.md",
          "README.md"
        ]
      },
      null,
      2
    )
  );
  writeRepoFile(
    cwd,
    "package-lock.json",
    JSON.stringify(
      {
        name: "latchboard",
        version: "0.1.0",
        lockfileVersion: 2,
        requires: true,
        packages: {
          "": {
            name: "latchboard",
            version: "0.1.0",
            license: "MIT"
          }
        }
      },
      null,
      2
    )
  );
  writeRepoFile(cwd, "LICENSE", "MIT\n");
  writeRepoFile(cwd, ".nvmrc", "22\n");
  writeRepoFile(cwd, "README.md", "# Test repo\n");
  writeRepoFile(cwd, "docs/privacy.md", "# Privacy\n");
  writeRepoFile(cwd, "docs/input-format.md", "# Input format\n");
  writeRepoFile(cwd, "docs/troubleshooting.md", "# Troubleshooting\n");
  writeRepoFile(cwd, "docs/release-checklist.md", "# Release\n");
  writeRepoFile(cwd, "docs/dogfood-runbook.md", "# Dogfood\n");
  writeRepoFile(cwd, "SECURITY.md", "# Security\n");
  writeRepoFile(cwd, "CONTRIBUTING.md", "# Contributing\n");
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
    writeRepoFile(cwd, "docs/release-note.md", ["release ta", "sk", "-6 notes\n"].join(""));
    git(cwd, ["add", "docs/release-note.md"]);

    const result = runPreflight(cwd);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release preflight passed");
  });

  it("fails when required release files are not tracked", () => {
    const cwd = createReleaseReadyRepo();
    git(cwd, ["rm", "--cached", "SECURITY.md"]);

    const result = runPreflight(cwd);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Missing required file: SECURITY.md");
  });

  it('fails when package.json sets "private": true', () => {
    const cwd = createReleaseReadyRepo();
    const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    packageJson.private = true;
    writeRepoFile(cwd, "package.json", JSON.stringify(packageJson, null, 2));
    git(cwd, ["add", "package.json"]);

    const result = runPreflight(cwd);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('package.json must set "private": false');
  });

  it("fails when required package metadata is missing", () => {
    const cwd = createReleaseReadyRepo();
    const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    packageJson.license = "UNLICENSED";
    packageJson.engines.node = ">=20";
    delete packageJson.files;
    writeRepoFile(cwd, "package.json", JSON.stringify(packageJson, null, 2));
    git(cwd, ["add", "package.json"]);

    const result = runPreflight(cwd);
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).not.toBe(0);
    expect(output).toContain('package.json must set "license": "MIT"');
    expect(output).toContain('package.json must set "engines.node": ">=18.12 <23"');
    expect(output).toContain("package.json must define a package files allowlist");
  });

  it("scans synthetic canary paths instead of whitelisting them", () => {
    const cwd = createReleaseReadyRepo();
    writeRepoFile(cwd, "fixtures/privacy-canary.jsonl", blockedAssignment);
    writeRepoFile(cwd, "tests/server/privacy-canary.test.ts", "const canary = " + JSON.stringify(blockedAssignment) + ";\n");
    writeRepoFile(cwd, "docs/superpowers/plans/release-note.md", blockedAssignment);
    git(cwd, ["add", "."]);

    const result = runPreflight(cwd);
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).not.toBe(0);
    expect(output).toContain("fixtures/privacy-canary.jsonl");
    expect(output).toContain("tests/server/privacy-canary.test.ts");
    expect(output).toContain("docs/superpowers/plans/release-note.md");
  });

  it("fails when tracked local artifacts are present", () => {
    const cwd = createReleaseReadyRepo();
    writeRepoFile(cwd, ".superpowers/session.json", "{}\n");
    git(cwd, ["add", ".superpowers/session.json"]);

    const result = runPreflight(cwd);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Tracked local artifact: .superpowers/session.json");
  });

  it("fails when npm pack would include a local artifact", () => {
    const cwd = createReleaseReadyRepo();
    const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    packageJson.files.push(".serena/");
    writeRepoFile(cwd, "package.json", JSON.stringify(packageJson, null, 2));
    writeRepoFile(cwd, ".serena/project.yml", "name: private-tool-state\n");
    git(cwd, ["add", "package.json"]);

    const result = runPreflight(cwd);
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).not.toBe(0);
    expect(output).toContain("Packaged local artifact: .serena/project.yml");
    expect(output).toContain("Packaged untracked file: .serena/project.yml");
  });

  it.each([
    [macHomePath],
    [linuxHomePath],
    [windowsHomePath]
  ])("fails on local absolute user home paths: %s", (pathCanary) => {
    const cwd = createReleaseReadyRepo();
    writeRepoFile(cwd, "docs/leak.md", `path: ${pathCanary}\n`);
    git(cwd, ["add", "docs/leak.md"]);

    const result = runPreflight(cwd);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Local user home path found in docs/leak.md");
  });

  it.each(privateOperatorAliases)("fails on standalone private operator alias %s", (alias) => {
    const cwd = createReleaseReadyRepo();
    writeRepoFile(cwd, "docs/operator.md", `Reviewed by ${alias}.\n`);
    git(cwd, ["add", "docs/operator.md"]);

    const result = runPreflight(cwd);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Private operator alias found in docs/operator.md");
  });

  it("scans package-lock.json for high-confidence blocked patterns", () => {
    const cwd = createReleaseReadyRepo();
    writeRepoFile(cwd, "package-lock.json", JSON.stringify({ canary: blockedAssignment }, null, 2));
    git(cwd, ["add", "package-lock.json"]);

    const result = runPreflight(cwd);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(blockedPatternMessage);
  });
});
