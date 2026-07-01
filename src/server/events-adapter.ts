import { existsSync, readFileSync, statSync } from "node:fs";
import type { SourceStatus } from "../shared/contracts";

export type SourceCursor = {
  path: string;
  offset: number;
};

export type JsonLineRecord = {
  lineNumber: number;
  value: unknown;
};

export type SourceReadResult = {
  records: JsonLineRecord[];
  cursor: SourceCursor;
  status: SourceStatus;
};

export function readJsonlSince(cursor: SourceCursor): SourceReadResult {
  const status: SourceStatus = {
    connected: existsSync(cursor.path),
    parsedLineCount: 0,
    malformedLineCount: 0,
    partialLineCount: 0
  };

  if (!status.connected) {
    return { records: [], cursor, status };
  }

  const size = statSync(cursor.path).size;
  const offset = cursor.offset > size ? 0 : cursor.offset;
  const text = readFileSync(cursor.path, "utf8").slice(offset);
  const lines = text.split("\n");
  const hasPartial = text.length > 0 && !text.endsWith("\n");
  const completeLines = hasPartial ? lines.slice(0, -1) : lines;

  if (hasPartial) {
    status.partialLineCount += 1;
  }

  const records: JsonLineRecord[] = [];
  completeLines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    try {
      records.push({ lineNumber: index + 1, value: JSON.parse(line) });
      status.parsedLineCount += 1;
    } catch {
      status.malformedLineCount += 1;
    }
  });

  const consumed = completeLines.join("\n").length + (completeLines.length > 0 ? 1 : 0);

  return {
    records,
    cursor: { path: cursor.path, offset: offset + consumed },
    status
  };
}
