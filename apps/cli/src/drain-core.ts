import type { SourceChangeEvent } from "@opensync/kit";
import type { QueueEntry } from "./queue.js";
import type { ResolveQueuedEventResult, SyncEvent, UploadSummary } from "./sync-events.js";

// References that never resolve (e.g. a row deleted before drain, or a transient
// observation) are dead-lettered once they are older than this, so a single
// permanently-missing reference cannot block the ordered queue forever. Newer
// missing references are left in place to absorb the race where an event is
// observed before the source row is committed to SQLite.
export const STALE_REFERENCE_MS = 60_000;

export type DrainResult = {
  source: string;
  path: string;
  queued: number;
  resolved: number;
  sessions: number;
  messages: number;
  missing: number;
  incomplete: number;
  malformed: number;
  deadLettered: number;
  uploaded?: { sessions: number; messages: number; failed: number };
  advancedOffset: boolean;
};

// Injected dependencies for the pure drain core, so ordering/commit/staleness
// logic can be tested without filesystem or network access.
export type DrainDeps = {
  resolve: (event: SourceChangeEvent) => SyncEvent | null | ResolveQueuedEventResult;
  upload: (event: SyncEvent) => Promise<UploadSummary>;
};

export type DrainPlan = {
  result: DrainResult;
  deadLetter: string[];
  deferred: string[];
  committedOffset: number;
};

// Pure ordering/commit core. Walks queue entries in order and decides what to
// upload, dead-letter, and how far the committed offset may advance. Performs no
// IO itself — all effects flow through `deps`.
export async function drainEntries(
  entries: QueueEntry[],
  startOffset: number,
  deps: DrainDeps,
  context: { source: string; path: string; dryRun?: boolean; now?: number },
): Promise<DrainPlan> {
  const now = context.now ?? Date.now();
  const result: DrainResult = {
    source: context.source,
    path: context.path,
    queued: entries.length,
    resolved: 0,
    sessions: 0,
    messages: 0,
    missing: 0,
    incomplete: 0,
    malformed: 0,
    deadLettered: 0,
    advancedOffset: false,
  };

  // Dry run: report what would happen without uploading, committing, or writing.
  if (context.dryRun) {
    for (const entry of entries) {
      if (!entry.event) {
        result.malformed++;
        continue;
      }
      const resolved = deps.resolve(entry.event);
      const resolution = normalizeResolution(resolved);
      if (resolution.status === "missing") {
        result.missing++;
        continue;
      }
      if (resolution.status === "incomplete") {
        result.incomplete++;
        continue;
      }
      result.resolved++;
      if (resolution.event.kind === "session.upsert") result.sessions++;
      if (resolution.event.kind === "message.upsert") result.messages++;
    }
    return { result, deadLetter: [], deferred: [], committedOffset: startOffset };
  }

  const uploaded = { sessions: 0, messages: 0, failed: 0 };
  const deadLetter: string[] = [];
  const deferred: string[] = [];
  let committedOffset = startOffset;

  // Process references in order. Stop at the first reference that cannot be
  // committed (upload failed, or a not-yet-resolvable reference) so the offset
  // never advances past unprocessed work.
  for (const entry of entries) {
    if (!entry.event) {
      result.malformed++;
      deadLetter.push(entry.raw);
      committedOffset = entry.endOffset;
      continue;
    }

    const resolved = deps.resolve(entry.event);
    const resolution = normalizeResolution(resolved);
    if (resolution.status === "incomplete") {
      result.incomplete++;
      deferred.push(entry.raw);
      committedOffset = entry.endOffset;
      continue;
    }
    if (resolution.status === "missing") {
      result.missing++;
      if (now - entry.event.observedAt < STALE_REFERENCE_MS) break;
      result.deadLettered++;
      deadLetter.push(entry.raw);
      committedOffset = entry.endOffset;
      continue;
    }

    const summary = await deps.upload(resolution.event);
    if (summary.failed > 0) {
      uploaded.failed += summary.failed;
      break;
    }
    uploaded.sessions += summary.sessions;
    uploaded.messages += summary.messages;
    result.resolved++;
    if (resolution.event.kind === "session.upsert") result.sessions++;
    if (resolution.event.kind === "message.upsert") result.messages++;
    committedOffset = entry.endOffset;
  }

  result.uploaded = uploaded;
  return { result, deadLetter, deferred, committedOffset };
}

function normalizeResolution(
  resolved: SyncEvent | null | ResolveQueuedEventResult,
): ResolveQueuedEventResult {
  if (!resolved) return { status: "missing" };
  if ("status" in resolved) return resolved;
  return { status: "ready", event: resolved };
}
