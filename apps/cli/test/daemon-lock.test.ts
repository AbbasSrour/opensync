import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { acquireDaemonLock, daemonLockPath, type LockInfo } from "../src/daemon-lock.js";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "opensync-lock-test-"));
  path = join(dir, "daemon.lock");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const alive = () => true;
const dead = () => false;

function writeLock(info: LockInfo): void {
  writeFileSync(path, JSON.stringify(info), "utf8");
}

describe("acquireDaemonLock", () => {
  it("acquires when no lock exists and writes pid + startedAt", () => {
    const result = acquireDaemonLock("opencode", { path, now: 1000, isAlive: dead });
    expect(result.acquired).toBe(true);
    const written = JSON.parse(readFileSync(path, "utf8")) as LockInfo;
    expect(written.pid).toBe(process.pid);
    expect(written.startedAt).toBe(1000);
  });

  it("fails to acquire when a live holder owns the lock", () => {
    writeLock({ pid: 4242, startedAt: 1000 });
    const result = acquireDaemonLock("opencode", { path, now: 2000, isAlive: alive });
    expect(result.acquired).toBe(false);
    if (!result.acquired) expect(result.holder?.pid).toBe(4242);
  });

  it("reclaims a lock whose holder pid is dead", () => {
    writeLock({ pid: 4242, startedAt: 1000 });
    const result = acquireDaemonLock("opencode", { path, now: 2000, isAlive: dead });
    expect(result.acquired).toBe(true);
    const written = JSON.parse(readFileSync(path, "utf8")) as LockInfo;
    expect(written.pid).toBe(process.pid);
  });

  it("reclaims a lock that is older than staleMs even if the pid is alive", () => {
    writeLock({ pid: 4242, startedAt: 0 });
    const result = acquireDaemonLock("opencode", {
      path,
      now: 10_000,
      staleMs: 5_000,
      isAlive: alive,
    });
    expect(result.acquired).toBe(true);
  });

  it("reclaims a corrupt lock file", () => {
    writeFileSync(path, "not-json", "utf8");
    const result = acquireDaemonLock("opencode", { path, now: 1000, isAlive: alive });
    expect(result.acquired).toBe(true);
  });

  it("release removes the lock so a later daemon can acquire", () => {
    const first = acquireDaemonLock("opencode", { path, now: 1000, isAlive: dead });
    expect(first.acquired).toBe(true);
    if (first.acquired) first.release();
    expect(existsSync(path)).toBe(false);

    const second = acquireDaemonLock("opencode", { path, now: 2000, isAlive: alive });
    expect(second.acquired).toBe(true);
  });

  it("release does not delete the lock once another owner has reclaimed it", () => {
    const first = acquireDaemonLock("opencode", { path, now: 1000, isAlive: dead });
    expect(first.acquired).toBe(true);
    // Simulate another daemon reclaiming the lock (different pid) before our
    // exit handler runs.
    writeLock({ pid: process.pid + 1, startedAt: 5000 });
    if (first.acquired) first.release();
    expect(existsSync(path)).toBe(true);
    const holder = JSON.parse(readFileSync(path, "utf8")) as LockInfo;
    expect(holder.pid).toBe(process.pid + 1);
  });
});

describe("daemonLockPath", () => {
  it("is per-source and lives in the OS temp dir", () => {
    expect(daemonLockPath("opencode")).toBe(join(tmpdir(), "opensync-daemon-opencode.lock"));
    expect(daemonLockPath("claude")).toBe(join(tmpdir(), "opensync-daemon-claude.lock"));
  });
});
