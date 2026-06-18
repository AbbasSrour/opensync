import { describe, expect, it } from "vite-plus/test";
import { createDurableEvent, createSourceChangeEvent } from "../src/events.js";

describe("createDurableEvent", () => {
  it("creates versioned durable events with explicit ids", () => {
    expect(
      createDurableEvent({
        id: "event_1",
        source: "test-source",
        kind: "session.upsert",
        createdAt: 123,
        payload: { externalId: "session_1" },
      }),
    ).toEqual({
      id: "event_1",
      version: 1,
      source: "test-source",
      kind: "session.upsert",
      createdAt: 123,
      payload: { externalId: "session_1" },
    });
  });

  it("derives stable fallback ids from source, kind, timestamp, and payload key", () => {
    expect(
      createDurableEvent({
        source: "test-source",
        kind: "message.upsert",
        createdAt: 456,
        payload: { externalId: "message_1" },
      }).id,
    ).toBe("test-source:message.upsert:456:message_1");
  });
});

describe("createSourceChangeEvent", () => {
  it("creates source reference queue events", () => {
    expect(
      createSourceChangeEvent({
        source: "opencode",
        resource: "message",
        externalId: "msg_1",
        sessionExternalId: "ses_1",
        observedAt: 789,
      }),
    ).toEqual({
      id: "opencode:message:msg_1:789",
      version: 1,
      source: "opencode",
      resource: "message",
      action: "changed",
      externalId: "msg_1",
      sessionExternalId: "ses_1",
      observedAt: 789,
    });
  });
});
