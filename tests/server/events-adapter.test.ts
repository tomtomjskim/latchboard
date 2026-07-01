import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readJsonlSince } from "../../src/server/events-adapter";

describe("readJsonlSince", () => {
  it("reads complete lines and counts malformed/partial lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-"));
    const path = join(dir, "events.jsonl");
    writeFileSync(path, '{"ok":true}\n{bad\n{"partial":');

    const result = readJsonlSince({ path, offset: 0 });

    expect(result.records).toHaveLength(1);
    expect(result.status.parsedLineCount).toBe(1);
    expect(result.status.malformedLineCount).toBe(1);
    expect(result.status.partialLineCount).toBe(1);
  });

  it("returns a cursor at the file byte length after reading newline-terminated JSONL", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-"));
    const path = join(dir, "events.jsonl");
    writeFileSync(path, '{"message":"안녕"}\n{"ok":true}\n');

    const result = readJsonlSince({ path, offset: 0 });

    expect(result.records).toHaveLength(2);
    expect(result.cursor.offset).toBe(statSync(path).size);
    expect(readJsonlSince(result.cursor).records).toHaveLength(0);
  });

  it("keeps source line numbers continuous when reading appended records", () => {
    const dir = mkdtempSync(join(tmpdir(), "latchboard-"));
    const path = join(dir, "events.jsonl");
    writeFileSync(path, '{"first":true}\n{"second":true}\n');
    const firstRead = readJsonlSince({ path, offset: 0 });
    writeFileSync(path, '{"first":true}\n{"second":true}\n{"third":true}\n');

    const secondRead = readJsonlSince(firstRead.cursor);

    expect(firstRead.records.map((record) => record.lineNumber)).toEqual([1, 2]);
    expect(secondRead.records.map((record) => record.lineNumber)).toEqual([3]);
  });
});
