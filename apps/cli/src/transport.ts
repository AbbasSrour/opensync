import type { MessagePart, MessageUpsertEvent, SessionUpsertEvent } from "@opensync/kit";
import type { OpenSyncConfig } from "./config.js";
import { toSiteUrl } from "./config.js";

export type SyncResult =
  | { ok: true; data: unknown }
  | { ok: false; status?: number; error: string };

export type SyncMetadata = {
  sessions: Array<Record<string, unknown> & { externalId: string }>;
  messages: Array<Record<string, unknown> & { sessionExternalId: string; externalId: string }>;
};

export async function health(config: Pick<OpenSyncConfig, "convexUrl">): Promise<SyncResult> {
  if (!config.convexUrl) return { ok: false, error: "Missing Convex URL" };
  return request(`${toSiteUrl(config.convexUrl)}/health`);
}

export async function syncSession(
  config: Required<OpenSyncConfig>,
  event: SessionUpsertEvent,
): Promise<SyncResult> {
  return request(`${toSiteUrl(config.convexUrl)}/sync/session`, {
    method: "POST",
    apiKey: config.apiKey,
    body: sessionEventToConvexPayload(event),
  });
}

export async function syncMessage(
  config: Required<OpenSyncConfig>,
  event: MessageUpsertEvent,
): Promise<SyncResult> {
  return request(`${toSiteUrl(config.convexUrl)}/sync/message`, {
    method: "POST",
    apiKey: config.apiKey,
    body: messageEventToConvexPayload(event),
  });
}

export async function syncBatch(
  config: Required<OpenSyncConfig>,
  events: Array<SessionUpsertEvent | MessageUpsertEvent>,
): Promise<SyncResult> {
  return request(`${toSiteUrl(config.convexUrl)}/sync/batch`, {
    method: "POST",
    apiKey: config.apiKey,
    body: batchEventsToConvexPayload(events),
  });
}

export async function syncMetadata(
  config: Required<OpenSyncConfig>,
  input: {
    sessions: string[];
    messages: Array<{ sessionExternalId: string; externalId: string }>;
  },
): Promise<SyncResult> {
  return request(`${toSiteUrl(config.convexUrl)}/sync/metadata`, {
    method: "POST",
    apiKey: config.apiKey,
    body: input,
  });
}

export function sessionEventToConvexPayload(event: SessionUpsertEvent) {
  return {
    ...event.payload,
    source: event.source,
    createdAt: event.payload.sourceCreatedAt ?? event.createdAt,
  };
}

export function messageEventToConvexPayload(event: MessageUpsertEvent) {
  return {
    ...event.payload,
    parts: event.payload.parts.map(limitPartSize),
    source: event.source,
    createdAt: event.payload.sourceCreatedAt ?? event.createdAt,
  };
}

export function batchEventsToConvexPayload(events: Array<SessionUpsertEvent | MessageUpsertEvent>) {
  return {
    sessions: events
      .filter((event): event is SessionUpsertEvent => event.kind === "session.upsert")
      .map(sessionEventToConvexPayload),
    messages: events
      .filter((event): event is MessageUpsertEvent => event.kind === "message.upsert")
      .map(messageEventToConvexPayload),
  };
}

const MAX_PART_BYTES = 700 * 1024;
const TRUNCATED_TEXT_CHARS = 100_000;

function limitPartSize(part: MessagePart): MessagePart {
  if (byteLength(part) <= MAX_PART_BYTES) return part;

  if (part.type === "text" || part.type === "reasoning") {
    return {
      ...part,
      content: {
        text: truncateText(part.content.text, TRUNCATED_TEXT_CHARS),
      },
    };
  }

  if (part.type === "tool-result") {
    return {
      ...part,
      content: {
        ...part.content,
        result: truncatedValue(part.content.result),
      },
    };
  }

  if (part.type === "tool-call") {
    return {
      ...part,
      content: {
        ...part.content,
        args: truncatedValue(part.content.args),
      },
    };
  }

  return { type: "unknown", content: truncatedValue(part.content) };
}

function truncatedValue(value: unknown): { truncated: true; preview: string } {
  return {
    truncated: true,
    preview: truncateText(
      typeof value === "string" ? value : safeJson(value),
      TRUNCATED_TEXT_CHARS,
    ),
  };
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[OpenSync truncated oversized content: ${value.length.toLocaleString()} chars]`;
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(safeJson(value), "utf8");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function listBackendSessionIds(
  config: Required<OpenSyncConfig>,
): Promise<Set<string>> {
  const result = await request(`${toSiteUrl(config.convexUrl)}/sync/sessions/list`, {
    apiKey: config.apiKey,
  });
  if (!result.ok) return new Set();
  const data = result.data as { sessionIds?: unknown };
  return new Set(
    Array.isArray(data.sessionIds)
      ? data.sessionIds.filter((id): id is string => typeof id === "string")
      : [],
  );
}

async function request(
  url: string,
  options: { method?: string; apiKey?: string; body?: unknown } = {},
): Promise<SyncResult> {
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok)
      return {
        ok: false,
        status: response.status,
        error: String(data.error ?? text ?? response.statusText),
      };
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
