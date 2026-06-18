import { basename } from "node:path";
import type { AdapterMessage, AdapterSession, MessageRole } from "@opensync/kit";
import {
  createOpenCodeEvent,
  type OpenCodeMessageUpsertEvent,
  type OpenCodeSessionUpsertEvent,
} from "./events.js";
import type { OpenCodeMessageRow, OpenCodePartRow, OpenCodeSessionRow } from "./types.js";

export function sessionRowToRecord(row: OpenCodeSessionRow): AdapterSession<"opencode"> {
  const projectPath = row.directory || row.path || undefined;
  const model = parseJsonRecord(row.model);

  return {
    source: "opencode",
    externalId: row.id,
    title: row.title || row.slug || undefined,
    projectPath,
    projectName: projectPath ? basename(projectPath) : undefined,
    model: stringField(model, "id") ?? stringField(model, "modelID"),
    provider: stringField(model, "providerID"),
    promptTokens: numberField(row.tokens_input),
    completionTokens: numberField(row.tokens_output),
    cost: numberField(row.cost),
    sourceCreatedAt: row.time_created,
    sourceUpdatedAt: row.time_updated ?? undefined,
  };
}

export function messageRowToRecord(
  row: OpenCodeMessageRow,
  parts: OpenCodePartRow[] = [],
): AdapterMessage<"opencode"> {
  const data = parseJsonRecord(row.data);
  const time = recordField(data, "time");
  const model = recordField(data, "model");
  const tokens = recordField(data, "tokens");
  const created = numberField(time.created) ?? row.time_created;
  const completed = numberField(time.completed);
  const textContent = textContentFromParts(parts);
  const role = normalizeRole(stringField(data, "role"));

  return {
    source: "opencode",
    sessionExternalId: row.session_id,
    externalId: row.id,
    role: role === "unknown" && textContent ? inferRole(textContent) : role,
    textContent,
    model: stringField(data, "modelID") ?? stringField(model, "modelID"),
    provider: stringField(data, "providerID") ?? stringField(model, "providerID"),
    promptTokens: numberField(tokens.input),
    completionTokens: numberField(tokens.output),
    durationMs: completed === undefined ? undefined : completed - created,
    cost: numberField(data.cost),
    sourceCreatedAt: created,
    sourceUpdatedAt: row.time_updated ?? undefined,
  };
}

export function sessionRecordToEvent(
  session: AdapterSession<"opencode">,
): OpenCodeSessionUpsertEvent {
  return createOpenCodeEvent({
    kind: "session.upsert",
    createdAt: session.sourceCreatedAt,
    id: `opencode:session:${session.externalId}`,
    payload: session,
  });
}

export function messageRecordToEvent(
  message: AdapterMessage<"opencode">,
): OpenCodeMessageUpsertEvent {
  return createOpenCodeEvent({
    kind: "message.upsert",
    createdAt: message.sourceCreatedAt,
    id: `opencode:message:${message.externalId}`,
    payload: message,
  });
}

function textContentFromParts(parts: OpenCodePartRow[]): string | undefined {
  const text = [...parts]
    .sort((a, b) => a.time_created - b.time_created || a.id.localeCompare(b.id))
    .map((part) => parseJsonRecord(part.data))
    .filter((data) => stringField(data, "type") === "text")
    .map((data) => stringField(data, "text") ?? "")
    .join("");

  return text || undefined;
}

function normalizeRole(role: string | undefined): MessageRole {
  if (role === "user" || role === "assistant" || role === "system" || role === "tool") return role;
  return "unknown";
}

function inferRole(textContent: string): MessageRole {
  const assistantPatterns = [
    /^(I'll|Let me|Here's|I can|I've|I'm going to|I will|Sure|Certainly|Of course)/i,
    /```[\s\S]+```/,
    /^(Yes|No),?\s+(I|you|we|this|that)/i,
    /\*\*[^*]+\*\*/,
    /^\d+\.\s+\*\*/,
  ];
  const userPatterns = [
    /\?$/,
    /^(create|fix|add|update|show|make|build|implement|write|delete|remove|change|modify|help|can you|please|I want|I need)/i,
    /^@/,
  ];

  if (assistantPatterns.some((pattern) => pattern.test(textContent))) return "assistant";
  if (userPatterns.some((pattern) => pattern.test(textContent))) return "user";
  return textContent.length > 500 ? "assistant" : "user";
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
