import { describe, expect, it } from "vite-plus/test";
import { liveEventToSourceChanges } from "../src/live-events.js";

describe("OpenCode live event source references", () => {
  it("maps session events to source change references", () => {
    const events = liveEventToSourceChanges({
      type: "session.created",
      properties: {
        id: "ses_live",
        createdAt: 500,
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "opencode:session:ses_live:500",
      version: 1,
      source: "opencode",
      resource: "session",
      action: "changed",
      externalId: "ses_live",
      observedAt: 500,
    });
  });

  it("ignores unsupported events", () => {
    expect(liveEventToSourceChanges({ type: "session.next.text.ended", properties: {} })).toEqual(
      [],
    );
  });

  it("maps message updated events to source change references", () => {
    expect(
      liveEventToSourceChanges({
        type: "message.updated",
        properties: { info: { id: "msg_1", sessionID: "ses_1", time: { created: 123 } } },
      }),
    ).toEqual([
      {
        id: "opencode:message:msg_1:123",
        version: 1,
        source: "opencode",
        resource: "message",
        action: "changed",
        externalId: "msg_1",
        sessionExternalId: "ses_1",
        observedAt: 123,
      },
    ]);
  });

  it("maps message part updated events to message source references", () => {
    expect(
      liveEventToSourceChanges({
        type: "message.part.updated",
        properties: { part: { messageID: "msg_1", sessionID: "ses_1", time_created: 456 } },
      }),
    ).toMatchObject([
      { resource: "message", externalId: "msg_1", sessionExternalId: "ses_1", observedAt: 456 },
    ]);
  });

  it("maps session.next.prompted to session and user message references", () => {
    expect(
      liveEventToSourceChanges({
        type: "session.next.prompted",
        properties: {
          sessionID: "ses_next",
          userMessageID: "msg_user",
          time: { created: 1000 },
        },
      }),
    ).toMatchObject([
      { resource: "session", externalId: "ses_next", observedAt: 1000 },
      {
        resource: "message",
        externalId: "msg_user",
        sessionExternalId: "ses_next",
        observedAt: 1000,
      },
    ]);
  });

  it("maps session.next.synthetic to session and synthetic message references", () => {
    expect(
      liveEventToSourceChanges({
        type: "session.next.synthetic",
        properties: {
          sessionId: "ses_next",
          message: { id: "msg_synthetic" },
          createdAt: 1100,
        },
      }),
    ).toMatchObject([
      { resource: "session", externalId: "ses_next", observedAt: 1100 },
      {
        resource: "message",
        externalId: "msg_synthetic",
        sessionExternalId: "ses_next",
        observedAt: 1100,
      },
    ]);
  });

  it("maps session.next.text.ended to assistant message references", () => {
    expect(
      liveEventToSourceChanges({
        type: "session.next.text.ended",
        properties: {
          sessionID: "ses_next",
          assistantMessageID: "msg_assistant",
          time_created: 1200,
        },
      }),
    ).toMatchObject([
      { resource: "session", externalId: "ses_next", observedAt: 1200 },
      {
        resource: "message",
        externalId: "msg_assistant",
        sessionExternalId: "ses_next",
        observedAt: 1200,
      },
    ]);
  });

  it("maps session.next.step.ended to assistant message references", () => {
    expect(
      liveEventToSourceChanges({
        type: "session.next.step.ended",
        properties: {
          sessionID: "ses_next",
          assistantMessageId: "msg_assistant",
          time: { completed: 1300 },
        },
      }),
    ).toMatchObject([
      { resource: "session", externalId: "ses_next", observedAt: 1300 },
      {
        resource: "message",
        externalId: "msg_assistant",
        sessionExternalId: "ses_next",
        observedAt: 1300,
      },
    ]);
  });

  it("maps session.next.step.started to a session reference when no message id exists", () => {
    expect(
      liveEventToSourceChanges({
        type: "session.next.step.started",
        properties: { sessionID: "ses_next", createdAt: 1400 },
      }),
    ).toMatchObject([{ resource: "session", externalId: "ses_next", observedAt: 1400 }]);
  });
});
