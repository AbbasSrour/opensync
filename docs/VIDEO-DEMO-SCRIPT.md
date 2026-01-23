# OpenSync Video Demo Script

Video talking points for a short demo of OpenSync.

## Opening hook (10 seconds)

"OpenSync syncs your AI coding sessions from OpenCode and Claude Code to a single dashboard. Search past conversations, track token spend, and export datasets for evals. Open source. Self-hostable. Your data, your control."

## What problem does it solve (15 seconds)

- AI coding sessions vanish when you close the terminal
- No visibility into token spend or cost across projects
- Searching old conversations for context means digging through files
- Building eval datasets from real coding sessions takes manual work
- Most sync tools lock your data in their cloud

## Core value props (before features)

### Privacy first

- Self-host the entire stack on your own Convex instance
- Fork the repo and customize everything
- Delete individual sessions or wipe your entire account anytime

### Open source

- MIT licensed
- Full access to schema, API, and frontend code
- No vendor lock in

## Quick feature walkthrough

### 1. Login flow

- WorkOS authentication with GitHub, Google, or email
- Generate an API key in Settings for plugin access

### 2. Dashboard overview

- Total sessions, tokens, cost displayed at a glance
- Usage charts by model and project over 30 days
- Recent sessions with quick access

### 3. Sessions view

- Source badges show OC (OpenCode) or CC (Claude Code) origin
- Sort by date, tokens, cost, or duration
- Filter by model, provider, or project
- Click any session to view the full conversation with tool calls and code blocks

### 4. Search

- Full text search matches exact keywords
- Semantic search finds related concepts using OpenAI embeddings
- Hybrid search combines both methods for better results

### 5. Evals tab

- Mark sessions as eval ready with one click
- Add notes and tags for organization
- Export in DeepEval JSON, OpenAI JSONL, or plain text formats

### 6. Analytics

- Model comparison with token and cost breakdowns
- Project table showing usage per codebase
- Efficiency metrics like cost per session and tokens per message

### 7. Context API

- REST endpoint at `/api/context` for RAG pipelines
- Returns relevant session content formatted for LLM context injection
- Use your past coding sessions as context for future prompts

### 8. Delete your data

- Delete individual sessions from the dashboard
- Delete your entire account and all data in Settings
- No data retention after deletion

### 9. Fork and self-host

- Clone the repo from GitHub
- Deploy your own Convex backend
- Point the plugins at your instance
- Full control over your data and infrastructure

## Closing CTA (15 seconds)

"Install the plugin, start syncing. Fork the repo if you want full control."

For OpenCode:

```bash
npm install -g opencode-sync-plugin
opencode-sync login
```

For Claude Code:

```bash
npm install -g claude-code-sync
claude-code-sync login
```

To self-host:

```bash
git clone https://github.com/waynesutton/opensync.git
cd opensync
npm install
npx convex dev
```

## Demo order

1. **Login page** - Sign in with GitHub or email
2. **Dashboard overview** - Show real sessions, stats, charts
3. **Sessions tab** - Click a session to open the viewer, show source badges (OC vs CC)
4. **Session viewer** - Scroll through messages, show tool calls and code blocks
5. **Context page** - Run a quick search, show semantic results
6. **Evals tab** - Mark a session as eval ready, show export options
7. **Analytics tab** - Scroll through model comparison and project breakdown
8. **Settings page** - Show API key generation
9. **Settings page** - Show the Delete Account button, explain full data wipe
10. **GitHub repo** - Show the fork button, mention self-hosting with Convex and WorkOS

This order flows from daily usage to power features to data ownership. Ends on the self-host message so viewers remember they own their data.
