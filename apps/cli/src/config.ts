import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type OpenSyncConfig = {
  convexUrl?: string;
  apiKey?: string;
};

export const opensyncDir = join(homedir(), ".opensync");
export const queueDir = join(opensyncDir, "queues");
export const stateDir = join(opensyncDir, "state");
export const configFile = join(opensyncDir, "config.json");
const legacyCredentialsFile = join(opensyncDir, "credentials.json");

export function readConfig(): OpenSyncConfig {
  const fileConfig = readFileConfig();
  return {
    convexUrl: process.env.OPENSYNC_CONVEX_URL ?? fileConfig.convexUrl,
    apiKey: process.env.OPENSYNC_API_KEY ?? fileConfig.apiKey,
  };
}

export function writeConfig(config: Required<OpenSyncConfig>): void {
  mkdirSync(opensyncDir, { recursive: true });
  writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
}

export function clearConfig(): void {
  mkdirSync(opensyncDir, { recursive: true });
  writeFileSync(configFile, "{}", "utf8");
}

export function toSiteUrl(convexUrl: string): string {
  return convexUrl.replace(".convex.cloud", ".convex.site");
}

function readFileConfig(): OpenSyncConfig {
  const path = existsSync(configFile) ? configFile : legacyCredentialsFile;
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as OpenSyncConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
