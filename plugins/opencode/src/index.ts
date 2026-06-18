import { spawn } from "node:child_process";
import type { Plugin } from "@opencode-ai/plugin";
import type { SourceChangeEvent } from "@opensync/kit";
import { liveEventToSourceChanges } from "@opensync/adapter-opencode";
import { appendSourceChanges } from "./queue-writer.js";

const messageTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingMessages = new Map<string, SourceChangeEvent<"opencode">>();
const debounceMs = 800;
// Minimum gap between daemon spawn attempts. The daemon idle-exits when there's
// no work, so we re-trigger autostart on activity to self-heal that gap. Most
// attempts just hit the live lock and exit instantly; this throttle only avoids
// pointless process churn on bursts of events.
const daemonRespawnThrottleMs = 30_000;
let shutdownHooked = false;
let lastDaemonSpawnAt = 0;

export const OpenSyncOpenCodePlugin: Plugin = async () => {
  registerShutdownFlush();
  ensureDaemonRunning();
  return {
    event: async ({ event }) => {
      try {
        enqueueChanges(liveEventToSourceChanges(event));
        // Re-ensure a daemon is running on activity so sync resumes after an
        // idle-exit. Throttled and deduped by the daemon's own lock.
        ensureDaemonRunning();
      } catch {
        // Keep OpenCode unaffected if OpenSync observation fails.
      }
    },
  };
};

export default OpenSyncOpenCodePlugin;

// Best-effort autostart of the drain daemon. The daemon's own single-instance
// lock makes this safe to call from every OpenCode window: only one daemon
// survives, the rest exit immediately. Must never throw or block OpenCode, so
// failures (missing binary, spawn errors) are swallowed.
function ensureDaemonRunning(): void {
  const now = Date.now();
  if (now - lastDaemonSpawnAt < daemonRespawnThrottleMs) return;
  lastDaemonSpawnAt = now;
  try {
    const child = spawn("opensync", ["daemon", "--source", "opencode"], {
      detached: true,
      stdio: "ignore",
    });
    // Don't let the spawned daemon keep this OpenCode process alive, and ignore
    // spawn errors (e.g. `opensync` not on PATH) without surfacing them.
    child.on("error", () => {});
    child.unref();
  } catch {
    // Never affect OpenCode if autostart fails.
  }
}

function registerShutdownFlush(): void {
  if (shutdownHooked) return;
  shutdownHooked = true;
  // Only hook `exit` (synchronous, fires on graceful host shutdown). Avoid
  // registering signal listeners so OpenCode's own SIGINT/SIGTERM handling and
  // default termination behavior remain unaffected. appendSourceChanges uses
  // synchronous writes, which is required inside an `exit` handler.
  process.once("exit", flushPendingMessages);
}

function flushPendingMessages(): void {
  if (pendingMessages.size === 0) return;
  const pending = [...pendingMessages.values()];
  pendingMessages.clear();
  for (const timer of messageTimers.values()) clearTimeout(timer);
  messageTimers.clear();
  appendSourceChanges(pending);
}

function enqueueChanges(events: SourceChangeEvent<"opencode">[]): void {
  const immediate: SourceChangeEvent<"opencode">[] = [];
  for (const event of events) {
    if (event.resource === "session") {
      immediate.push(event);
      continue;
    }
    pendingMessages.set(event.externalId, event);
    const existing = messageTimers.get(event.externalId);
    if (existing) clearTimeout(existing);
    messageTimers.set(
      event.externalId,
      setTimeout(() => {
        const pending = pendingMessages.get(event.externalId);
        pendingMessages.delete(event.externalId);
        messageTimers.delete(event.externalId);
        if (pending) appendSourceChanges([pending]);
      }, debounceMs),
    );
  }
  appendSourceChanges(immediate);
}
