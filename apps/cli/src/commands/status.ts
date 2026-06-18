import { readConfig, toSiteUrl } from "../config.js";

export function statusCommand(): void {
  const config = readConfig();
  console.log("OpenSync status");
  console.log(`  Convex URL: ${config.convexUrl ? config.convexUrl : "missing"}`);
  console.log(`  Site URL: ${config.convexUrl ? toSiteUrl(config.convexUrl) : "missing"}`);
  console.log(`  API key: ${config.apiKey ? mask(config.apiKey) : "missing"}`);
}

function mask(value: string): string {
  return value.length <= 12 ? "***" : `${value.slice(0, 8)}...${value.slice(-4)}`;
}
