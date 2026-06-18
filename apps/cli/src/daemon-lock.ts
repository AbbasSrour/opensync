import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Single-instance guard for the drain daemon. The lock lives in the OS temp dir
// (wiped on reboot, which removes the worst pid-reuse window for free). The lock
// guarantee is enforced here — in the process that advances the queue offset —
// so it holds no matter how many OpenCode windows spawn a daemon, or whether one
// is started by hand.

export type LockInfo = { pid: number; startedAt: number };

export type AcquireResult =
  | { acquired: true; release: () => void }
  | { acquired: false; holder: LockInfo | null };

export type AcquireOptions = {
  path?: string;
  now?: number;
  // A lock held this long is treated as stale even if its pid still resolves, as
  // a backstop against pid reuse leaving sync permanently blocked. Generous on
  // purpose: a real daemon idle-exits long before this, and a reboot clears the
  // tmp lock anyway.
  staleMs?: number;
  // Pid liveness probe. Injected so tests can simulate dead/live holders without
  // real processes or signals.
  isAlive?: (pid: number) => boolean;
};

const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;

export function daemonLockPath(source = "opencode"): string {
  return join(tmpdir(), `opensync-daemon-${source}.lock`);
}

export function acquireDaemonLock(
  source = "opencode",
  options: AcquireOptions = {},
): AcquireResult {
  const path = options.path ?? daemonLockPath(source);
  const now = options.now ?? Date.now();
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const isAlive = options.isAlive ?? defaultIsAlive;

  // Try once, then once more after reclaiming a stale lock. A second failure
  // means a live holder won the race in between, so we yield to it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const written = tryCreate(path, now);
    if (written) return { acquired: true, release: () => releaseIfOwner(path, written.pid) };

    const holder = readHolder(path);
    if (holder && isAlive(holder.pid) && now - holder.startedAt < staleMs) {
      return { acquired: false, holder };
    }

    // Dead holder, unreadable lock, or implausibly old: reclaim and retry.
    removeQuietly(path);
  }

  return { acquired: false, holder: readHolder(path) };
}

function tryCreate(path: string, now: number): LockInfo | null {
  const info: LockInfo = { pid: process.pid, startedAt: now };
  try {
    // O_EXCL: fails if the lock already exists, making creation atomic.
    writeFileSync(path, JSON.stringify(info), { encoding: "utf8", flag: "wx" });
    return info;
  } catch {
    return null;
  }
}

function readHolder(path: string): LockInfo | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<LockInfo>;
    if (typeof parsed.pid === "number" && typeof parsed.startedAt === "number") {
      return { pid: parsed.pid, startedAt: parsed.startedAt };
    }
  } catch {
    // Missing or corrupt lock: treat as no holder so the caller reclaims it.
  }
  return null;
}

// Only delete the lock if we still own it. Guards the case where this process
// was considered stale and another daemon reclaimed the lock before our exit
// handler ran — we must not delete the new owner's lock.
function releaseIfOwner(path: string, ownPid: number): void {
  const holder = readHolder(path);
  if (holder && holder.pid !== ownPid) return;
  removeQuietly(path);
}

function removeQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Already gone or not permitted; nothing actionable.
  }
}

function defaultIsAlive(pid: number): boolean {
  try {
    // Signal 0 performs existence/permission checks without delivering a signal.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but is owned by someone else: still alive.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
