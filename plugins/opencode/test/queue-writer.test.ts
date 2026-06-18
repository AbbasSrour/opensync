import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { appendSourceChanges } from "../src/queue-writer.js";

describe("appendSourceChanges", () => {
  it("appends source change events as JSONL", () => {
    const dir = mkdtempSync(join(tmpdir(), "opensync-opencode-"));
    const queuePath = join(dir, "queues", "opencode.jsonl");

    appendSourceChanges(
      [
        {
          id: "opencode:session:ses_1:100",
          version: 1,
          source: "opencode",
          resource: "session",
          action: "changed",
          externalId: "ses_1",
          observedAt: 100,
        },
      ],
      queuePath,
    );

    expect(readFileSync(queuePath, "utf8")).toBe(
      `${JSON.stringify({
        id: "opencode:session:ses_1:100",
        version: 1,
        source: "opencode",
        resource: "session",
        action: "changed",
        externalId: "ses_1",
        observedAt: 100,
      })}\n`,
    );
  });
});
