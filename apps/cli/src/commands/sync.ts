import {
  messageRecordToEvent,
  resolveOpenCodeDbPath,
  sessionRecordToEvent,
} from "@opensync/adapter-opencode";
import { adapterForSource } from "../adapters.js";
import { adapterParams, hasFlag, optionValue } from "../args.js";
import { readConfig } from "../config.js";
import { requireConfig, uploadEvents } from "../sync-events.js";
import { addSyncedSessions, clearSyncedSessions, getSyncedSessions } from "../tracking.js";
import { health, listBackendSessionIds, syncSession } from "../transport.js";

export async function syncCommand(args: string[]): Promise<void> {
  const source = optionValue(args, "--source") ?? "opencode";
  const all = hasFlag(args, "--all");
  const syncNew = hasFlag(args, "--new");
  const dryRun = hasFlag(args, "--dry-run");
  const force = hasFlag(args, "--force");
  const adapter = adapterForSource(source);

  if (!all && !syncNew && !force) return connectivityTest();

  if (!adapter) {
    console.error("Only `opensync sync --source opencode --all` is implemented right now.");
    process.exitCode = 1;
    return;
  }

  const params = adapterParams(args, ["--source", "--all", "--new", "--dry-run", "--force"]);
  const sessions = adapter.listSessions({ params });
  const config = requireConfig(readConfig());
  if (force && !dryRun) clearSyncedSessions();
  const existing = syncNew
    ? getSyncedSessions()
    : !dryRun && config && !force
      ? await listBackendSessionIds(config)
      : new Set<string>();
  const sessionsToSync = sessions.filter((session) => force || !existing.has(session.externalId));
  const sessionIds = new Set(sessionsToSync.map((session) => session.externalId));
  const messages = adapter
    .listMessages(undefined, { params })
    .filter((message) => sessionIds.has(message.sessionExternalId));
  const events = [...sessions.map(sessionRecordToEvent), ...messages.map(messageRecordToEvent)];

  console.log(`${adapter.source} input: ${resolveOpenCodeDbPath(params.db)}`);
  console.log(`Normalized events: ${events.length}`);
  console.log(`  sessions: ${sessionsToSync.length}`);
  console.log(`  messages: ${messages.length}`);
  console.log(`  skipped sessions: ${sessions.length - sessionsToSync.length}`);

  if (dryRun) return;
  if (!config) {
    console.error(
      "Not configured. Run `opensync login` or set OPENSYNC_CONVEX_URL and OPENSYNC_API_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  const result = await uploadEvents(config, [
    ...sessionsToSync.map(sessionRecordToEvent),
    ...messages.map(messageRecordToEvent),
  ]);
  if (result.failed === 0) addSyncedSessions(sessionsToSync.map((session) => session.externalId));
  console.log(`Uploaded sessions: ${result.sessions}`);
  console.log(`Uploaded messages: ${result.messages}`);
  if (result.failed > 0) {
    console.log(`Failed uploads: ${result.failed}`);
    process.exitCode = 1;
  }
}

async function connectivityTest(): Promise<void> {
  const config = requireConfig(readConfig());
  if (!config) {
    console.error(
      "Not configured. Run `opensync login` or set OPENSYNC_CONVEX_URL and OPENSYNC_API_KEY.",
    );
    process.exitCode = 1;
    return;
  }
  const healthResult = await health(config);
  if (!healthResult.ok) {
    console.error(`Health check failed: ${healthResult.error}`);
    process.exitCode = 1;
    return;
  }
  const testId = `test-${Date.now()}`;
  const syncResult = await syncSession(config, {
    id: `opensync:test:${testId}`,
    version: 1,
    source: "opencode",
    kind: "session.upsert",
    createdAt: Date.now(),
    payload: {
      externalId: testId,
      title: "CLI Sync Test",
      projectPath: process.cwd(),
      projectName: process.cwd().split("/").pop(),
      model: "test",
      provider: "opensync-cli",
      promptTokens: 0,
      completionTokens: 0,
      cost: 0,
    },
  });
  if (!syncResult.ok) {
    console.error(`Sync test failed: ${syncResult.error}`);
    process.exitCode = 1;
    return;
  }
  console.log("Connectivity test passed.");
}
