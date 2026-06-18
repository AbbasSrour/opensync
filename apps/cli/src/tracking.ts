import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { opensyncDir } from "./config.js";

const syncedSessionsFile = join(opensyncDir, "synced-sessions.json");

export function getSyncedSessions(): Set<string> {
  if (!existsSync(syncedSessionsFile)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(syncedSessionsFile, "utf8")) as { sessionIds?: unknown };
    return new Set(
      Array.isArray(parsed.sessionIds)
        ? parsed.sessionIds.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function addSyncedSessions(sessionIds: string[]): void {
  const existing = getSyncedSessions();
  for (const id of sessionIds) existing.add(id);
  mkdirSync(opensyncDir, { recursive: true });
  writeFileSync(
    syncedSessionsFile,
    JSON.stringify({ sessionIds: [...existing], lastUpdated: Date.now() }, null, 2),
    "utf8",
  );
}

export function clearSyncedSessions(): void {
  mkdirSync(opensyncDir, { recursive: true });
  writeFileSync(
    syncedSessionsFile,
    JSON.stringify({ sessionIds: [], lastUpdated: Date.now() }, null, 2),
    "utf8",
  );
}
