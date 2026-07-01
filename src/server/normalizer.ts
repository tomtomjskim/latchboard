import { createHash } from "node:crypto";
import type { SafeFact, SafeFactCode, SafeSourceEventType, SourceType } from "../shared/contracts";
import type { JsonLineRecord } from "./events-adapter";

const allowedCodes = new Set<SafeFactCode>([
  "session_started",
  "tool_started",
  "tool_finished",
  "tool_failed",
  "completion_claim_seen",
  "validation_signal_seen",
  "next_step_signal_seen",
  "blocked_signal_seen",
  "idle_signal_seen",
  "unknown_safe_event"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeId(input: string): string {
  return `ws_${createHash("sha256").update(input).digest("hex").slice(0, 12)}`;
}

function sourceEventType(value: unknown): SafeSourceEventType {
  if (value === "session" || value === "tool" || value === "assistant" || value === "system") {
    return value;
  }
  return "unknown";
}

function safeTime(value: unknown): string {
  if (typeof value !== "string") {
    return new Date(0).toISOString();
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? new Date(0).toISOString() : new Date(timestamp).toISOString();
}

function safeSignals(value: unknown): SafeFactCode[] {
  const signals = Array.isArray(value) ? value : ["unknown_safe_event"];
  return signals.map((signal) =>
    allowedCodes.has(signal as SafeFactCode) ? (signal as SafeFactCode) : "unknown_safe_event"
  );
}

export function normalizeRecords(records: JsonLineRecord[], sourceType: SourceType): SafeFact[] {
  const facts: SafeFact[] = [];

  records.forEach((record) => {
    const value = isRecord(record.value) ? record.value : {};
    const scenario = typeof value.scenario === "string" ? value.scenario : `line_${record.lineNumber}`;
    const workstreamId = safeId(`${sourceType}:${scenario}`);
    const signals = safeSignals(value.signals);

    signals.forEach((code, index) => {
      facts.push({
        id: `fact_${workstreamId}_${record.lineNumber}_${index}`,
        sourceType,
        occurredAt: safeTime(value.time),
        workstreamId,
        code,
        sourceEventType: sourceEventType(value.kind)
      });
    });
  });

  return facts;
}
