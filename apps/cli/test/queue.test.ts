import { describe, expect, it } from "vite-plus/test";
import { parseQueueBuffer } from "../src/queue.js";

const validLine = JSON.stringify({
  id: "opencode:session:ses_1:1",
  version: 1,
  source: "opencode",
  resource: "session",
  action: "changed",
  externalId: "ses_1",
  observedAt: 1,
});

describe("parseQueueBuffer", () => {
  it("parses valid events and marks malformed lines with null events", () => {
    const content = `${validLine}\nnot-json\n{"version":2}\n`;
    const result = parseQueueBuffer(Buffer.from(content, "utf8"));
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]?.event?.externalId).toBe("ses_1");
    expect(result.entries[1]?.event).toBeNull();
    expect(result.entries[2]?.event).toBeNull();
    expect(result.endOffset).toBe(Buffer.byteLength(content, "utf8"));
  });

  it("only reads content after the provided byte offset", () => {
    const first = `${validLine}\n`;
    const content = first + `${validLine}\n`;
    const startOffset = Buffer.byteLength(first, "utf8");
    const result = parseQueueBuffer(Buffer.from(content, "utf8"), startOffset);
    expect(result.entries).toHaveLength(1);
    expect(result.startOffset).toBe(startOffset);
    expect(result.endOffset).toBe(Buffer.byteLength(content, "utf8"));
  });

  it("tracks byte-accurate end offsets across multibyte characters", () => {
    const multibyte = JSON.stringify({
      id: "opencode:session:café:1",
      version: 1,
      source: "opencode",
      resource: "session",
      action: "changed",
      externalId: "café",
      observedAt: 1,
    });
    const content = `${multibyte}\n${validLine}\n`;
    const result = parseQueueBuffer(Buffer.from(content, "utf8"));
    expect(result.entries[0]?.endOffset).toBe(Buffer.byteLength(`${multibyte}\n`, "utf8"));
    expect(result.entries[1]?.endOffset).toBe(Buffer.byteLength(content, "utf8"));
  });

  it("excludes a trailing partial line without a newline", () => {
    const content = `${validLine}\n${validLine}`;
    const result = parseQueueBuffer(Buffer.from(content, "utf8"));
    expect(result.entries).toHaveLength(1);
    expect(result.endOffset).toBe(Buffer.byteLength(`${validLine}\n`, "utf8"));
  });
});
