import { homedir } from "node:os";
import { resolve } from "node:path";
import { appendWorkstreamLabel, type WorkstreamLabelInput } from "./workstream-labels";

function valueAfter(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  const value = index === -1 ? undefined : argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/") ? `${homedir()}${path.slice(1)}` : path;
}

function parseInputPath(argv: string[]): string {
  return resolve(expandHome(valueAfter(argv, "--input") ?? "~/.cmuxterm/workstream.jsonl"));
}

function parseLabelInput(argv: string[]): WorkstreamLabelInput {
  const workstreamId = valueAfter(argv, "--workstream-id");
  const safeTitle = valueAfter(argv, "--safe-title");

  if (!workstreamId) {
    throw new Error("--workstream-id is required");
  }
  if (!safeTitle) {
    throw new Error("--safe-title is required");
  }

  return {
    workstreamId,
    safeTitle,
    ...(valueAfter(argv, "--status") ? { status: valueAfter(argv, "--status") } : {}),
    ...(valueAfter(argv, "--kind") ? { kind: valueAfter(argv, "--kind") } : {}),
    ...(valueAfter(argv, "--cwd") ? { cwd: valueAfter(argv, "--cwd") } : {})
  };
}

function main(argv: string[]): void {
  const path = parseInputPath(argv);
  const record = appendWorkstreamLabel(path, parseLabelInput(argv));
  console.log(JSON.stringify({ ok: true, path, record }));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
