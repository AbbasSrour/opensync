import {
  messageRecordToEvent,
  resolveOpenCodeDbPath,
  sessionRecordToEvent,
} from "@opensync/adapter-opencode";
import { adapterForSource } from "../adapters.js";
import { adapterParams, hasFlag, optionValue } from "../args.js";
import { readConfig } from "../config.js";
import { requireConfig, uploadSessionUnits, type SessionUnit } from "../sync-events.js";
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

  const concurrency = parseConcurrency(optionValue(args, "--concurrency"));
  const params = adapterParams(args, [
    "--source",
    "--all",
    "--new",
    "--dry-run",
    "--force",
    "--concurrency",
  ]);
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

  const messagesBySession = new Map<string, typeof messages>();
  for (const message of messages) {
    const existing = messagesBySession.get(message.sessionExternalId) ?? [];
    existing.push(message);
    messagesBySession.set(message.sessionExternalId, existing);
  }
  const units: SessionUnit[] = sessionsToSync.map((session) => ({
    externalId: session.externalId,
    events: [
      sessionRecordToEvent(session),
      ...(messagesBySession.get(session.externalId) ?? []).map(messageRecordToEvent),
    ],
  }));

  const result = await uploadSessionUnits(config, units, {
    concurrency,
    onProgress: (done, total) => {
      process.stdout.write(`\rUploading sessions: ${done}/${total}`);
      if (done === total) process.stdout.write("\n");
    },
  });
  // Track only sessions that fully uploaded (session record + all its messages),
  // so a single failed message never marks the whole session as synced.
  if (result.syncedSessionIds.length > 0) addSyncedSessions(result.syncedSessionIds);
  console.log(`Uploaded sessions: ${result.sessions}`);
  console.log(`Uploaded messages: ${result.messages}`);
  if (result.failed > 0) {
    console.log(`Failed uploads: ${result.failed}`);
    process.exitCode = 1;
  }
}

const DEFAULT_CONCURRENCY = 8;

function parseConcurrency(value: string | undefined): number {
  if (value === undefined) return DEFAULT_CONCURRENCY;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error(`Invalid --concurrency "${value}"; using ${DEFAULT_CONCURRENCY}.`);
    return DEFAULT_CONCURRENCY;
  }
  return parsed;
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
