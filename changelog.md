# Changelog

All notable changes to OpenSync.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] - 2026-01-17

Initial release.

### Added

#### Backend (Convex)
- Database schema with tables: users, sessions, messages, parts, sessionEmbeddings, apiLogs
- WorkOS JWT authentication configuration
- Session sync endpoints: POST /sync/session, POST /sync/message, POST /sync/batch
- Public API endpoints: GET /api/sessions, GET /api/sessions/get, GET /api/search, GET /api/context, GET /api/export, GET /api/stats
- Health check endpoint: GET /health
- Full-text search on sessions and messages via Convex search indexes
- Semantic search using OpenAI text-embedding-3-small and Convex vector indexes
- Hybrid search combining full-text and semantic results with RRF scoring
- Session export in JSON, JSONL, and Markdown formats
- RAG context retrieval endpoint for LLM integration
- API key generation and authentication (osk_ prefix)
- API access logging

#### Frontend (React)
- WorkOS AuthKit integration for login/logout
- Protected routes with auth guards
- Dashboard page with session list and search
- Session viewer with message display and tool call rendering
- Sidebar with collapsible session list
- Public session sharing via /s/:slug routes
- Settings page with usage statistics
- API key generation and management UI
- Interactive API documentation page (/docs)
- Keyboard shortcuts: Cmd+K for search, Cmd+. for sidebar toggle
- Markdown export button in session viewer
- Copy share link functionality

#### Documentation
- README with quick start guide
- SETUP.md with full deployment instructions
- API.md with endpoint reference and SDK examples
- OPENCODE-PLUGIN.md with plugin usage guide
- PRD-FEATURES.md with future feature specifications

### Technical Details

- Convex backend with real-time subscriptions
- WorkOS AuthKit for enterprise authentication
- React 18 with Vite and Tailwind CSS
- Radix UI components for dialogs and dropdowns
- Lucide React for icons
- react-markdown for message rendering
- react-syntax-highlighter for code blocks

---

## Planned Features

See [PRD-FEATURES.md](docs/PRD-FEATURES.md) and [SYNC-FOR-EVALS-PRD.md](docs/SYNC-FOR-EVALS-PRD.md) for specifications.

### Plugins (High Priority)
- opencode-sync-plugin: npm package for OpenCode CLI
- claude-code-sync: Python plugin for Claude Code

### Sync for Evals
- Mark sessions as eval-ready with notes and tags
- Export to DeepEval JSON, OpenAI Evals JSONL, Filesystem formats
- Copy-paste commands for running evals locally
- Support for Promptfoo model comparison

### Future Features
- RAG Context Library: Dedicated context search UI with saved searches
- Model Comparison Dashboard: Analytics comparing model performance
- Training Data Marketplace: Sell anonymized session data (deferred)
