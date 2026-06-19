import { basename } from "node:path";
import {
  joinTextParts,
  type AdapterMessage,
  type AdapterSession,
  type MessagePart,
  type MessageRole,
} from "@opensync/kit";
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
  const cache = recordField(tokens, "cache");
  const created = numberField(time.created) ?? row.time_created;
  const completed = numberField(time.completed);
  const messageParts = partsFromRows(parts);
  const role = normalizeRole(stringField(data, "role"));
  const textContent = joinTextParts(messageParts);

  return {
    source: "opencode",
    sessionExternalId: row.session_id,
    externalId: row.id,
    role: role === "unknown" && textContent ? inferRole(textContent) : role,
    parts: messageParts,
    model: stringField(data, "modelID") ?? stringField(model, "modelID"),
    provider: stringField(data, "providerID") ?? stringField(model, "providerID"),
    promptTokens: numberField(tokens.input),
    completionTokens: numberField(tokens.output),
    cachedTokens: numberField(cache.read),
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

// Normalize OpenCode native part rows into canonical OpenSync message parts.
// OpenCode stores a tool's call and result together in a single "tool" part;
// we split it into separate canonical "tool-call" and "tool-result" parts so
// every client shares one vocabulary. Unrecognized native types are preserved
// losslessly as "unknown".
function partsFromRows(parts: OpenCodePartRow[]): MessagePart[] {
  const ordered = [...parts].sort(
    (a, b) => a.time_created - b.time_created || a.id.localeCompare(b.id),
  );

  const result: MessagePart[] = [];
  for (const row of ordered) {
    const data = parseJsonRecord(row.data);
    const type = stringField(data, "type");

    switch (type) {
      case "text":
        result.push({ type: "text", content: { text: stringField(data, "text") ?? "" } });
        break;
      case "reasoning":
        result.push({ type: "reasoning", content: { text: stringField(data, "text") ?? "" } });
        break;
      case "tool": {
        const callId = stringField(data, "callID") ?? stringField(data, "callId") ?? "";
        const name = stringField(data, "tool") ?? "unknown";
        const state = recordField(data, "state");
        result.push({
          type: "tool-call",
          content: { callId, name, args: state.input ?? {} },
        });
        if ("output" in state || stringField(state, "status") === "completed") {
          result.push({
            type: "tool-result",
            content: {
              callId,
              name,
              result: state.output ?? state.metadata ?? null,
              isError: stringField(state, "status") === "error",
            },
          });
        }
        break;
      }
      case "file":
        result.push({
          type: "file",
          content: {
            mime: stringField(data, "mime"),
            filename: stringField(data, "filename"),
            url: stringField(data, "url"),
          },
        });
        break;
      case "step-start":
        result.push({ type: "step-start", content: {} });
        break;
      case "step-finish":
        result.push({ type: "step-finish", content: {} });
        break;
      default:
        result.push({ type: "unknown", content: data });
        break;
    }
  }

  return result;
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
