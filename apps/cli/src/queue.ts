import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceChangeEvent } from "@opensync/kit";
import { queueDir, stateDir } from "./config.js";

export function queuePath(source = "opencode"): string {
  return join(queueDir, `${source}.jsonl`);
}

export function offsetPath(source = "opencode"): string {
  return join(stateDir, `${source}.offset.json`);
}

export function deadLetterPath(source = "opencode"): string {
  return join(stateDir, `${source}.dead-letter.jsonl`);
}

export function deferredPath(source = "opencode"): string {
  return join(stateDir, `${source}.deferred.jsonl`);
}

export function inspectQueue(source = "opencode") {
  const path = queuePath(source);
  const offset = readOffset(source);
  if (!existsSync(path)) return { source, path, exists: false, bytes: 0, offset, pendingBytes: 0 };
  const bytes = statSync(path).size;
  return { source, path, exists: true, bytes, offset, pendingBytes: Math.max(0, bytes - offset) };
}

export type QueueEntry = {
  raw: string;
  event: SourceChangeEvent | null;
  endOffset: number;
};

export type DeferredQueueEntry = QueueEntry & {
  attempts: number;
};

export type QueueRead = {
  source: string;
  path: string;
  entries: QueueEntry[];
  startOffset: number;
  endOffset: number;
};

export function readQueue(source = "opencode", fromOffset = 0): QueueRead {
  const path = queuePath(source);
  if (!existsSync(path))
    return { source, path, entries: [], startOffset: fromOffset, endOffset: fromOffset };

  const parsed = parseQueueBuffer(readFileSync(path), fromOffset);
  return { source, path, ...parsed };
}

export function parseQueueBuffer(
  buffer: Buffer,
  fromOffset = 0,
): { entries: QueueEntry[]; startOffset: number; endOffset: number } {
  const total = buffer.length;
  const start = fromOffset > 0 && fromOffset <= total ? fromOffset : 0;
  const entries: QueueEntry[] = [];
  let lineStart = start;

  for (let index = start; index < total; index++) {
    if (buffer[index] !== 0x0a) continue;
    const raw = buffer.toString("utf8", lineStart, index);
    lineStart = index + 1;
    if (raw) entries.push({ raw, event: parseEvent(raw), endOffset: lineStart });
  }

  return { entries, startOffset: start, endOffset: lineStart };
}

function parseEvent(raw: string): SourceChangeEvent | null {
  try {
    const parsed = JSON.parse(raw) as SourceChangeEvent;
    return isSourceChangeEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readOffset(source = "opencode"): number {
  const path = offsetPath(source);
  if (!existsSync(path)) return 0;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { offset?: unknown };
    return typeof parsed.offset === "number" && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    return 0;
  }
}

export function writeOffset(source: string, offset: number): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    offsetPath(source),
    JSON.stringify({ offset, updatedAt: Date.now() }, null, 2),
    "utf8",
  );
}

export function appendDeadLetter(source: string, entries: string[]): void {
  if (entries.length === 0) return;
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(deadLetterPath(source), `${entries.join("\n")}\n`, { encoding: "utf8", flag: "a" });
}

export function appendDeferred(source: string, entries: string[]): void {
  if (entries.length === 0) return;
  mkdirSync(stateDir, { recursive: true });
  const lines = entries.map((raw) => JSON.stringify({ event: parseEvent(raw), attempts: 0 }));
  writeFileSync(deferredPath(source), `${lines.join("\n")}\n`, { encoding: "utf8", flag: "a" });
}

export function readDeferredQueue(
  source = "opencode",
): QueueRead & { entries: DeferredQueueEntry[] } {
  const path = deferredPath(source);
  if (!existsSync(path)) return { source, path, entries: [], startOffset: 0, endOffset: 0 };
  const parsed = parseDeferredBuffer(readFileSync(path));
  return { source, path, ...parsed };
}

export function writeDeferred(source: string, entries: DeferredQueueEntry[]): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    deferredPath(source),
    entries.length === 0
      ? ""
      : `${entries.map((entry) => JSON.stringify({ event: entry.event, attempts: entry.attempts })).join("\n")}\n`,
    "utf8",
  );
}

function parseDeferredBuffer(buffer: Buffer): {
  entries: DeferredQueueEntry[];
  startOffset: number;
  endOffset: number;
} {
  const parsed = parseQueueBuffer(buffer, 0);
  return {
    ...parsed,
    entries: parsed.entries.map((entry) => {
      try {
        const value = JSON.parse(entry.raw) as { event?: unknown; attempts?: unknown };
        if (value && typeof value === "object" && "event" in value) {
          const rawEvent = JSON.stringify(value.event);
          return {
            ...entry,
            raw: rawEvent,
            event: parseEvent(rawEvent),
            attempts:
              typeof value.attempts === "number" && value.attempts >= 0 ? value.attempts : 0,
          };
        }
      } catch {}
      return { ...entry, attempts: 0 };
    }),
  };
}

export function flushQueue(source = "opencode"): { path: string; existed: boolean } {
  const path = queuePath(source);
  const existed = existsSync(path);
  if (existed) writeFileSync(path, "", "utf8");
  writeOffset(source, 0);
  return { path, existed };
}

function isSourceChangeEvent(value: SourceChangeEvent): value is SourceChangeEvent {
  return (
    value &&
    value.version === 1 &&
    typeof value.source === "string" &&
    (value.resource === "session" || value.resource === "message") &&
    (value.action === "changed" || value.action === "deleted") &&
    typeof value.externalId === "string" &&
    typeof value.observedAt === "number"
  );
}
