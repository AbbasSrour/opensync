import type { OpenSyncConfig } from "./config.js";
import type { DrainDeps, DrainResult } from "./drain-core.js";
import { adapterForSource } from "./adapters.js";
import { appendDeadLetter, readOffset, readQueue, writeOffset } from "./queue.js";
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

  const plan = await drainEntries(queue.entries, queue.startOffset, deps, {
    source,
    path: queue.path,
    dryRun: options.dryRun,
    now: options.now,
  });

  if (options.dryRun) return plan.result;

  if (plan.deadLetter.length > 0) appendDeadLetter(source, plan.deadLetter);

  if (options.useOffset && plan.committedOffset > queue.startOffset) {
    writeOffset(source, plan.committedOffset);
    plan.result.advancedOffset = true;
  }

  return plan.result;
}

export function configReady(config: OpenSyncConfig): boolean {
  return Boolean(config.convexUrl && config.apiKey);
}
