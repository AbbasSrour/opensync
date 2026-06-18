import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeConfig } from "../config.js";
import { health } from "../transport.js";

export async function loginCommand(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    const convexUrl = (
      await rl.question("Convex URL (https://...convex.cloud or .convex.site): ")
    ).trim();
    if (!convexUrl.includes(".convex.cloud") && !convexUrl.includes(".convex.site")) {
      console.error("Invalid Convex URL. Expected .convex.cloud or .convex.site");
      process.exitCode = 1;
      return;
    }
    const apiKey = (await rl.question("OpenSync API key (starts with osk_): ")).trim();
    if (!apiKey.startsWith("osk_")) {
      console.error("Invalid API key. Expected prefix osk_");
      process.exitCode = 1;
      return;
    }
    const result = await health({ convexUrl });
    if (!result.ok) {
      console.error(`Health check failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }
    writeConfig({ convexUrl, apiKey });
    console.log("Login successful.");
    console.log('OpenCode config should include: { "plugin": ["@opensync/opencode"] }');
  } finally {
    rl.close();
  }
}
