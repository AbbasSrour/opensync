import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readConfig } from "../config.js";
import { health } from "../transport.js";

export async function verifyCommand(): Promise<void> {
  const config = readConfig();
  let failed = false;
  if (!config.convexUrl || !config.apiKey) {
    console.log("Credentials: missing");
    failed = true;
  } else {
    const result = await health({ convexUrl: config.convexUrl });
    console.log(`Credentials: ${result.ok ? "ok" : `failed (${result.error})`}`);
    failed ||= !result.ok;
  }

  const plugin = findOpenCodePluginConfig();
  console.log(`OpenCode plugin config: ${plugin.ok ? `ok (${plugin.path})` : plugin.reason}`);
  failed ||= !plugin.ok;
  if (failed) process.exitCode = 1;
}

function findOpenCodePluginConfig(): { ok: true; path: string } | { ok: false; reason: string } {
  const paths = [
    join(homedir(), ".config", "opencode", "opencode.json"),
    join(homedir(), ".config", "opencode", "opencode.jsonc"),
    join(process.cwd(), "opencode.json"),
    join(process.cwd(), "opencode.jsonc"),
  ];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    if (content.includes("@opensync/opencode")) return { ok: true, path };
  }
  return { ok: false, reason: "missing @opensync/opencode in opencode.json/jsonc" };
}
