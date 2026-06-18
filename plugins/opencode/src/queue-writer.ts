import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { SourceChangeEvent } from "@opensync/kit";

export function defaultQueuePath(source = "opencode"): string {
  return join(homedir(), ".opensync", "queues", `${source}.jsonl`);
}

export function appendSourceChanges(
  events: SourceChangeEvent[],
  queuePath = defaultQueuePath(),
): void {
  if (events.length === 0) return;

  try {
    mkdirSync(dirname(queuePath), { recursive: true });
    appendFileSync(
      queuePath,
      `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
      "utf8",
    );
  } catch {
    // OpenCode plugin hooks must be best-effort and non-throwing.
  }
}
