import { existsSync, readFileSync } from "node:fs";
import type { SourceStatus } from "../shared/contracts";

export type SourceCursor = {
  path: string;
  offset: number;
  lineNumber?: number;
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

  const file = readFileSync(cursor.path);
  const offset = cursor.offset > file.length ? 0 : cursor.offset;
  const startLineNumber = offset === 0 ? 1 : cursor.lineNumber ?? countCompleteLines(file.subarray(0, offset)) + 1;
  const unread = file.subarray(offset);
  const lastNewlineIndex = unread.lastIndexOf(0x0a);
  const completeSegment = lastNewlineIndex === -1 ? Buffer.alloc(0) : unread.subarray(0, lastNewlineIndex + 1);
  const partialSegment = lastNewlineIndex === -1 ? unread : unread.subarray(lastNewlineIndex + 1);
  const completeText = completeSegment.toString("utf8");
  const completeLines = completeText.length === 0 ? [] : completeText.slice(0, -1).split("\n");

  if (partialSegment.length > 0) {
    status.partialLineCount += 1;
  }

  const records: JsonLineRecord[] = [];
  completeLines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    try {
      records.push({ lineNumber: startLineNumber + index, value: JSON.parse(line) });
      status.parsedLineCount += 1;
    } catch {
      status.malformedLineCount += 1;
    }
  });

  return {
    records,
    cursor: {
      path: cursor.path,
      offset: offset + completeSegment.length,
      lineNumber: startLineNumber + completeLines.length
    },
    status
  };
}

function countCompleteLines(buffer: Buffer): number {
  let lineCount = 0;
  for (const byte of buffer) {
    if (byte === 0x0a) {
      lineCount += 1;
    }
  }
  return lineCount;
}
