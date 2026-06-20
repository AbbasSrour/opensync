import { describe, expect, it } from "vite-plus/test";
import {
  messageRecordToEvent,
  messageRowSyncStatus,
  messageRowToRecord,
  sessionRecordToEvent,
  sessionRowToRecord,
} from "../src/records.js";

describe("OpenCode record normalization", () => {
  it("maps session rows to adapter session records", () => {
    const record = sessionRowToRecord({
      id: "ses_1",
      slug: "fallback-title",
      directory: "/tmp/project-a",
      path: null,
      title: "Project session",
      model: JSON.stringify({ id: "gpt-5.1", providerID: "openai" }),
      cost: 0.12,
      tokens_input: 10,
      tokens_output: 20,
      time_created: 1000,
      time_updated: 2000,
    });

    expect(record).toEqual({
      source: "opencode",
      externalId: "ses_1",
      title: "Project session",
      projectPath: "/tmp/project-a",
      projectName: "project-a",
      model: "gpt-5.1",
      provider: "openai",
      promptTokens: 10,
      completionTokens: 20,
      cost: 0.12,
      sourceCreatedAt: 1000,
      sourceUpdatedAt: 2000,
    });
  });

  it("maps message rows and ordered text parts to adapter message records", () => {
    const record = messageRowToRecord(
      {
        id: "msg_1",
        session_id: "ses_1",
        time_created: 1000,
        time_updated: 1500,
        data: JSON.stringify({
          role: "assistant",
          modelID: "claude-sonnet-4",
          providerID: "anthropic",
          cost: 0.05,
          tokens: { input: 4, output: 8 },
          time: { created: 1100, completed: 1600 },
        }),
      },
      [
        {
          id: "part_b",
          message_id: "msg_1",
          session_id: "ses_1",
          time_created: 1200,
          data: JSON.stringify({ type: "text", text: "world" }),
        },
        {
          id: "part_a",
          message_id: "msg_1",
          session_id: "ses_1",
          time_created: 1100,
          data: JSON.stringify({ type: "text", text: "hello " }),
        },
      ],
    );

    expect(record).toEqual({
      source: "opencode",
      sessionExternalId: "ses_1",
      externalId: "msg_1",
      role: "assistant",
      parts: [
        { type: "text", content: { text: "hello " } },
        { type: "text", content: { text: "world" } },
      ],
      model: "claude-sonnet-4",
      provider: "anthropic",
      promptTokens: 4,
      completionTokens: 8,
      durationMs: 500,
      cost: 0.05,
      sourceCreatedAt: 1100,
      sourceUpdatedAt: 1500,
    });
  });

  it("splits opencode tool parts into canonical tool-call and tool-result parts", () => {
    const record = messageRowToRecord(
      {
        id: "msg_tool",
        session_id: "ses_1",
        time_created: 1000,
        data: JSON.stringify({ role: "assistant" }),
      },
      [
        {
          id: "part_tool",
          message_id: "msg_tool",
          session_id: "ses_1",
          time_created: 1000,
          data: JSON.stringify({
            type: "tool",
            tool: "bash",
            callID: "call_1",
            state: { status: "completed", input: { command: "ls" }, output: "file.txt" },
          }),
        },
      ],
    );

    expect(record.parts).toEqual([
      { type: "tool-call", content: { callId: "call_1", name: "bash", args: { command: "ls" } } },
      {
        type: "tool-result",
        content: { callId: "call_1", name: "bash", result: "file.txt", isError: false },
      },
    ]);
  });

  it("preserves unknown opencode part types losslessly", () => {
    const record = messageRowToRecord(
      {
        id: "msg_x",
        session_id: "ses_1",
        time_created: 1000,
        data: JSON.stringify({ role: "assistant" }),
      },
      [
        {
          id: "part_x",
          message_id: "msg_x",
          session_id: "ses_1",
          time_created: 1000,
          data: JSON.stringify({ type: "compaction", foo: "bar" }),
        },
      ],
    );

    expect(record.parts).toEqual([
      { type: "unknown", content: { type: "compaction", foo: "bar" } },
    ]);
  });

  it("uses source message creation time instead of local sync time", () => {
    const record = messageRowToRecord({
      id: "msg_old",
      session_id: "ses_1",
      time_created: 10,
      data: JSON.stringify({ role: "user", time: { created: 1234 } }),
    });

    expect(record.sourceCreatedAt).toBe(1234);
  });

  it("marks assistant messages without completion time as incomplete", () => {
    expect(
      messageRowSyncStatus({
        id: "msg_in_progress",
        session_id: "ses_1",
        time_created: 1000,
        data: JSON.stringify({
          role: "assistant",
          modelID: "gpt-5.5",
          providerID: "openai",
          time: { created: 1000 },
        }),
      }),
    ).toBe("incomplete");
  });

  it("marks completed assistant messages as ready even without usage", () => {
    expect(
      messageRowSyncStatus({
        id: "msg_failed",
        session_id: "ses_1",
        time_created: 1000,
        data: JSON.stringify({
          role: "assistant",
          error: { message: "stopped" },
          time: { created: 1000, completed: 1100 },
        }),
      }),
    ).toBe("ready");
  });

  it("infers unknown roles from text content", () => {
    const record = messageRowToRecord(
      {
        id: "msg_unknown",
        session_id: "ses_1",
        time_created: 1,
        data: JSON.stringify({ role: "unknown" }),
      },
      [
        {
          id: "part_1",
          message_id: "msg_unknown",
          session_id: "ses_1",
          time_created: 1,
          data: JSON.stringify({ type: "text", text: "Can you fix this?" }),
        },
      ],
    );

    expect(record.role).toBe("user");
  });

  it("converts adapter records to OpenSync sync events", () => {
    expect(
      sessionRecordToEvent({ source: "opencode", externalId: "ses_1", sourceCreatedAt: 1 }),
    ).toMatchObject({
      id: "opencode:session:ses_1",
      kind: "session.upsert",
      createdAt: 1,
      payload: { externalId: "ses_1" },
    });

    expect(
      messageRecordToEvent({
        source: "opencode",
        sessionExternalId: "ses_1",
        externalId: "msg_1",
        role: "user",
        parts: [],
        sourceCreatedAt: 2,
      }),
    ).toMatchObject({
      id: "opencode:message:msg_1",
      kind: "message.upsert",
      createdAt: 2,
      payload: { sessionExternalId: "ses_1", externalId: "msg_1" },
    });
  });
});
