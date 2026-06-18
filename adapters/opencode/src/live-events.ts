import { createSourceChangeEvent, type SourceChangeEvent } from "@opensync/kit";

export type OpenCodePluginEvent = {
  type?: string;
  properties?: unknown;
};

export function liveEventToSourceChanges(
  event: OpenCodePluginEvent,
): SourceChangeEvent<"opencode">[] {
  if (event.type?.startsWith("session.next.")) return sessionNextToSourceChanges(event);
  if (event.type === "message.updated") return messageUpdatedToSourceChanges(event);
  if (event.type === "message.part.updated") return messagePartUpdatedToSourceChanges(event);
  if (
    event.type !== "session.created" &&
    event.type !== "session.updated" &&
    event.type !== "session.idle"
  )
    return [];

  const props = asRecord(event.properties);
  const externalId = stringField(props, "id") ?? stringField(props, "sessionID");
  if (!externalId) return [];

  return [
    createSourceChangeEvent({
      source: "opencode",
      resource: "session",
      externalId,
      observedAt: numberField(props.time_created) ?? numberField(props.createdAt),
    }),
  ];
}

function sessionNextToSourceChanges(event: OpenCodePluginEvent): SourceChangeEvent<"opencode">[] {
  const props = asRecord(event.properties);
  const observedAt = observedAtFrom(props);
  const sessionExternalId = firstString(props, "sessionID", "sessionId", "session_id");
  const changes: SourceChangeEvent<"opencode">[] = [];

  if (sessionExternalId) {
    changes.push(
      createSourceChangeEvent({
        source: "opencode",
        resource: "session",
        externalId: sessionExternalId,
        observedAt,
      }),
    );
  }

  const messageExternalId = messageIdFromSessionNext(event.type, props);
  if (messageExternalId) {
    changes.push(
      createSourceChangeEvent({
        source: "opencode",
        resource: "message",
        externalId: messageExternalId,
        sessionExternalId,
        observedAt,
      }),
    );
  }

  return changes;
}

function messageIdFromSessionNext(
  type: string | undefined,
  props: Record<string, unknown>,
): string | undefined {
  const message = asRecord(props.message);
  const part = asRecord(props.part);
  const info = asRecord(props.info);

  if (type === "session.next.prompted" || type === "session.next.synthetic") {
    return (
      firstString(props, "messageID", "messageId", "userMessageID", "userMessageId") ??
      firstString(message, "id", "messageID", "messageId")
    );
  }

  if (type === "session.next.text.ended" || type === "session.next.step.ended") {
    return (
      firstString(props, "assistantMessageID", "assistantMessageId", "messageID", "messageId") ??
      firstString(part, "messageID", "messageId") ??
      firstString(info, "id")
    );
  }

  return firstString(
    props,
    "assistantMessageID",
    "assistantMessageId",
    "messageID",
    "messageId",
    "userMessageID",
    "userMessageId",
  );
}

function messageUpdatedToSourceChanges(
  event: OpenCodePluginEvent,
): SourceChangeEvent<"opencode">[] {
  const props = asRecord(event.properties);
  const info = asRecord(props.info);
  const externalId = stringField(info, "id");
  const sessionExternalId = stringField(info, "sessionID") ?? stringField(info, "sessionId");
  if (!externalId) return [];
  return [
    createSourceChangeEvent({
      source: "opencode",
      resource: "message",
      externalId,
      sessionExternalId,
      observedAt: observedAtFrom(info),
    }),
  ];
}

function messagePartUpdatedToSourceChanges(
  event: OpenCodePluginEvent,
): SourceChangeEvent<"opencode">[] {
  const props = asRecord(event.properties);
  const part = asRecord(props.part);
  const externalId = stringField(part, "messageID") ?? stringField(part, "messageId");
  const sessionExternalId = stringField(part, "sessionID") ?? stringField(part, "sessionId");
  if (!externalId) return [];
  return [
    createSourceChangeEvent({
      source: "opencode",
      resource: "message",
      externalId,
      sessionExternalId,
      observedAt: observedAtFrom(part),
    }),
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function firstString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringField(record, key);
    if (value) return value;
  }
  return undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function observedAtFrom(record: Record<string, unknown>): number | undefined {
  const time = asRecord(record.time);
  return (
    numberField(record.observedAt) ??
    numberField(record.time_created) ??
    numberField(record.timeCreated) ??
    numberField(record.createdAt) ??
    numberField(time.created) ??
    numberField(time.completed)
  );
}
