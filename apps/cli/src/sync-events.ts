import { messageRecordToEvent, sessionRecordToEvent } from "@opensync/adapter-opencode";
import type { MessageUpsertEvent, SessionUpsertEvent, SourceChangeEvent } from "@opensync/kit";
import type { adapterForSource } from "./adapters.js";
import type { OpenSyncConfig } from "./config.js";
import { syncMessage, syncSession } from "./transport.js";

export type SyncEvent = SessionUpsertEvent | MessageUpsertEvent;

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
): SyncEvent | null {
  if (event.action !== "changed") return null;
  if (event.resource === "session") {
    const session = adapter.getSession(event.externalId, { params });
    return session ? sessionRecordToEvent(session) : null;
  }
  if (event.resource === "message") {
    const message = adapter.getMessage(event.externalId, { params });
    return message ? messageRecordToEvent(message) : null;
  }
  return null;
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
