import { adapterParams, optionValue } from "../args.js";
import { readConfig } from "../config.js";
import { acquireDaemonLock } from "../daemon-lock.js";
import { configReady, drainQueue } from "../drain.js";

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export async function daemonCommand(args: string[]): Promise<void> {
  const source = optionValue(args, "--source") ?? "opencode";
  const intervalMs = Number(optionValue(args, "--interval") ?? "5000");
  // After this long with nothing to drain, the daemon releases its lock and
  // exits so an idle process never lingers once all OpenCode windows are gone.
  // `0` disables idle-exit (run until terminated).
  const idleTimeoutMs = Number(
    optionValue(args, "--idle-timeout") ?? String(DEFAULT_IDLE_TIMEOUT_MS),
  );
  const params = adapterParams(args, ["--source", "--interval", "--idle-timeout"]);

  if (!configReady(readConfig())) {
    console.error(
      "Not configured. Run `opensync login` or set OPENSYNC_CONVEX_URL and OPENSYNC_API_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  // Single-instance guard: if another daemon already holds the lock we exit
  // immediately. This is what makes it safe for every OpenCode window to spawn a
  // daemon — only one wins, the rest bow out here.
  const lock = acquireDaemonLock(source);
  if (!lock.acquired) {
    const holderPid = lock.holder?.pid;
    console.log(
      `OpenSync daemon already running for source=${source}${holderPid ? ` (pid ${holderPid})` : ""}; exiting.`,
    );
    return;
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    lock.release();
  };

  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // Backstop for any other exit path (uncaught error, manual exit). The
  // pid-based reclaim in acquireDaemonLock covers crashes/SIGKILL where this
  // never runs, so a leftover lock can never permanently block sync.
  process.once("exit", release);

  console.log(
    `OpenSync daemon started for source=${source}, interval=${intervalMs}ms, idleTimeout=${idleTimeoutMs}ms`,
  );

  let idleSince: number | null = null;

  while (running) {
    try {
      const result = await drainQueue({ source, params, useOffset: true });
      const didWork = Boolean(
        result.uploaded &&
        (result.uploaded.sessions > 0 ||
          result.uploaded.messages > 0 ||
          result.uploaded.failed > 0),
      );
      if (didWork) {
        idleSince = null;
        console.log(
          `[${new Date().toISOString()}] uploaded sessions=${result.uploaded?.sessions} messages=${result.uploaded?.messages} failed=${result.uploaded?.failed} missing=${result.missing} malformed=${result.malformed}`,
        );
      } else if (idleTimeoutMs > 0) {
        const now = Date.now();
        if (idleSince === null) idleSince = now;
        else if (now - idleSince >= idleTimeoutMs) {
          console.log(`[${new Date().toISOString()}] idle for ${idleTimeoutMs}ms; exiting.`);
          break;
        }
      }
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] drain error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (running) await delay(intervalMs);
  }

  release();
  console.log("OpenSync daemon stopped.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
