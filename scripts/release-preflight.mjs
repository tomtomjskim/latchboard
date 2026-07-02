#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const requiredFiles = [
  "LICENSE",
  ".nvmrc",
  "README.md",
  "package-lock.json",
  "docs/privacy.md",
  "docs/input-format.md",
  "docs/troubleshooting.md",
  "docs/release-checklist.md",
  "docs/dogfood-runbook.md",
  "SECURITY.md",
  "CONTRIBUTING.md"
];

const blockedPatterns = [
  ["BEGIN", " PRIVATE KEY"].join(""),
  ["OPENAI_API_KEY", "="].join(""),
  ["ANTHROPIC_API_KEY", "="].join(""),
  ["ghp", "_"].join(""),
  ["xoxb", "-"].join("")
];
const shortKeyPrefix = ["sk", "-"].join("");
const localHomePathPattern = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/;
const privateOperatorAliases = [
  ["T", "om"].join(""),
  ["T", "O", "M"].join("")
];
const blockedArtifactDirectories = [
  ".superpowers",
  ".serena",
  ".latchboard",
  "docs/superpowers/plans",
  "node_modules",
  "test-results",
  "playwright-report"
];

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

function isText(buffer) {
  return !buffer.includes(0);
}

function includesShortKeyPrefix(text) {
  for (let index = text.indexOf(shortKeyPrefix); index !== -1; index = text.indexOf(shortKeyPrefix, index + 1)) {
    const previous = index === 0 ? "" : text[index - 1];
    if (!/[A-Za-z0-9_]/.test(previous)) {
      return true;
    }
  }

  return false;
}

function checkRequiredFiles(files, failures) {
  const tracked = new Set(files);
  for (const file of requiredFiles) {
    if (!tracked.has(file)) {
      failures.push(`Missing required file: ${file}`);
    }
  }
}

function isInDirectory(file, directory) {
  return file === directory || file.startsWith(`${directory}/`);
}

function checkTrackedArtifacts(files, failures) {
  for (const file of files) {
    for (const directory of blockedArtifactDirectories) {
      if (isInDirectory(file, directory)) {
        failures.push(`Tracked local artifact: ${file}`);
        break;
      }
    }
  }
}

function checkPackageMetadata(failures) {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  if (packageJson.private !== false) {
    failures.push('package.json must set "private": false');
  }
  if (packageJson.license !== "MIT") {
    failures.push('package.json must set "license": "MIT"');
  }
  if (packageJson.engines?.node !== ">=18.12 <23") {
    failures.push('package.json must set "engines.node": ">=18.12 <23"');
  }
  if (!Array.isArray(packageJson.files) || packageJson.files.length === 0) {
    failures.push("package.json must define a package files allowlist");
  }
}

function checkBlockedPatterns(files, failures) {
  for (const file of files) {
    const body = readFileSync(file);
    if (!isText(body)) {
      continue;
    }

    const text = body.toString("utf8");
    for (const pattern of blockedPatterns) {
      if (text.includes(pattern)) {
        failures.push(`Blocked pattern ${pattern} found in ${file}`);
      }
    }
    if (includesShortKeyPrefix(text)) {
      failures.push(`Blocked pattern ${shortKeyPrefix} found in ${file}`);
    }
    if (localHomePathPattern.test(text)) {
      failures.push(`Local user home path found in ${file}`);
    }

    if (file !== "package-lock.json") {
      for (const alias of privateOperatorAliases) {
        const aliasPattern = new RegExp(`\\b${alias}\\b`);
        if (aliasPattern.test(text)) {
          failures.push(`Private operator alias found in ${file}`);
          break;
        }
      }
    }
  }
}

function packagedFiles(failures) {
  try {
    const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const packages = JSON.parse(output);
    return packages.flatMap((entry) => entry.files.map((file) => file.path));
  } catch (error) {
    failures.push(`npm pack dry-run failed: ${error.message}`);
    return [];
  }
}

function checkPackagedFiles(files, failures) {
  const tracked = new Set(files);
  for (const file of packagedFiles(failures)) {
    for (const directory of blockedArtifactDirectories) {
      if (isInDirectory(file, directory)) {
        failures.push(`Packaged local artifact: ${file}`);
        break;
      }
    }
    if (!tracked.has(file)) {
      failures.push(`Packaged untracked file: ${file}`);
    }
  }
}

function main() {
  const failures = [];
  const files = trackedFiles();

  checkRequiredFiles(files, failures);
  checkTrackedArtifacts(files, failures);
  checkPackageMetadata(failures);
  checkBlockedPatterns(files, failures);
  checkPackagedFiles(files, failures);

  if (failures.length > 0) {
    console.error("Release preflight failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Release preflight passed");
}

main();
