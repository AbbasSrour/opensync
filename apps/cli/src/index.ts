#!/usr/bin/env bun
import { daemonCommand } from "./commands/daemon.js";
import { queueCommand } from "./commands/queue.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { statusCommand } from "./commands/status.js";
import { syncCommand } from "./commands/sync.js";
import { verifyCommand } from "./commands/verify.js";

const args = process.argv.slice(2);

async function main() {
  const command = args[0];
  if (!command || command === "help" || command === "-h" || command === "--help") return help();

  if (command === "login") return loginCommand();
  if (command === "logout") return logoutCommand();
  if (command === "verify") return verifyCommand();
  if (command === "config") return statusCommand();
  if (command === "status") return statusCommand();
  if (command === "version" || command === "-v" || command === "--version") return version();
  if (command === "queue") return queueCommand(args);
  if (command === "daemon") return daemonCommand(args);
  if (command === "sync") return syncCommand(args);

  console.error(`Unknown command: ${command}`);
  help();
  process.exitCode = 1;
}

function version(): void {
  console.log("opensync 0.0.0");
}

function help() {
  console.log(`OpenSync CLI

Commands:
  opensync status
  opensync login
  opensync logout
  opensync verify
  opensync sync [connectivity test]
  opensync sync --source opencode --new [--dry-run] [adapter params...]
  opensync sync --source opencode --all [--dry-run] [--force] [--concurrency n] [adapter params...]
  opensync queue inspect [--source opencode]
  opensync queue drain [--source opencode] [--all] [--dry-run] [adapter params...]
  opensync queue flush [--source opencode]
  opensync daemon [--source opencode] [--interval ms] [adapter params...]

Examples:
  opensync sync --source opencode --all --db /path/to/opencode.db
  opensync daemon --source opencode --interval 5000 --db /path/to/opencode.db
`);
}

await main();
