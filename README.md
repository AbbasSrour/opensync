# OpenSync

Sync, search, and share your AI coding sessions. Built with Convex.

```
   ____                   _____                 
  / __ \                 / ____|                
 | |  | |_ __   ___ _ __| (___  _   _ _ __   ___ 
 | |  | | '_ \ / _ \ '_ \\___ \| | | | '_ \ / __|
 | |__| | |_) |  __/ | | |___) | |_| | | | | (__ 
  \____/| .__/ \___|_| |_|____/ \__, |_| |_|\___|
        | |                      __/ |          
        |_|                     |___/           
```

## What is this?

OpenSync stores your AI coding sessions from OpenCode and Claude Code in the cloud:

- **Automatic sync** as you code with OpenCode or Claude Code
- **Full-text search** across all sessions
- **Semantic search** to find sessions by meaning
- **Public sharing** with one click
- **API access** for context engineering and integrations
- **Usage stats** including tokens, cost, time
- **Eval exports** for DeepEval, OpenAI Evals, and Promptfoo (coming soon)

## Quick Start

### 1. Deploy Your Backend

```bash
# Clone the repo
git clone https://github.com/waynesutton/opensync.git
cd opensync

# Install dependencies
npm install

# Deploy to Convex
npx convex dev
```

See [SETUP.md](docs/SETUP.md) for detailed instructions.

### 2. Install a Plugin

**For OpenCode:**

```bash
npm install -g opencode-sync-plugin
opencode-sync login
```

Then add to your `opencode.json`:

```json
{
  "plugin": ["opencode-sync-plugin"]
}
```

**For Claude Code:**

```bash
/plugin install yourusername/claude-code-sync
```

Or configure via `~/.claude-code-sync.json`:

```json
{
  "convex_url": "https://your-deployment.convex.cloud",
  "auto_sync": true
}
```

### 3. Start Coding

Your sessions sync automatically from either tool.

## Features

| Feature | Description |
|---------|-------------|
| Auto Sync | Sessions sync in real-time as you work |
| Full-Text Search | Search by keywords across all sessions |
| Semantic Search | Search by meaning using vector embeddings |
| Hybrid Search | Combines full-text and semantic for best results |
| Public Sharing | Share sessions with a single click (`/s/:slug`) |
| Markdown Export | Download sessions as Markdown files |
| API Access | Secure API for external integrations (API key auth) |
| Usage Stats | Track tokens, cost, time per session and overall |
| RAG Support | Built-in retrieval for context engineering |
| Session Management | View, search, and delete sessions |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│    OpenCode     │────▶│ opencode-sync   │──┐
│    (CLI)        │     │    plugin       │  │
└─────────────────┘     └─────────────────┘  │     ┌─────────────────┐
                                             ├────▶│   Convex        │
┌─────────────────┐     ┌─────────────────┐  │     │   (Backend)     │
│  Claude Code    │────▶│ claude-code-sync│──┘     └─────────────────┘
│    (CLI)        │     │    plugin       │                │
└─────────────────┘     └─────────────────┘                │
                                              ┌────────────┼────────────┐
                                              ▼            ▼            ▼
                                       ┌──────────┐ ┌──────────┐ ┌──────────┐
                                       │  Web UI  │ │ API      │ │ OpenAI   │
                                       │  (React) │ │ (/api/*) │ │ Embed    │
                                       └──────────┘ └──────────┘ └──────────┘
```

## API Endpoints

All endpoints require authentication via Bearer token (JWT or API key).

### Sync Endpoints (for plugin)

| Endpoint | Description |
|----------|-------------|
| `POST /sync/session` | Sync a session |
| `POST /sync/message` | Sync a message |
| `POST /sync/batch` | Batch sync sessions and messages |

### Public API

| Endpoint | Description |
|----------|-------------|
| `GET /api/sessions` | List all sessions |
| `GET /api/sessions/get?id=` | Get session with messages |
| `GET /api/search?q=&type=` | Search (fulltext/semantic/hybrid) |
| `GET /api/context?q=` | Get relevant context for LLM |
| `GET /api/export?id=&format=` | Export session (json/markdown/jsonl) |
| `GET /api/stats` | Get usage statistics |
| `GET /health` | Health check (no auth required) |

Generate an API key in Settings to use these endpoints.

## Project Structure

```
opensync/                # This repo - Convex backend + React UI
├── convex/              # Convex functions
│   ├── schema.ts        # Database schema
│   ├── sessions.ts      # Session queries/mutations
│   ├── messages.ts      # Message mutations
│   ├── search.ts        # Full-text and semantic search
│   ├── embeddings.ts    # Vector embedding generation
│   ├── http.ts          # HTTP endpoints (sync + API)
│   ├── api.ts           # Secure API functions
│   └── rag.ts           # RAG retrieval functions
├── src/                 # React frontend
│   ├── pages/           # Login, Dashboard, Settings, Docs, PublicSession
│   ├── components/      # Header, Sidebar, SessionViewer
│   └── lib/             # Auth utilities
└── docs/                # Documentation

opencode-sync-plugin/    # Separate repo - npm package for OpenCode
├── src/
│   ├── index.ts         # Plugin hooks
│   └── cli.ts           # CLI commands
└── README.md

claude-code-sync/        # Separate repo - Claude Code plugin
├── src/
│   ├── plugin.py        # Plugin hooks
│   └── config.py        # Configuration
└── README.md
```

## Documentation

- [Setup Guide](docs/SETUP.md) - Full deployment instructions
- [API Reference](docs/API.md) - API endpoint documentation
- [OpenCode Plugin](docs/OPENCODE-PLUGIN.md) - OpenCode plugin installation
- [Claude Code Plugin](docs/CLAUDE-CODE-PLUGIN.md) - Claude Code plugin installation
- [Sync for Evals PRD](docs/SYNC-FOR-EVALS-PRD.md) - Eval export feature specification
- `/docs` route in the web app provides interactive API documentation

## Tech Stack

- **Backend**: [Convex](https://convex.dev) - Real-time database with built-in search
- **Auth**: [WorkOS](https://workos.com) - Enterprise authentication
- **Frontend**: React + Vite + Tailwind
- **Embeddings**: OpenAI text-embedding-3-small

## Resources

- [Convex Documentation](https://docs.convex.dev)
- [Convex Vector Search](https://docs.convex.dev/search/vector-search)
- [Convex Full-Text Search](https://docs.convex.dev/search/text-search)
- [WorkOS User Management](https://workos.com/docs/user-management)

## License

MIT
