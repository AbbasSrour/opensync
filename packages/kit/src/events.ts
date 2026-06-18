export type DurableEventKind = "session.upsert" | "message.upsert" | "session.finalize";
export type SourceChangeResource = "session" | "message";
export type SourceChangeAction = "changed" | "deleted";

export type MessageRole = "user" | "assistant" | "system" | "tool" | "unknown";

export type SessionUpsertPayload = {
  externalId: string;
  title?: string;
  projectPath?: string;
  projectName?: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  sourceCreatedAt?: number;
  sourceUpdatedAt?: number;
};

export type MessageUpsertPayload = {
  sessionExternalId: string;
  externalId: string;
  role: MessageRole;
  textContent?: string;
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs?: number;
  cost?: number;
  sourceCreatedAt?: number;
  sourceUpdatedAt?: number;
};

export type DurableEvent<
  TSource extends string = string,
  TKind extends DurableEventKind = DurableEventKind,
  TPayload = unknown,
> = {
  id: string;
  version: 1;
  source: TSource;
  kind: TKind;
  createdAt: number;
  payload: TPayload;
};

export type SessionUpsertEvent<TSource extends string = string> = DurableEvent<
  TSource,
  "session.upsert",
  SessionUpsertPayload
>;
export type MessageUpsertEvent<TSource extends string = string> = DurableEvent<
  TSource,
  "message.upsert",
  MessageUpsertPayload
>;
export type OpenSyncDurableEvent<TSource extends string = string> =
  | SessionUpsertEvent<TSource>
  | MessageUpsertEvent<TSource>;

export type SourceChangeEvent<TSource extends string = string> = {
  id: string;
  version: 1;
  source: TSource;
  resource: SourceChangeResource;
  action: SourceChangeAction;
  externalId: string;
  sessionExternalId?: string;
  observedAt: number;
};

export function createDurableEvent<
  TSource extends string,
  TKind extends DurableEventKind,
  TPayload,
>(input: {
  source: TSource;
  kind: TKind;
  payload: TPayload;
  createdAt?: number;
  id?: string;
}): DurableEvent<TSource, TKind, TPayload> {
  const createdAt = input.createdAt ?? Date.now();
  return {
    id: input.id ?? `${input.source}:${input.kind}:${createdAt}:${stableEventKey(input.payload)}`,
    version: 1,
    source: input.source,
    kind: input.kind,
    createdAt,
    payload: input.payload,
  };
}

export function createSourceChangeEvent<TSource extends string>(input: {
  source: TSource;
  resource: SourceChangeResource;
  action?: SourceChangeAction;
  externalId: string;
  sessionExternalId?: string;
  observedAt?: number;
  id?: string;
}): SourceChangeEvent<TSource> {
  const observedAt = input.observedAt ?? Date.now();
  return {
    id: input.id ?? `${input.source}:${input.resource}:${input.externalId}:${observedAt}`,
    version: 1,
    source: input.source,
    resource: input.resource,
    action: input.action ?? "changed",
    externalId: input.externalId,
    sessionExternalId: input.sessionExternalId,
    observedAt,
  };
}

function stableEventKey(value: unknown): string {
  if (!value || typeof value !== "object") return String(value);
  const record = value as Record<string, unknown>;
  const key = record.externalId ?? record.sessionExternalId;
  return typeof key === "string" || typeof key === "number" ? String(key) : "event";
}
