import { describe, expect, it } from "vite-plus/test";
import {
  batchEventsToConvexPayload,
  messageEventToConvexPayload,
  sessionEventToConvexPayload,
} from "../src/transport.js";

describe("Convex sync payload mapping", () => {
  it("includes source and original createdAt for sessions", () => {
    expect(
      sessionEventToConvexPayload({
        id: "opencode:session:ses_1",
        version: 1,
        source: "opencode",
        kind: "session.upsert",
        createdAt: 999,
        payload: { externalId: "ses_1", sourceCreatedAt: 123, title: "Session" },
      }),
    ).toMatchObject({ externalId: "ses_1", source: "opencode", createdAt: 123, title: "Session" });
  });

  it("includes source and original createdAt for messages", () => {
    expect(
      messageEventToConvexPayload({
        id: "opencode:message:msg_1",
        version: 1,
        source: "opencode",
        kind: "message.upsert",
        createdAt: 999,
        payload: {
          sessionExternalId: "ses_1",
          externalId: "msg_1",
          role: "user",
          parts: [{ type: "text", content: { text: "hello" } }],
          sourceCreatedAt: 456,
        },
      }),
    ).toMatchObject({
      sessionExternalId: "ses_1",
      externalId: "msg_1",
      role: "user",
      source: "opencode",
      createdAt: 456,
      parts: [{ type: "text", content: { text: "hello" } }],
    });
  });

  it("groups batch payloads into sessions and messages", () => {
    const session = {
      id: "opencode:session:ses_1",
      version: 1 as const,
      source: "opencode" as const,
      kind: "session.upsert" as const,
      createdAt: 999,
      payload: { externalId: "ses_1", sourceCreatedAt: 123, title: "Session" },
    };
    const message = {
      id: "opencode:message:msg_1",
      version: 1 as const,
      source: "opencode" as const,
      kind: "message.upsert" as const,
      createdAt: 999,
      payload: {
        sessionExternalId: "ses_1",
        externalId: "msg_1",
        role: "assistant" as const,
        parts: [],
        sourceCreatedAt: 456,
      },
    };

    expect(batchEventsToConvexPayload([session, message])).toEqual({
      sessions: [
        {
          externalId: "ses_1",
          sourceCreatedAt: 123,
          title: "Session",
          source: "opencode",
          createdAt: 123,
        },
      ],
      messages: [
        {
          sessionExternalId: "ses_1",
          externalId: "msg_1",
          role: "assistant",
          parts: [],
          sourceCreatedAt: 456,
          source: "opencode",
          createdAt: 456,
        },
      ],
    });
  });

  it("truncates oversized message parts before upload", () => {
    const payload = messageEventToConvexPayload({
      id: "opencode:message:msg_big",
      version: 1,
      source: "opencode",
      kind: "message.upsert",
      createdAt: 999,
      payload: {
        sessionExternalId: "ses_1",
        externalId: "msg_big",
        role: "assistant",
        parts: [{ type: "text", content: { text: "x".repeat(2 * 1024 * 1024) } }],
      },
    });

    expect(Buffer.byteLength(JSON.stringify(payload.parts[0]), "utf8")).toBeLessThan(700 * 1024);
    expect(JSON.stringify(payload.parts[0])).toContain("OpenSync truncated oversized content");
  });
});
