# Requests Feature

## Goal

Add a **Requests** view: a flat, per-request (per-message) activity table showing
individual model calls across all of a user's sessions, plus a way to surface
which **provider** is in use.

Columns: **Time (UTC) · Model · Input · Output · Cached · Cost**, with a
**Provider** indicator (column + filter).

This is OpenRouter-style "activity log" granularity — one row per model request —
distinct from the existing Sessions view (one row per coding session).

## Placement decision

- **New top-level Dashboard tab**: add `requests` to the view switcher in
  `Dashboard.tsx` header, positioned after `sessions`
  (`overview · sessions · requests · analytics · evals · wrapped`).
- **Provider indicator**: a `Provider` column in the table + a provider filter
  pill, reusing the existing provider filter pattern. Source filter dropdown
  (header) continues to apply.

## Column → data mapping

| Column      | Status today            | Action                                                                   |
| ----------- | ----------------------- | ------------------------------------------------------------------------ |
| Time (UTC)  | exists                  | `messages.createdAt`                                                     |
| Model       | exists                  | `messages.model`                                                         |
| Input       | exists                  | `messages.promptTokens`                                                  |
| Output      | exists                  | `messages.completionTokens`                                              |
| Provider    | dropped                 | payload already carries it; persist in mutation + schema                 |
| Cost        | dropped                 | payload already carries per-message `cost`; persist in mutation + schema |
| Cached      | missing                 | extract OpenCode `tokens.cache.read` → kit payload → mutation → schema   |
| ~~Credits~~ | dropped (user decision) | not implemented — OpenSync has no credits concept                        |

Key finding: per-message `provider` and `cost` already flow through the kit
payload (`packages/kit/src/events.ts` `MessageUpsertPayload`) and the CLI
transport (`apps/cli/src/transport.ts` spreads `...event.payload`). They are
silently dropped only at the Convex `messages.upsert` / `messages.batchUpsert`
mutations. So provider + cost are cheap to land. Only `cachedTokens` needs new
extraction in the adapter.

## Scope — implementation slices

### Slice 1 — Backend data (schema + mutations + query)

1. `packages/api/convex/schema.ts` — `messages` table:
   - add `provider: v.optional(v.string())`
   - add `cost: v.optional(v.number())`
   - add `cachedTokens: v.optional(v.number())`
   - add `userId: v.id("users")` (optional during migration) + index
     `by_user_created: ["userId", "createdAt"]` for efficient per-user listing.
2. `packages/api/convex/messages.ts` — `upsert` + `batchUpsert`:
   - persist `provider`, `cost`, `cachedTokens` on insert and patch.
   - set `userId` on insert (available as `args.userId`).
   - add the three fields to `messageInputValidator`.
3. `packages/api/convex/analytics.ts` — new `requestsList` query:
   - auth → user; query `messages` by `by_user_created` (fallback: sessions →
     messages if `userId` not yet backfilled).
   - return rows: `{ _id, sessionId, createdAt, model, provider, promptTokens,
completionTokens, cachedTokens, cost }`.
   - support sort (time/cost/tokens), filter (model/provider), source filter,
     pagination — mirror `sessionsWithDetails`.
   - apply `inferProvider`-style normalization for display consistency.

### Slice 2 — Capture cachedTokens at the source

4. `adapters/opencode/src/records.ts` — `messageRowToRecord`: read
   `tokens.cache.read` (OpenCode stores cache token counts) → `cachedTokens`.
5. `packages/kit/src/events.ts` — add `cachedTokens?: number` to
   `MessageUpsertPayload`.
6. `adapters/opencode/src/types.ts` / kit `AdapterMessage` — thread the field
   through types as needed.
   - provider/cost already present; no transport changes needed.

### Slice 3 — Frontend Requests view

7. `apps/website/src/pages/Dashboard.tsx`:
   - add `"requests"` to `ViewMode` and the view-switcher array.
   - new `RequestsView` component: table with the 6 columns + Provider, sortable
     headers, filter pills, pagination — reuse `SessionsView` patterns and
     `t.*` theme classes.
   - wire `api.analytics.requestsList` with source/sort/filter args.
   - provider indicator: column + filter pill (reuse FilterPill).

## Migration note

Existing `messages` rows won't have `userId`, `provider`, `cost`, or
`cachedTokens` until re-synced. The `requestsList` query must tolerate missing
fields (show blank/0). A backfill of `userId` (via each message's
`session.userId`) can be added later if needed for index-only querying; until
then the query can fall back to the sessions→messages path.

## Open questions

- None blocking. (Credits resolved: dropped.)

## Status

- [x] Slice 1 — backend data (schema, mutations, http passthrough, requestsList
      query; convex typecheck passes)
- [x] Slice 2 — cachedTokens capture (adapter records.ts reads tokens.cache.read;
      kit AdapterMessage + MessageUpsertPayload extended; kit rebuilt; adapter
      tests pass; provider/cost already flowed)
- [ ] Slice 3 — frontend Requests view

Plan approved: yes (userId + index approach). Slices 1–2 complete.
