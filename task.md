# Tasks

Current development tasks and feature backlog for OpenSync.

OpenSync supports two AI coding tools: **OpenCode** and **Claude Code**.

## Completed

- [x] Database schema design (users, sessions, messages, parts, embeddings)
- [x] WorkOS AuthKit integration
- [x] Session sync endpoints (POST /sync/session, /message, /batch)
- [x] Public API endpoints (sessions, search, export, stats)
- [x] Full-text search on sessions and messages
- [x] Semantic search with vector embeddings
- [x] Hybrid search with RRF scoring
- [x] Dashboard with session list and viewer
- [x] Public session sharing (/s/:slug)
- [x] Settings page with usage stats
- [x] API key generation and management
- [x] Interactive docs page
- [x] Markdown export
- [x] README and documentation

## In Progress

None currently.

## Backlog

### High Priority (Plugins)

- [ ] opencode-sync-plugin (npm package for OpenCode CLI)
  - [ ] Session lifecycle hooks
  - [ ] CLI commands (login, status, sync)
  - [ ] Config file support
- [ ] claude-code-sync plugin (Python plugin for Claude Code)
  - [ ] Event hooks (SessionStart, UserPromptSubmit, PostToolUse, SessionEnd)
  - [ ] Config file (~/.claude-code-sync.json)
  - [ ] Slash commands (/sync-status, /sync-now)
- [ ] Add source field to sessions schema (opencode vs claude-code)

### High Priority (Core)

- [ ] Session delete confirmation modal
- [ ] Search results highlighting
- [ ] Pagination for large session lists
- [ ] Source filtering in session list (OpenCode / Claude Code / All)

### Medium Priority (Sync for Evals)

See [SYNC-FOR-EVALS-PRD.md](docs/SYNC-FOR-EVALS-PRD.md) for full specification.

- [ ] Schema: Add evalReady, reviewedAt, evalNotes, evalTags fields
- [ ] EvalReadyToggle component in session detail
- [ ] Evals page with eval-ready session list
- [ ] EvalExportModal with format selection
- [ ] Export formats:
  - [ ] DeepEval JSON
  - [ ] OpenAI Evals JSONL
  - [ ] Filesystem (plain text files)
- [ ] WhatsNextPanel with copy-paste commands
- [ ] convex/evals.ts functions

### Medium Priority (RAG Context Library)

- [ ] Dedicated context search page (/context)
- [ ] Token budget controls
- [ ] Saved searches / bookmarks
- [ ] Copy format options (plain, markdown, XML tags)

### Low Priority (Analytics)

- [ ] Model Comparison Dashboard
  - [ ] Analytics overview with date range
  - [ ] Usage charts by model
  - [ ] Model comparison table
  - [ ] Efficiency metrics (tokens per message, cost per 1K tokens)

### Low Priority (Marketplace)

Deferred. See [PRD-FEATURES.md](docs/PRD-FEATURES.md).

- [ ] Listing creation wizard
- [ ] Anonymization utilities
- [ ] Marketplace browser
- [ ] Payment integration (Stripe)

### Tech Debt

- [ ] Add error boundaries to pages
- [ ] Add loading skeletons
- [ ] Add test coverage
- [ ] Add rate limiting to API endpoints
- [ ] Add request validation middleware
- [ ] Migration script for source field on existing sessions

## Plugin Repos

| Repo | Purpose | Status |
|------|---------|--------|
| opencode-sync-plugin | npm package for OpenCode CLI | Not started |
| claude-code-sync | Python plugin for Claude Code | Not started |

## Notes

- Plugins are separate repos from this backend
- OpenCode plugin uses JavaScript/TypeScript
- Claude Code plugin uses Python with uv
- Schema will need source field to distinguish session origins
- Eval export feature targets DeepEval, OpenAI Evals, and Promptfoo frameworks
- Marketplace payment uses Convex Stripe component (future)
- All new features should follow existing patterns in convex/ and src/
