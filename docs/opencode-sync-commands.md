# OpenSync CLI Commands

Reference for all `opencode-sync` CLI commands.

## Installation

```bash
npm install -g opencode-sync-plugin
```

## Commands

### login

Configure the plugin with your Convex URL and API Key.

```bash
opencode-sync login
```

**Prompts:**
- Convex URL (e.g., `https://your-project.convex.cloud`)
- API Key (starts with `osk_`)

**Output on success:**
- Confirmation message
- Instructions to add plugin to OpenCode config

### verify

Check that credentials and OpenCode configuration are set up correctly.

```bash
opencode-sync verify
```

**Checks:**
- Credentials exist in `~/.config/opencode-sync/config.json`
- OpenCode config exists at `~/.config/opencode/opencode.json` or `./opencode.json`
- Plugin is registered in the config

**Output:**
- Status of each check (OK or MISSING)
- Instructions to fix any issues

### logout

Clear stored credentials.

```bash
opencode-sync logout
```

Removes the API key and Convex URL from local config.

### sync

Test connectivity to the backend and create a test session.

```bash
opencode-sync sync
```

**What it does:**
- Tests the health endpoint
- Tests the sync endpoint with your API key
- Creates a test session in your OpenSync dashboard

**Output on success:**
```
  OpenSync Connectivity Test

  Testing backend health...
  Health: OK
  Response: {"status":"ok","timestamp":1234567890}

  Testing sync endpoint...
  Sync: OK
  Response: {"ok":true,"sessionId":"abc123"}

  Test session created. Check your OpenSync dashboard.
```

Use this to verify your credentials work before troubleshooting plugin issues.

### sync --new

Sync only new sessions that haven't been synced before.

```bash
opencode-sync sync --new
```

**What it does:**
- Uses local tracking file (`~/.opensync/synced-sessions.json`)
- Skips sessions that were previously synced
- Fast because it doesn't query the backend

**Output on success:**
```
  OpenSync: Syncing New Local Sessions

  Found 15 local sessions
  Found 10 in local tracking file
  Skipping 10 already synced sessions
  Will sync 5 sessions

  Syncing: New feature request... OK (4 messages)
  Syncing: Bug fix... OK (8 messages)

  Summary:
    Sessions synced: 5
    Messages synced: 32
    Skipped: 10

  Check your OpenSync dashboard to view synced sessions.
```

Use this for regular syncing after your initial import.

### sync --all

Sync all local sessions, checking the backend for existing ones.

```bash
opencode-sync sync --all
```

**What it does:**
- Queries the backend for already-synced session IDs
- Skips sessions that exist on the server
- Syncs remaining sessions and updates local tracking
- More accurate than `--new` (works across machines)

**Output on success:**
```
  OpenSync: Syncing All Local Sessions

  Found 15 local sessions
  Checking backend for existing sessions...
  Found 10 already synced on backend
  Skipping 10 already synced sessions
  Will sync 5 sessions

  Syncing: New feature request... OK (4 messages)
  Syncing: Bug fix... OK (8 messages)

  Summary:
    Sessions synced: 5
    Messages synced: 32
    Skipped: 10

  Check your OpenSync dashboard to view synced sessions.
```

Use this to sync from a new machine or verify sync status against the backend.

### sync --force

Clear tracking and resync all sessions.

```bash
opencode-sync sync --force
```

**What it does:**
- Clears the local tracking file
- Syncs all sessions regardless of previous sync status
- Updates or creates sessions on the backend

**Output on success:**
```
  OpenSync: Force Syncing Local Sessions

  Found 15 local sessions
  Will sync 15 sessions

  Syncing: What does this app do?... OK (7 messages)
  Syncing: Cooking tips... OK (3 messages)
  ...

  Summary:
    Sessions synced: 15
    Messages synced: 120

  Check your OpenSync dashboard to view synced sessions.
```

Use this to refresh all data or fix sync issues.

### status

Show current authentication status.

```bash
opencode-sync status
```

**Output:**
- Whether configured or not
- Convex URL (if set)
- Masked API Key (if set)

### config

Show current configuration details.

```bash
opencode-sync config
```

**Output:**
- Convex URL
- Masked API Key

### version

Show the installed version.

```bash
opencode-sync version
opencode-sync -v
opencode-sync --version
```

### help

Show help message with all commands.

```bash
opencode-sync help
opencode-sync -h
opencode-sync --help
```

## Setup Flow

1. Install the package globally:
   ```bash
   npm install -g opencode-sync-plugin
   ```

2. Log in with your credentials:
   ```bash
   opencode-sync login
   ```

3. Add the plugin to OpenCode config:
   ```bash
   mkdir -p ~/.config/opencode && echo '{
     "$schema": "https://opencode.ai/config.json",
     "plugin": ["opencode-sync-plugin"]
   }' > ~/.config/opencode/opencode.json
   ```

4. Verify setup:
   ```bash
   opencode-sync verify
   ```

5. Test connectivity:
   ```bash
   opencode-sync sync
   ```

6. Sync existing sessions (optional):
   ```bash
   opencode-sync sync --new    # Fast: uses local tracking
   opencode-sync sync --all    # Accurate: checks backend
   opencode-sync sync --force  # Full: resyncs everything
   ```

7. Start OpenCode:
   ```bash
   opencode
   ```

## Troubleshooting

### Reset everything

```bash
# Remove credentials
opencode-sync logout

# Clear OpenCode plugin cache
rm -rf ~/.cache/opencode/node_modules

# Reinstall
npm uninstall -g opencode-sync-plugin
npm install -g opencode-sync-plugin@latest

# Start fresh
opencode-sync login
```

### Check version

```bash
opencode-sync version
```

### Config file locations

- Credentials: `~/.opensync/credentials.json`
- Synced sessions tracking: `~/.opensync/synced-sessions.json`
- OpenCode config (global): `~/.config/opencode/opencode.json`
- OpenCode config (project): `./opencode.json`
