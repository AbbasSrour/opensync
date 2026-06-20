import { messageRecordToEvent, sessionRecordToEvent } from "@opensync/adapter-opencode";
import type { MessageUpsertEvent, SessionUpsertEvent, SourceChangeEvent } from "@opensync/kit";
import type { adapterForSource } from "./adapters.js";
import type { OpenSyncConfig } from "./config.js";
import { syncBatch, syncMessage, syncSession } from "./transport.js";

export type SyncEvent = SessionUpsertEvent | MessageUpsertEvent;

export type ResolveQueuedEventResult =
  | { status: "ready"; event: SyncEvent }
  | { status: "missing" }
  | { status: "incomplete" };

export type UploadSummary = {
  sessions: number;
  messages: number;
  failed: number;
};

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
};

export async function uploadEvents(
  config: Required<OpenSyncConfig>,
  events: SyncEvent[],
  retry: RetryOptions = {},
): Promise<UploadSummary> {
  const summary: UploadSummary = { sessions: 0, messages: 0, failed: 0 };
  for (const event of events) {
    const ok = await uploadWithRetry(config, event, retry);
    if (!ok) {
      summary.failed++;
      continue;
    }
    if (event.kind === "session.upsert") summary.sessions++;
    if (event.kind === "message.upsert") summary.messages++;
  }
  return summary;
}

export type SessionUnit = {
  externalId: string;
  events: SyncEvent[];
};

export type SyncAllResult = {
  sessions: number;
  messages: number;
  failed: number;
  syncedSessionIds: string[];
};

export type UploadSessionUnitsOptions = {
  concurrency?: number;
  retry?: RetryOptions;
  onProgress?: (done: number, total: number) => void;
  batchSize?: number;
};

// Uploads each session together with its own messages as one unit, running
// several units concurrently. A session is only reported as synced when its
// session record and every one of its messages upload successfully, so one
// failed message never marks the whole session as done.
export async function uploadSessionUnits(
  config: Required<OpenSyncConfig>,
  units: SessionUnit[],
  options: UploadSessionUnitsOptions = {},
): Promise<SyncAllResult> {
  const concurrency = Math.max(1, options.concurrency ?? 8);
  const retry = options.retry ?? {};
  const batchSize = Math.max(1, options.batchSize ?? 100);
  const result: SyncAllResult = { sessions: 0, messages: 0, failed: 0, syncedSessionIds: [] };
  const batches = sessionUnitBatches(units, batchSize);

  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= batches.length) return;
      const batch = batches[index];

      const events = batch.flatMap((unit) => unit.events);
      const ok = await uploadBatchWithRetry(config, events, retry);
      if (!ok) {
        result.failed += batch.length;
      } else {
        result.messages += events.filter((event) => event.kind === "message.upsert").length;
        result.sessions += events.filter((event) => event.kind === "session.upsert").length;
        result.syncedSessionIds.push(...batch.map((unit) => unit.externalId));
      }

      done += batch.length;
      options.onProgress?.(done, units.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, units.length) }, () => worker()));
  return result;
}

function sessionUnitBatches(units: SessionUnit[], batchSize: number): SessionUnit[][] {
  const batches: SessionUnit[][] = [];
  let current: SessionUnit[] = [];
  let eventCount = 0;
  for (const unit of units) {
    if (current.length > 0 && eventCount + unit.events.length > batchSize) {
      batches.push(current);
      current = [];
      eventCount = 0;
    }
    current.push(unit);
    eventCount += unit.events.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function uploadBatchWithRetry(
  config: Required<OpenSyncConfig>,
  events: SyncEvent[],
  retry: RetryOptions,
): Promise<boolean> {
  const attempts = Math.max(1, retry.attempts ?? 3);
  const baseDelayMs = retry.baseDelayMs ?? 250;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await syncBatch(config, events);
    if (result.ok) {
      const data = result.data as { errors?: unknown };
      if (!Array.isArray(data.errors) || data.errors.length === 0) return true;
    }
    if (attempt < attempts) await delay(baseDelayMs * 2 ** (attempt - 1));
  }
  return false;
}

async function uploadWithRetry(
  config: Required<OpenSyncConfig>,
  event: SyncEvent,
  retry: RetryOptions,
): Promise<boolean> {
  const attempts = Math.max(1, retry.attempts ?? 3);
  const baseDelayMs = retry.baseDelayMs ?? 250;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result =
      event.kind === "session.upsert"
        ? await syncSession(config, event)
        : await syncMessage(config, event);
    if (result.ok) return true;
    if (attempt < attempts) await delay(baseDelayMs * 2 ** (attempt - 1));
  }
  return false;
}

export function resolveQueuedEvent(
  event: SourceChangeEvent,
  adapter: NonNullable<ReturnType<typeof adapterForSource>>,
  params: Record<string, string>,
): ResolveQueuedEventResult {
  if (event.action !== "changed") return { status: "missing" };
  if (event.resource === "session") {
    const session = adapter.getSession(event.externalId, { params });
    return session
      ? { status: "ready", event: sessionRecordToEvent(session) }
      : { status: "missing" };
  }
  if (event.resource === "message") {
    const status = getMessageSyncStatus(adapter, event.externalId, params);
    if (status === "incomplete") return { status: "incomplete" };
    if (status === "missing") return { status: "missing" };
    const message = adapter.getMessage(event.externalId, { params });
    return message
      ? { status: "ready", event: messageRecordToEvent(message) }
      : { status: "missing" };
  }
  return { status: "missing" };
}

function getMessageSyncStatus(
  adapter: NonNullable<ReturnType<typeof adapterForSource>>,
  externalId: string,
  params: Record<string, string>,
): "ready" | "incomplete" | "missing" {
  const statusReader = adapter as {
    getMessageSyncStatus?: (
      externalId: string,
      options?: { params?: Record<string, string> },
    ) => "ready" | "incomplete" | "missing";
  };
  return statusReader.getMessageSyncStatus?.(externalId, { params }) ?? "ready";
}

export function requireConfig(config: {
  convexUrl?: string;
  apiKey?: string;
}): Required<OpenSyncConfig> | null {
  if (!config.convexUrl || !config.apiKey) return null;
  return { convexUrl: config.convexUrl, apiKey: config.apiKey };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
