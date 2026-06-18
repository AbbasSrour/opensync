import {
  createDurableEvent,
  type DurableEvent,
  type DurableEventKind,
  type MessageUpsertEvent,
  type SessionUpsertEvent,
} from "@opensync/kit";

export type { DurableEvent, DurableEventKind, MessageRole } from "@opensync/kit";

export type OpenCodeDurableEvent<
  TKind extends DurableEventKind = DurableEventKind,
  TPayload = unknown,
> = DurableEvent<"opencode", TKind, TPayload>;
export type OpenCodeSessionUpsertEvent = SessionUpsertEvent<"opencode">;
export type OpenCodeMessageUpsertEvent = MessageUpsertEvent<"opencode">;

export function createOpenCodeEvent<TKind extends DurableEventKind, TPayload>(input: {
  kind: TKind;
  payload: TPayload;
  createdAt?: number;
  id?: string;
}): OpenCodeDurableEvent<TKind, TPayload> {
  return createDurableEvent({
    source: "opencode",
    ...input,
  });
}
