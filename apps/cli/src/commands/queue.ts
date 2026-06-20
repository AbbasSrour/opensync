import { adapterParams, optionValue } from "../args.js";
import { drainQueue } from "../drain.js";
import { flushQueue, inspectQueue } from "../queue.js";

export function queueCommand(args: string[]): void | Promise<void> {
  const subcommand = args[1];
  if (subcommand === "inspect") return inspect(args);
  if (subcommand === "drain") return drain(args);
  if (subcommand === "flush") return flush(args);

  console.error("Unknown queue command. Use `queue inspect`, `queue drain`, or `queue flush`.");
  process.exitCode = 1;
}

function inspect(args: string[]): void {
  const source = optionValue(args, "--source") ?? "opencode";
  console.log(JSON.stringify(inspectQueue(source), null, 2));
}

function flush(args: string[]): void {
  const source = optionValue(args, "--source") ?? "opencode";
  const result = flushQueue(source);
  console.log(`${source} queue ${result.existed ? "flushed" : "already empty"}: ${result.path}`);
}

async function drain(args: string[]): Promise<void> {
  const source = optionValue(args, "--source") ?? "opencode";
  const dryRun = args.includes("--dry-run");
  const useOffset = !args.includes("--all");
  const params = adapterParams(args, ["--source", "--dry-run", "--all"]);

  try {
    const result = await drainQueue({ source, params, dryRun, useOffset });
    console.log(`${result.source} queue: ${result.path}`);
    console.log(`Queued references: ${result.queued}`);
    console.log(`Resolved events: ${result.resolved}`);
    console.log(`  sessions: ${result.sessions}`);
    console.log(`  messages: ${result.messages}`);
    console.log(`  missing: ${result.missing}`);
    console.log(`  incomplete: ${result.incomplete}`);
    console.log(`  malformed: ${result.malformed}`);
    console.log(`  dead-lettered: ${result.deadLettered}`);

    if (result.uploaded) {
      console.log(`Uploaded sessions: ${result.uploaded.sessions}`);
      console.log(`Uploaded messages: ${result.uploaded.messages}`);
      if (result.uploaded.failed > 0) {
        console.log(`Failed uploads: ${result.uploaded.failed}`);
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
