# codex-sync is now available for OpenAI Codex CLI users

If you use OpenAI's Codex CLI, you can now sync your coding sessions to OpenSync.

## What it does

codex-sync watches your Codex CLI sessions and sends them to your OpenSync dashboard. You get:

- Session history across all your projects
- Token usage tracking (input, output, cached, reasoning)
- Tool call logs (shell commands, file operations)
- Cost estimates per session
- Search across your entire session history

All your data goes to your own Convex deployment. Nothing gets stored on third party servers.

## Install

```bash
npm install -g codex-sync
```

## Setup (takes about 2 minutes)

1. Log into OpenSync and go to Settings
2. Click Generate API Key and copy it
3. Run the setup:

```bash
codex-sync login
codex-sync setup
codex-sync verify
```

That's it. Your sessions sync automatically from here.

## Links

| Resource | Link |
|----------|------|
| npm package | [npmjs.com/package/codex-sync](https://www.npmjs.com/package/codex-sync) |
| GitHub repo | [github.com/waynesutton/codex-sync-plugin](https://github.com/waynesutton/codex-sync-plugin) |
| OpenSync dashboard | [opensync.dev](https://www.opensync.dev) |
| Full docs | [opensync.dev/docs](https://www.opensync.dev/docs) |

## Other sync plugins

codex-sync joins the existing plugins for other AI coding tools:

| Plugin | Tool | npm |
|--------|------|-----|
| claude-code-sync | Claude Code | [npm](https://www.npmjs.com/package/claude-code-sync) |
| opencode-sync-plugin | OpenCode | [npm](https://www.npmjs.com/package/opencode-sync-plugin) |
| droid-sync | Factory Droid | [npm](https://www.npmjs.com/package/droid-sync) |
| codex-sync | Codex CLI | [npm](https://www.npmjs.com/package/codex-sync) |

## Questions or issues?

Open an issue on the [codex-sync repo](https://github.com/waynesutton/codex-sync-plugin/issues) or drop a comment here.
