# Message-Level Embeddings (Context Semantic Search)

## Status: IMPLEMENTED & VERIFIED (dev)

All four slices implemented, deployed to dev (`resilient-stork-130`), and tested
end-to-end. `vp check` clean for changed files (2 remaining errors are
pre-existing in `Updates.tsx`), `vp test` green (39/39).

End-to-end runtime test (dev): seeded user/assistant/tool messages via
`batchUpsert` (returned `messageIds`), ran `backfillMessagesForUser` → embedded
**2** (tool message correctly skipped), idempotent re-run → **0**. Vector search:
relevant query scored **0.87 / 0.77**, unrelated query **0.30 / 0.25** — strong
semantic discrimination. Test data cleaned up afterward.

NOT YET deployed to prod. To roll out: `convex deploy --prod`, then
`convex run --prod internal.embeddings.backfillAllMessages` for historical
messages.

## Goal

Make message-level semantic search a working production feature. Today, message
embeddings are **never generated** (the generator functions exist but have zero
callers), so the `messageEmbeddings` table stays empty and
`semanticSearchMessages` / `hybridSearchMessages` return nothing useful.

This plan wires up generation (on sync + backfill), makes it reliable at message
volume, and connects the consumption side so the feature is actually usable.

## Background / Current State (verified)

- **Sessions work**: `POST /sync/session` (`convex/http.ts:133`) schedules
  `internal.embeddings.generateForSession` after upsert. Session embedding
  generation + storage confirmed running successfully in prod logs.
- **Messages do NOT work**:
  - `POST /sync/message` (`convex/http.ts:155`) only calls `messages.upsert`. No
    embedding is scheduled.
  - `POST /sync/batch` (`convex/http.ts:207`) only calls `messages.batchUpsert`.
    No embedding is scheduled.
  - `generateForMessage` (`convex/embeddings.ts:189`) is only called by
    `batchGenerateForSession` and `batchGenerateMessagesForUser`, **neither of
    which has any caller** anywhere (no HTTP route, cron, scheduler, or UI).
- **Schema is ready**: `messageEmbeddings` table exists (`convex/schema.ts:173`)
  with `by_message`, `by_session`, `by_user` indexes and a `by_embedding` vector
  index (1024 dims, `userId` filter field). No schema change required for core.
- **Consumption exists but is unused**: `search.ts` has `semanticSearchMessages`
  (`:609`) and `hybridSearchMessages` (`:748`). The dashboard Context page
  (`apps/website/src/pages/Context.tsx`) only calls full-text
  `searchSessionsPaginated` / `searchMessagesPaginated` — no semantic toggle, no
  `useAction`.
- **`embed()`** (`convex/lib/ai.ts:20`) takes a single string, returns one
  vector, truncates input at 8000 chars. No batch (`string[]`) support.
- **`messages.batchUpsert`** (`convex/messages.ts:224`) returns
  `{ inserted, updated, skipped, errors }` — **counts only, no message IDs**, so
  the batch path currently can't tell us which messages to embed.
- **Idempotency already present**: `generateForMessage` computes a `textHash` and
  skips unchanged messages; `storeMessageEmbedding` uses get-or-replace. Safe to
  re-run.

## Key Decisions

- **One vector per message** (not concatenated) — finer-grained, higher-quality
  retrieval than session-level blob embeddings. This is the whole point.
- **Chunked fan-out coordinator** instead of one `scheduler.runAfter(0)` per
  message, to avoid bursts (Cloudflare Workers AI free tier: 300 req/min, 10k
  Neurons/day; both are real ceilings even though cost is explicitly out of scope
  for now — bursting still causes hard failures).
- **Batch the embedding API call** via a new `embedMany(texts: string[])`: one
  HTTP call per chunk returns one independent vector per input. Improves
  throughput / respects rate limit. (Note: does NOT reduce Neuron consumption —
  same total tokens processed. Quality identical to per-message calls.)
- **Quality filter**: embed only `user` and `assistant` messages with non-empty
  `textContent`. Skip `tool` (calls + results) and `system` messages — they are
  structured noise, the bulk of volume, and dilute retrieval relevance. Best
  signal-to-noise for what users actually search for.
- **Scope = full end-to-end** including the dashboard Semantic toggle AND
  exposing session-level semantic search (already built, currently unused in UI),
  so we don't ship generation that nothing consumes.
- **Backfill via one-shot `convex run`** (not a cron) — runnable on demand,
  resumable, no recurring scheduled load.
- **Cost/Neuron-budget concerns deferred** — only the burst-safety coordinator is
  in scope; no soft daily cap for now.

## Implementation Slices

### Slice 1 — Batch-capable embedding + chunked coordinator

- `convex/lib/ai.ts`: add `embedMany(texts: string[]): Promise<number[][]>` that
  POSTs an array `input` to the OpenAI-compatible `/embeddings` endpoint and maps
  the returned `data[]` back to inputs by index. Keep per-input 8000-char trim.
  Leave existing `embed()` untouched (still used by session + query paths).
- `convex/embeddings.ts`: add an internal coordinator action
  `enqueueMessageEmbeddings({ messageIds, cursor? })` that:
  - takes a slice of `CHUNK_SIZE` (start 25) message IDs,
  - loads their text + hashes via an internal query, filters out unchanged /
    empty / non-`user`-`assistant` roles,
  - calls `embedMany` once for the chunk,
  - stores each vector via `storeMessageEmbedding` (existing mutation),
  - if more remain, `scheduler.runAfter(smallDelay, self, { remaining })`.
- Verification: unit-call coordinator with a known set of message IDs via
  `convex run`; confirm vectors written, second run is a no-op (hash skip).

### Slice 2 — Wire sync triggers

- `convex/messages.ts`: change `batchUpsert` to also return the IDs of messages
  it **inserted or meaningfully changed** (extend the `returns` validator with
  `messageIds: v.array(v.id("messages"))`). Single-message `upsert` already
  returns the id.
- `convex/http.ts`:
  - `/sync/message`: after `messages.upsert`, schedule
    `enqueueMessageEmbeddings({ messageIds: [messageId] })`.
  - `/sync/batch`: after `messages.batchUpsert`, schedule
    `enqueueMessageEmbeddings({ messageIds: result.messageIds })`.
- Verification: sync a real session, watch `convex logs --prod` for
  `enqueueMessageEmbeddings` + `storeMessageEmbedding`; confirm the
  `/sync/batch` path produces embeddings too (the easy-to-miss one).

### Slice 3 — Backfill existing messages

- Existing messages predate the trigger and have no embeddings.
- Reuse / adapt `getAllMessagesNeedingEmbeddings` (`embeddings.ts:412`) to feed
  the Slice 1 coordinator. Apply the same role filter (`user`/`assistant`,
  non-empty). Provide an internal entry point runnable via
  `convex run --prod internal.embeddings.backfillMessages` (per-user or global,
  chunked, resumable — one-shot, no cron).
- Verification: run against one user, confirm `messageEmbeddings` count matches
  eligible messages; re-run is a no-op.

### Slice 4 — Consumption: dashboard Semantic toggle (messages + sessions)

- `apps/website/src/pages/Context.tsx`: add a Full-text / Semantic mode toggle,
  covering both the `sessions` and `messages` search modes.
  - Full-text keeps `searchSessionsPaginated` / `searchMessagesPaginated`
    (`useQuery`).
  - Semantic calls `api.search.semanticSearch` (sessions) and
    `api.search.semanticSearchMessages` (messages) via `useAction` (these are
    actions, not queries — different hook, no reactive subscription; manage
    loading/results in local state). Both already exist and are currently unused
    in the UI.
  - Handle pagination differences (vector search returns a flat ranked list,
    not cursor-paginated like full-text).
- Verification: search a known phrase in Semantic mode for both sessions and
  messages, confirm relevant results return with scores.

## Verification (overall)

- `convex logs --prod` shows `A(embeddings:enqueueMessageEmbeddings)` and
  `M(embeddings:storeMessageEmbedding)` succeeding after both `/sync/message`
  and `/sync/batch`.
- `semanticSearchMessages` returns results for a known message.
- Re-syncing unchanged messages produces no new embeddings (hash idempotency).
- `vp check` and `vp test` pass.

## Resolved Decisions

1. **Roles to embed**: `user` + `assistant` only. Skip `tool` / `system`.
2. **Backfill mechanism**: one-shot `convex run` (resumable), no cron.
3. **Cost guardrail**: deferred. Burst-safety coordinator only, no daily cap.
4. **Sessions UI**: include session-level semantic search in the UI alongside
   messages — fill that gap too.

## Out of Scope

- LLM answer generation (`rag.generateWithContext`) — separate unused
  scaffolding, not part of this feature.
- Cost/Neuron-budget optimization beyond the burst-safety coordinator.
- Stale docs fix (`apps/docs/dashboard/context.mdx` references wrong
  model/provider/dimensions) — track separately.
