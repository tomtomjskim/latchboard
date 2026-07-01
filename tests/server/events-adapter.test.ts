import { mkdtempSync, writeFileSync } from "node:fs";
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
});
