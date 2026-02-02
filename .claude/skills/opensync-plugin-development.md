# OpenSync Plugin Development Skill

This skill provides guidance for building OpenSync plugins that sync AI coding sessions from various CLI tools.

## When to Use This Skill

Use this skill when:

- Building a new OpenSync plugin for a CLI tool
- Debugging plugin sync issues
- Understanding the OpenSync API and schema
- Adding features to existing plugins

## Quick Reference

### Plugin Source Identifiers

| Plugin           | Source ID     | Status |
| ---------------- | ------------- | ------ |
| codex-sync       | `codex-cli`   | Active |
| claude-code-sync | `claude-code` | Active |
| opencode-sync    | `opencode`    | Active |
| cursor-cli-sync  | `cursor`      | Active |

### API Endpoints

```
POST /sync/session   - Create/update session
POST /sync/message   - Create/update message
POST /sync/batch     - Batch operations
GET  /health         - Health check
```

### URL Conversion

```typescript
// User enters: https://my-app.convex.cloud
// Convert to:  https://my-app.convex.site
const httpUrl = convexUrl.replace(".convex.cloud", ".convex.site");
```

## Building a New Plugin

### Step 1: Project Structure

Create this folder structure:

```
my-plugin-sync/
├── src/
│   ├── cli.ts      # CLI entry point with commands
│   ├── client.ts   # API client for OpenSync
│   ├── config.ts   # Configuration management
│   ├── types.ts    # TypeScript interfaces
│   └── index.ts    # Exports
├── package.json
├── tsconfig.json
└── README.md
```

### Step 2: Package Configuration

```json
{
  "name": "my-plugin-sync",
  "version": "1.0.0",
  "bin": { "my-plugin-sync": "dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

### Step 3: Define Types

```typescript
// src/types.ts
export interface SyncSessionData {
  externalId: string;
  source: string;
  title?: string;
  projectPath?: string;
  model?: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  durationMs?: number;
}

export interface SyncMessageData {
  sessionExternalId: string;
  externalId: string;
  role: "user" | "assistant" | "system" | "tool" | "unknown";
  textContent?: string;
  model?: string;
  source?: string;
  parts?: Array<{ type: string; content: unknown }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Step 4: Implement Config Module

```typescript
// src/config.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".my-plugin-sync");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface Config {
  convexUrl?: string;
  apiKey?: string;
}

export function loadConfig(): Config {
  try {
    return fs.existsSync(CONFIG_FILE)
      ? JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
      : {};
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
}
```

### Step 5: Implement API Client

```typescript
// src/client.ts
import * as https from "https";
import { URL } from "url";
import { loadConfig } from "./config";
import type { SyncSessionData, ApiResponse } from "./types";

function normalizeUrl(url: string): string {
  return url.replace(".convex.cloud", ".convex.site");
}

async function request<T>(
  endpoint: string,
  method: string,
  data?: unknown,
): Promise<ApiResponse<T>> {
  const config = loadConfig();
  if (!config.convexUrl || !config.apiKey) {
    return { success: false, error: "Not configured" };
  }

  const url = new URL(endpoint, normalizeUrl(config.convexUrl));

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve(
              res.statusCode! < 300
                ? { success: true, data: parsed }
                : {
                    success: false,
                    error: parsed.error || `HTTP ${res.statusCode}`,
                  },
            );
          } catch {
            resolve({ success: false, error: "Invalid response" });
          }
        });
      },
    );

    req.on("error", (e) => resolve({ success: false, error: e.message }));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

export const testConnection = () => request("/health", "GET");
export const syncSession = (data: SyncSessionData) =>
  request("/sync/session", "POST", data);
```

### Step 6: Implement CLI

```typescript
#!/usr/bin/env node
// src/cli.ts
import * as readline from "readline";
import { loadConfig, saveConfig, clearConfig } from "./config";
import { testConnection, syncSession } from "./client";

const args = process.argv.slice(2);
const command = args[0];

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function login() {
  const convexUrl = await prompt("Convex URL: ");
  const apiKey = await prompt("API Key: ");
  saveConfig({ convexUrl, apiKey });

  const result = await testConnection();
  console.log(result.success ? "Connected!" : `Error: ${result.error}`);
}

async function status() {
  const config = loadConfig();
  if (!config.convexUrl || !config.apiKey) {
    console.log("Not configured. Run: my-plugin-sync login");
    return;
  }

  const result = await testConnection();
  console.log(
    result.success ? "Connected to OpenSync" : `Error: ${result.error}`,
  );
}

function logout() {
  clearConfig();
  console.log("Logged out");
}

// Main
switch (command) {
  case "login":
    login();
    break;
  case "status":
    status();
    break;
  case "logout":
    logout();
    break;
  default:
    console.log("Commands: login, status, logout, sync");
}
```

## Session Data Transformation

### From Codex CLI Format

```typescript
function transformCodexSession(codex: CodexSession): SyncSessionData {
  return {
    externalId: codex.id,
    source: "codex-cli",
    title: codex.messages[0]?.content.slice(0, 100),
    model: codex.model,
    provider: "openai",
    promptTokens: codex.tokenUsage.input,
    completionTokens: codex.tokenUsage.output,
    cost: calculateCost(codex.model, codex.tokenUsage),
  };
}
```

### Cost Calculation

```typescript
const PRICING = {
  "gpt-4o": { input: 2.5, output: 10.0 },
  "claude-3-5-sonnet": { input: 3.0, output: 15.0 },
  default: { input: 2.5, output: 10.0 },
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const prices = PRICING[model] || PRICING["default"];
  return (
    (inputTokens / 1_000_000) * prices.input +
    (outputTokens / 1_000_000) * prices.output
  );
}
```

## Debugging Tips

### Check Configuration

```bash
cat ~/.my-plugin-sync/config.json
```

### Test Connection

```bash
curl -H "Authorization: Bearer osk_xxx" https://your-app.convex.site/health
```

### Common Errors

| Error                      | Cause                             | Fix                                    |
| -------------------------- | --------------------------------- | -------------------------------------- |
| "Invalid API key format"   | API key doesn't start with `osk_` | Check API key                          |
| "Invalid or expired token" | Wrong API key                     | Regenerate in dashboard                |
| Connection refused         | Wrong URL                         | Use `.convex.site` not `.convex.cloud` |

## Database Schema

### Sessions Table (key fields)

```typescript
{
  externalId: string,       // Required: your plugin's session ID
  source: string,           // Required: your plugin identifier
  promptTokens: number,     // Required: input tokens
  completionTokens: number, // Required: output tokens
  cost: number,             // Required: USD cost
  title: string,            // Optional: session title
  model: string,            // Optional: model name
  provider: string,         // Optional: provider name
  durationMs: number,       // Optional: duration in ms
}
```

### Messages Table (key fields)

```typescript
{
  sessionExternalId: string, // Required: links to session
  externalId: string,        // Required: unique message ID
  role: string,              // Required: user/assistant/system/tool/unknown
  textContent: string,       // Optional: message content
  model: string,             // Optional: model for this message
}
```

## Integration Patterns

### Hook-Based (Codex CLI style)

```typescript
// CLI tool calls your plugin when sessions end
export function handleSessionEnd(sessionData: unknown) {
  const session = transformSession(sessionData);
  syncSession(session);
}
```

### File-Based (Claude Code style)

```typescript
// Watch for session files
import { watch } from "fs";

watch(sessionsDir, (event, filename) => {
  if (filename.endsWith(".json")) {
    const data = readFileSync(join(sessionsDir, filename));
    syncSession(transformSession(JSON.parse(data)));
  }
});
```

### Polling-Based

```typescript
// Poll for new sessions periodically
setInterval(async () => {
  const sessions = await getNewSessions();
  for (const session of sessions) {
    await syncSession(transformSession(session));
  }
}, 60000);
```

## Publishing Checklist

1. Update version in `package.json`
2. Update `changelog.md`
3. Run `npm run build`
4. Test locally with `npm link`
5. Publish with `npm publish`
6. Create GitHub release
