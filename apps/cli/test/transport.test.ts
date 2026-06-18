import { describe, expect, it } from "vite-plus/test";
import { messageEventToConvexPayload, sessionEventToConvexPayload } from "../src/transport.js";

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
          sourceCreatedAt: 456,
        },
      }),
    ).toMatchObject({
      sessionExternalId: "ses_1",
      externalId: "msg_1",
      role: "user",
      source: "opencode",
      createdAt: 456,
    });
  });
});
