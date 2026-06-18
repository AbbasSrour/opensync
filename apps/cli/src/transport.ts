import type { MessageUpsertEvent, SessionUpsertEvent } from "@opensync/kit";
import type { OpenSyncConfig } from "./config.js";
import { toSiteUrl } from "./config.js";

export type SyncResult =
  | { ok: true; data: unknown }
  | { ok: false; status?: number; error: string };

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
    source: event.source,
    createdAt: event.payload.sourceCreatedAt ?? event.createdAt,
  };
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
