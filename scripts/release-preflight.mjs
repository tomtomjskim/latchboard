#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const requiredFiles = [
  "LICENSE",
  ".nvmrc",
  "README.md",
  "docs/privacy.md",
  "docs/release-checklist.md",
  "docs/dogfood-runbook.md"
];

const blockedPatterns = [
  ["BEGIN", " PRIVATE KEY"].join(""),
  ["OPENAI_API_KEY", "="].join(""),
  ["ANTHROPIC_API_KEY", "="].join(""),
  ["ghp", "_"].join(""),
  ["xoxb", "-"].join("")
];
const shortKeyPrefix = ["sk", "-"].join("");

const allowedSyntheticCanaryPaths = new Set([
  "fixtures/privacy-canary.jsonl",
  "tests/server/privacy-canary.test.ts"
]);

function isAllowedExamplePath(path) {
  return allowedSyntheticCanaryPaths.has(path) || path.startsWith("docs/superpowers/plans/");
}

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

function checkPackagePrivate(failures) {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  if (packageJson.private === true) {
    failures.push('package.json must not set "private": true');
  }
}

function checkBlockedPatterns(files, failures) {
  for (const file of files) {
    if (file === "package-lock.json" || isAllowedExamplePath(file)) {
      continue;
    }

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
  }
}

function main() {
  const failures = [];
  const files = trackedFiles();

  checkRequiredFiles(files, failures);
  checkPackagePrivate(failures);
  checkBlockedPatterns(files, failures);

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
