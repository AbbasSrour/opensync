import { describe, expect, it } from "vite-plus/test";
import type { SourceChangeEvent } from "@opensync/kit";
import { drainEntries, STALE_REFERENCE_MS, type DrainDeps } from "../src/drain-core.js";
import type { QueueEntry } from "../src/queue.js";
import type { SyncEvent, UploadSummary } from "../src/sync-events.js";

const NOW = 1_000_000;

function sessionRef(externalId: string, observedAt = NOW): SourceChangeEvent {
  return {
    id: `opencode:session:${externalId}:${observedAt}`,
    version: 1,
    source: "opencode",
    resource: "session",
    action: "changed",
    externalId,
    observedAt,
  };
}

function entry(event: SourceChangeEvent | null, endOffset: number, raw = "raw"): QueueEntry {
  return { raw, event, endOffset };
}

function sessionEvent(externalId: string): SyncEvent {
  return {
    id: `opencode:session:${externalId}`,
    version: 1,
    source: "opencode",
    kind: "session.upsert",
    createdAt: NOW,
    payload: { externalId },
  };
}

// Resolve any session ref whose externalId is in `present`; everything else is missing.
function deps(present: Set<string>, uploadResults?: Map<string, UploadSummary>): DrainDeps {
  return {
    resolve: (event) => (present.has(event.externalId) ? sessionEvent(event.externalId) : null),
    upload: (event) =>
      Promise.resolve(
        uploadResults?.get(event.payload.externalId) ?? { sessions: 1, messages: 0, failed: 0 },
      ),
  };
}

function incompleteDeps(incomplete: Set<string>, present = new Set<string>()): DrainDeps {
  return {
    resolve: (event) =>
      incomplete.has(event.externalId)
        ? { status: "incomplete" }
        : present.has(event.externalId)
          ? { status: "ready", event: sessionEvent(event.externalId) }
          : { status: "missing" },
    upload: () => Promise.resolve({ sessions: 1, messages: 0, failed: 0 }),
  };
}

const ctx = { source: "opencode", path: "/tmp/q.jsonl", now: NOW };

describe("drainEntries", () => {
  it("commits all resolved references in order and advances to the last offset", async () => {
    const entries = [
      entry(sessionRef("a"), 10),
      entry(sessionRef("b"), 20),
      entry(sessionRef("c"), 30),
    ];
    const plan = await drainEntries(entries, 0, deps(new Set(["a", "b", "c"])), ctx);

    expect(plan.result.resolved).toBe(3);
    expect(plan.result.sessions).toBe(3);
    expect(plan.result.uploaded).toEqual({ sessions: 3, messages: 0, failed: 0 });
    expect(plan.committedOffset).toBe(30);
    expect(plan.deadLetter).toHaveLength(0);
  });

  it("stops at a failed upload without advancing past it", async () => {
    const entries = [
      entry(sessionRef("a"), 10),
      entry(sessionRef("b"), 20),
      entry(sessionRef("c"), 30),
    ];
    const failOnB = new Map<string, UploadSummary>([
      ["b", { sessions: 0, messages: 0, failed: 1 }],
    ]);
    const plan = await drainEntries(entries, 0, deps(new Set(["a", "b", "c"]), failOnB), ctx);

    expect(plan.result.uploaded).toEqual({ sessions: 1, messages: 0, failed: 1 });
    // Only "a" committed; "b" failed so offset stops at a's endOffset.
    expect(plan.committedOffset).toBe(10);
    expect(plan.result.resolved).toBe(1);
  });

  it("blocks on a fresh missing reference so it is retried later", async () => {
    const entries = [
      entry(sessionRef("a"), 10),
      entry(sessionRef("missing", NOW - 1_000), 20), // fresh: within stale window
      entry(sessionRef("c"), 30),
    ];
    const plan = await drainEntries(entries, 0, deps(new Set(["a", "c"])), ctx);

    expect(plan.result.resolved).toBe(1); // only "a"
    expect(plan.result.missing).toBe(1);
    expect(plan.result.deadLettered).toBe(0);
    expect(plan.committedOffset).toBe(10); // stops at the fresh-missing ref
    expect(plan.deadLetter).toHaveLength(0);
  });

  it("dead-letters a stale missing reference and continues", async () => {
    const stale = sessionRef("gone", NOW - STALE_REFERENCE_MS - 1);
    const entries = [entry(stale, 10, "stale-raw"), entry(sessionRef("c"), 20)];
    const plan = await drainEntries(entries, 0, deps(new Set(["c"])), ctx);

    expect(plan.result.missing).toBe(1);
    expect(plan.result.deadLettered).toBe(1);
    expect(plan.deadLetter).toEqual(["stale-raw"]);
    expect(plan.result.resolved).toBe(1); // "c" still processed after skipping stale
    expect(plan.committedOffset).toBe(20);
  });

  it("dead-letters malformed entries and keeps committing", async () => {
    const entries = [entry(null, 10, "bad-json"), entry(sessionRef("c"), 20)];
    const plan = await drainEntries(entries, 0, deps(new Set(["c"])), ctx);

    expect(plan.result.malformed).toBe(1);
    expect(plan.deadLetter).toEqual(["bad-json"]);
    expect(plan.result.resolved).toBe(1);
    expect(plan.committedOffset).toBe(20);
  });

  it("defers incomplete references and keeps advancing the main queue", async () => {
    const entries = [
      entry(sessionRef("a"), 10),
      entry(sessionRef("streaming"), 20, "streaming-raw"),
      entry(sessionRef("c"), 30),
    ];
    const plan = await drainEntries(
      entries,
      0,
      incompleteDeps(new Set(["streaming"]), new Set(["a", "c"])),
      ctx,
    );

    expect(plan.result.resolved).toBe(2);
    expect(plan.result.incomplete).toBe(1);
    expect(plan.deferred).toEqual(["streaming-raw"]);
    expect(plan.committedOffset).toBe(30);
  });

  it("dry run reports counts without uploading or advancing", async () => {
    let uploads = 0;
    const dryDeps: DrainDeps = {
      resolve: (event) => (event.externalId === "a" ? sessionEvent("a") : null),
      upload: () => {
        uploads++;
        return Promise.resolve({ sessions: 1, messages: 0, failed: 0 });
      },
    };
    const entries = [
      entry(sessionRef("a"), 10),
      entry(null, 20, "bad"),
      entry(sessionRef("missing"), 30),
    ];
    const plan = await drainEntries(entries, 5, dryDeps, { ...ctx, dryRun: true });

    expect(uploads).toBe(0);
    expect(plan.result.resolved).toBe(1);
    expect(plan.result.malformed).toBe(1);
    expect(plan.result.missing).toBe(1);
    expect(plan.committedOffset).toBe(5); // unchanged
    expect(plan.deadLetter).toHaveLength(0);
  });

  it("preserves the prior offset when the first entry blocks", async () => {
    const entries = [entry(sessionRef("missing", NOW), 100)];
    const plan = await drainEntries(entries, 64, deps(new Set()), ctx);

    expect(plan.committedOffset).toBe(64);
    expect(plan.result.missing).toBe(1);
  });
});
