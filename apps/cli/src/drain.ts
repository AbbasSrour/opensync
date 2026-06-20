import type { OpenSyncConfig } from "./config.js";
import type { DrainDeps, DrainResult } from "./drain-core.js";
import { adapterForSource } from "./adapters.js";
import {
  appendDeadLetter,
  appendDeferred,
  readDeferredQueue,
  readOffset,
  readQueue,
  writeDeferred,
  writeOffset,
} from "./queue.js";
import type { DeferredQueueEntry } from "./queue.js";
import { requireConfig, resolveQueuedEvent, uploadEvents } from "./sync-events.js";
import { readConfig } from "./config.js";
import { drainEntries } from "./drain-core.js";

export { STALE_REFERENCE_MS } from "./drain-core.js";
export type { DrainResult, DrainDeps, DrainPlan } from "./drain-core.js";

export type DrainOptions = {
  source?: string;
  params?: Record<string, string>;
  dryRun?: boolean;
  useOffset?: boolean;
  now?: number;
};

const MAX_DEFERRED_ATTEMPTS = 5;

export async function drainQueue(options: DrainOptions = {}): Promise<DrainResult> {
  const source = options.source ?? "opencode";
  const params = options.params ?? {};
  const adapter = adapterForSource(source);
  if (!adapter) throw new Error(`Unsupported source: ${source}`);

  const fromOffset = options.useOffset ? readOffset(source) : 0;
  const queue = readQueue(source, fromOffset);
  const config = requireConfig(readConfig());

  const deps: DrainDeps = {
    resolve: (event) => resolveQueuedEvent(event, adapter, params),
    upload: (event) => {
      if (!config)
        throw new Error(
          "Not configured. Run `opensync login` or set OPENSYNC_CONVEX_URL and OPENSYNC_API_KEY.",
        );
      return uploadEvents(config, [event]);
    },
  };

  if (!options.dryRun) await drainDeferred(source, deps, options.now);

  const plan = await drainEntries(queue.entries, queue.startOffset, deps, {
    source,
    path: queue.path,
    dryRun: options.dryRun,
    now: options.now,
  });

  if (options.dryRun) return plan.result;

  if (plan.deadLetter.length > 0) appendDeadLetter(source, plan.deadLetter);
  if (plan.deferred.length > 0) appendDeferred(source, plan.deferred);

  if (options.useOffset && plan.committedOffset > queue.startOffset) {
    writeOffset(source, plan.committedOffset);
    plan.result.advancedOffset = true;
  }

  return plan.result;
}

async function drainDeferred(
  source: string,
  deps: DrainDeps,
  _now: number | undefined,
): Promise<void> {
  const queue = readDeferredQueue(source);
  if (queue.entries.length === 0) return;
  const keep: DeferredQueueEntry[] = [];
  const deadLetter: string[] = [];

  for (const entry of queue.entries) {
    if (!entry.event) {
      deadLetter.push(entry.raw);
      continue;
    }

    const attempts = entry.attempts + 1;
    if (attempts > MAX_DEFERRED_ATTEMPTS) {
      deadLetter.push(entry.raw);
      continue;
    }

    const resolved = deps.resolve(entry.event);
    if (!resolved || ("status" in resolved && resolved.status !== "ready")) {
      keep.push({ ...entry, attempts });
      continue;
    }

    const syncEvent = "status" in resolved ? resolved.event : resolved;
    const summary = await deps.upload(syncEvent);
    if (summary.failed > 0) {
      keep.push({ ...entry, attempts });
    }
  }

  if (deadLetter.length > 0) appendDeadLetter(source, deadLetter);
  writeDeferred(source, keep);
}

export function configReady(config: OpenSyncConfig): boolean {
  return Boolean(config.convexUrl && config.apiKey);
}
