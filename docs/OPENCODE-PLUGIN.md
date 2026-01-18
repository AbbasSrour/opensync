# OpenCode Sync Plugin

Sync your OpenCode sessions to the OpenSync dashboard.

Published on npm: [opencode-sync-plugin](https://www.npmjs.com/package/opencode-sync-plugin)

## Installation

```bash
npm install -g opencode-sync-plugin
```

## Authentication

```bash
opencode-sync login
```

Enter when prompted:
- **Convex URL**: Your deployment URL (e.g., `https://your-project-123.convex.cloud`)
- **API Key**: Your API key from Settings page (starts with `osk_`)

No browser authentication required.

### Getting Your API Key

1. Log into your OpenSync dashboard
2. Go to **Settings**
3. Click **Generate API Key**
4. Copy the key (starts with `osk_`)

## Configuration

Add the plugin to your project's `opencode.json`:

```json
{
  "plugin": ["opencode-sync-plugin"]
}
```

Or add globally at `~/.config/opencode/opencode.json`.

## Usage

Start an OpenCode session and your sessions sync automatically.

### CLI Commands

| Command | Description |
|---------|-------------|
| `opencode-sync login` | Configure with Convex URL and API Key |
| `opencode-sync verify` | Verify credentials and OpenCode config |
| `opencode-sync sync` | Test connectivity and create a test session |
| `opencode-sync sync --new` | Sync only new sessions (uses local tracking) |
| `opencode-sync sync --all` | Sync all sessions (queries backend, skips existing) |
| `opencode-sync sync --force` | Clear tracking and resync all sessions |
| `opencode-sync logout` | Clear stored credentials |
| `opencode-sync status` | Show authentication status |
| `opencode-sync config` | Show current configuration |
| `opencode-sync version` | Show installed version |
| `opencode-sync help` | Show help message |

## What Gets Synced

| Data | Description |
|------|-------------|
| Session metadata | Project name, directory, git branch, timestamps |
| Messages | User prompts and assistant responses |
| Tool calls | Which tools were used and their outcomes |
| Token usage | Input and output token counts |
| Model info | Which model was used |
| Cost | Estimated cost per session |

## Configuration Storage

Credentials are stored at:

```
~/.opensync/
  credentials.json      # Convex URL, API Key
  synced-sessions.json  # Local tracking for sync --new
```

## URL Format

The plugin accepts both URL formats:
- `https://your-project.convex.cloud` (dashboard URL)
- `https://your-project.convex.site` (HTTP endpoint URL)

The plugin automatically normalizes to `.site` for API calls.

## Troubleshooting

### Plugin not syncing

1. Verify authentication: `opencode-sync status`
2. Check the plugin is in `opencode.json`
3. Check Convex dashboard logs for errors

### "Invalid API key" errors

1. Go to OpenSync Settings
2. Generate a new API key
3. Run `opencode-sync login` with the new key

### Sessions not appearing in dashboard

1. Wait a few seconds for sync to complete
2. Refresh the OpenSync dashboard
3. Check your user account matches between plugin and dashboard

## Related

- [OpenSync Setup Guide](./SETUP.md) - Deploy your own OpenSync instance
- [API Reference](./API.md) - Access your sessions programmatically
- [Plugin Auth PRD](./PLUGIN-AUTH-PRD.md) - Authentication specification
