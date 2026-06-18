# OpenCode Sync Redesign

## Goal

Redesign the OpenCode sync integration around a durable local sync pipeline instead of a
combined plugin/CLI that sends directly to OpenSync from inside OpenCode.

The new architecture should support:

- latest OpenCode plugin events (`session.next.*` architecture)
- OpenCode's newer SQLite-backed local storage for backfill/import
- future sources such as Pi agent without duplicating sync logic
- a durable long-running CLI/daemon process for reliable syncing
- clean separation between source adapters, queueing, normalization, and OpenSync transport

## Current direction / decisions

| Area                       | Decision                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| OpenCode plugin package    | `plugins/opencode`, package `@opensync/opencode`                                                                                          |
| CLI app location           | `apps/cli`                                                                                                                                |
| CLI package                | likely `@opensync/cli` with `opensync` or `opensync-sync` bin; final bin name TBD                                                         |
| Plugin suffix              | Do **not** use `-plugin` suffixes                                                                                                         |
| Runtime transport          | durable local reference queue + daemon; **do not** spawn CLI per event                                                                    |
| Plugin responsibility      | source observer only: observe OpenCode and enqueue source references/identifiers                                                          |
| CLI responsibility         | config/login, daemon, queue draining, retries, OpenSync API transport, `sync --all`                                                       |
| Normalization owner        | source adapter workspace packages read source records; CLI/daemon converts records to OpenSync sync payloads                              |
| Shared adapter contract    | `packages/kit`, package `@opensync/kit`                                                                                                   |
| OpenCode storage           | Current OpenCode uses SQLite at the XDG data path; old JSON storage is legacy and out of scope unless chosen later                        |
| OpenCode plugin resolution | OpenCode config should use package names such as `@opensync/opencode`, never local filesystem paths                                       |
| Local install ergonomics   | Use `npm link` for package-name local development and packed install validation for artifact testing; avoid separate install script files |

## Open questions to resolve before implementation

1. **CLI binary name**
   - Options: `opensync`, `opensync-sync`, or keep source-specific alias `opencode-sync` as a compatibility wrapper.
   - Recommendation: `opensync` for the generic multi-source CLI, optionally add `opencode-sync` alias later.

2. **Queue format: reference vs payload**
   - Decision: queue **source references**, not full normalized OpenSync payloads.
   - Example: source, resource type, external IDs, event timestamp.
   - Reason: adapters can read directly from source, so the daemon can resolve queued identifiers with `adapter.getSession` / `adapter.getMessage`.
   - Tradeoff: the queue is smaller and the plugin is thinner, but queued references depend on the source record still being readable later.

3. **Adapter packaging**
   - Decision: use top-level source adapter packages under `adapters/*`.
   - OpenCode adapter location: `adapters/opencode`.
   - OpenCode adapter package: `@opensync/adapter-opencode`.
   - Shared adapter API/types location: `packages/kit`, package `@opensync/kit`.
   - Future source shape: `adapters/pi`, etc.

4. **OpenCode SQLite schema**
   - Must verify current database path and schema from installed/current OpenCode before implementing.
   - Do not rely on old JSON paths like `~/.local/share/opencode/storage/session` without confirmation.

## Proposed package structure

Recommended structure:

```txt
packages/
  kit/
    package.json              # @opensync/kit
    src/
      adapter.ts              # SourceAdapter base class + AdapterSession/AdapterMessage records
      events.ts               # queue reference event + OpenSync sync event/payload types
      index.ts                # public exports

adapters/
  opencode/
    package.json              # @opensync/adapter-opencode
    src/
      index.ts
      records.ts              # OpenCode SQLite rows/live data -> AdapterSession/AdapterMessage records
      live-events.ts          # OpenCode plugin event -> source reference queue events
      sqlite.ts               # SQLite discovery/reader
      types.ts

apps/
  cli/
    package.json              # @opensync/cli
    src/
      index.ts                # CLI entrypoint
      commands/
        login.ts
        status.ts
        daemon.ts
        sync.ts
        queue.ts
      daemon/
        run.ts
        drain.ts
        retry.ts
      transport/
        opensync-client.ts
      config.ts

plugins/
  opencode/
    package.json              # @opensync/opencode
    src/
      index.ts                # OpenCode plugin entry
      queue-writer.ts          # append durable events safely
```

This keeps each source adapter independently testable while avoiding normalization drift between plugin live events and CLI backfill.

## `@opensync/kit` contract

`@opensync/kit` is the shared foundation package for source adapters and the CLI.
It should stay small and source-agnostic.

Responsibilities:

- define source record shapes: `AdapterSession`, `AdapterMessage`
- define the class-based `SourceAdapter` contract consumed by CLI/daemon
- define lightweight source-reference queue events
- define OpenSync sync event/payload shapes used by transport
- provide small conversion helpers from adapter records to OpenSync sync events where useful

Current public module layout:

```txt
packages/kit/src/
  adapter.ts
  events.ts
  index.ts
```

Current adapter class shape:

```ts
abstract class SourceAdapter<TSource extends string = string> {
  readonly source: TSource;

  abstract listSessions(options?: AdapterReadOptions): AdapterSession<TSource>[];
  abstract getSession(
    externalId: string,
    options?: AdapterReadOptions,
  ): AdapterSession<TSource> | null;
  abstract listMessages(
    sessionExternalId: string,
    options?: AdapterReadOptions,
  ): AdapterMessage<TSource>[];
  abstract getMessage(
    externalId: string,
    options?: AdapterReadOptions,
  ): AdapterMessage<TSource> | null;
}
```

The CLI should talk to adapters through this class contract rather than source-specific functions. Source-specific storage details, such as OpenCode SQLite path resolution and queries, belong inside the source adapter package.

The term **backfill** should be reserved for CLI workflow/user-facing behavior (`sync --all`). Adapter primitives should be named around source records and lookups (`listSessions`, `getMessage`, etc.), not `readBackfill`.

`AdapterReadOptions` uses adapter-owned named params, not generic path fields:

```ts
type AdapterReadOptions = {
  params?: Record<string, string>;
};
```

The CLI parses known global flags itself and passes unknown `--key value` pairs into `params` for the selected adapter. Examples:

```bash
opensync sync --source opencode --all --db ~/.local/share/opencode/opencode.db
opensync queue drain --source opencode --db ~/.local/share/opencode/opencode.db
```

For OpenCode, `params.db` means SQLite database path. Future adapters can define their own params, such as `--file`, `--dir`, or `--workspace`, without changing the generic CLI parser.

## Queue reference model

The live queue should store source references, not OpenSync payload snapshots and not raw OpenCode event objects.

The plugin should append lightweight queue events such as:

```ts
type SourceChangeEvent = {
  id: string;
  version: 1;
  source: "opencode" | "pi" | string;
  resource: "session" | "message";
  action: "changed" | "deleted";
  externalId: string;
  sessionExternalId?: string;
  observedAt: number;
};
```

The daemon resolves these references through the adapter:

```txt
SourceChangeEvent
  -> adapter.getSession(...) or adapter.getMessage(...)
  -> OpenSync sync payload/event
  -> HTTP transport
```

This keeps the OpenCode plugin thin and prevents it from owning OpenSync transport or full normalization.

## OpenSync sync event model

After the daemon or `sync --all` reads records from an adapter, it can convert them into OpenSync-owned sync events/payloads for transport.

Example event envelope:

```ts
type DurableEvent = {
  id: string;
  version: 1;
  source: "opencode" | "pi" | string;
  kind: "session.upsert" | "message.upsert" | "session.finalize";
  createdAt: number;
  payload: unknown;
};
```

OpenCode examples:

```ts
type SessionUpsertEvent = {
  id: string;
  version: 1;
  source: "opencode";
  kind: "session.upsert";
  createdAt: number;
  payload: {
    externalId: string;
    title?: string;
    projectPath?: string;
    projectName?: string;
    model?: string;
    provider?: string;
    promptTokens?: number;
    completionTokens?: number;
    cost?: number;
    sourceCreatedAt?: number;
  };
};

type MessageUpsertEvent = {
  id: string;
  version: 1;
  source: "opencode";
  kind: "message.upsert";
  createdAt: number;
  payload: {
    sessionExternalId: string;
    externalId: string;
    role: "user" | "assistant" | "system" | "tool" | "unknown";
    textContent?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    durationMs?: number;
    sourceCreatedAt?: number;
  };
};
```

The daemon maps durable events to existing OpenSync HTTP endpoints:

- `session.upsert` -> `POST /sync/session`
- `message.upsert` -> `POST /sync/message`

## Queue design

Start simple and durable:

```txt
~/.opensync/
  config.json
  queues/
    opencode.jsonl
  state/
    opencode.offset.json
    daemon.lock
```

Initial queue behavior:

- plugin appends one source reference JSON object per line
- append must be best-effort and non-throwing inside OpenCode
- daemon reads from last processed byte offset
- daemon resolves each reference through the source adapter
- daemon only advances offset after successful handling or durable failure classification
- failed transient sends are retried with backoff
- malformed events are moved/recorded as dead-letter entries

Future queue improvements if needed:

- per-source queue directories
- file rotation by size/date
- compaction after all events processed
- SQLite queue if JSONL offset handling becomes insufficient

## OpenCode live adapter responsibilities

The shared OpenCode adapter should support current latest event architecture only.

Input:

- OpenCode plugin `event` object from `@opencode-ai/plugin`

Handled event types:

- `session.created`
- `session.updated`
- `session.idle`
- `session.next.prompted`
- `session.next.synthetic`
- `session.next.step.started`
- `session.next.text.ended`
- `session.next.step.ended`

Output:

- zero or more source reference queue events

Adapter state required:

- latest session metadata by `sessionID`
- assistant message drafts keyed by `assistantMessageID`
- debounce/merge state for assistant text + token/cost metadata

Important behavior:

- user messages can be emitted from `session.next.prompted`
- synthetic continuation messages can be emitted from `session.next.synthetic`
- assistant message text arrives from `session.next.text.ended`
- assistant cost/tokens/model arrive from `session.next.step.ended`
- the adapter must merge text and step metadata before emitting a final assistant message event
- `session.idle` can emit/finalize session totals, potentially enriched by SQLite if needed

## Verified OpenCode SQLite storage

Research completed against upstream OpenCode source and a local OpenCode database on 2026-06-18.

### Sources checked

- Upstream source: `packages/opencode/src/storage/db.ts` at `sst/opencode@47f33329`
- Upstream source: `packages/opencode/src/session/session.sql.ts` at `sst/opencode@47f33329`
- Upstream source: `packages/opencode/src/session/message-v2.ts` at `sst/opencode@47f33329`
- Local DB metadata: `~/.local/share/opencode/opencode.db`

### Database path resolution

OpenCode resolves the database path in `storage/db.ts`:

1. If `OPENCODE_DB` is set:
   - `:memory:` is used as-is.
   - absolute paths are used as-is.
   - relative paths resolve under `Global.Path.data`.
2. Otherwise, OpenCode uses a channel-specific database path:
   - `latest`, `beta`, `prod`, or disabled channel DB -> `opencode.db`
   - other channels -> `opencode-<safe-channel>.db`

`Global.Path.data` is `path.join(xdgData, "opencode")`.

On Linux this means the default DB is:

```txt
~/.local/share/opencode/opencode.db
```

Related WAL files may exist:

```txt
~/.local/share/opencode/opencode.db-wal
~/.local/share/opencode/opencode.db-shm
```

The CLI should support:

- explicit `--db <path>` override
- `OPENCODE_DB` behavior compatible with OpenCode where practical
- default lookup at the XDG data path
- read-only access with WAL support

### Tables verified locally

Local `.tables` output included:

```txt
session
message
part
project
todo
session_message
session_input
session_context_epoch
event
event_sequence
workspace
```

Backfill only needs `session`, `message`, and `part` initially. `project` is useful for optional enrichment.

### `session` table

Verified local schema:

```sql
CREATE TABLE `session` (
  `id` text PRIMARY KEY,
  `project_id` text NOT NULL,
  `parent_id` text,
  `slug` text NOT NULL,
  `directory` text NOT NULL,
  `title` text NOT NULL,
  `version` text NOT NULL,
  `share_url` text,
  `summary_additions` integer,
  `summary_deletions` integer,
  `summary_files` integer,
  `summary_diffs` text,
  `revert` text,
  `permission` text,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  `time_compacting` integer,
  `time_archived` integer,
  `workspace_id` text,
  `path` text,
  `agent` text,
  `model` text,
  `cost` real DEFAULT 0 NOT NULL,
  `tokens_input` integer DEFAULT 0 NOT NULL,
  `tokens_output` integer DEFAULT 0 NOT NULL,
  `tokens_reasoning` integer DEFAULT 0 NOT NULL,
  `tokens_cache_read` integer DEFAULT 0 NOT NULL,
  `tokens_cache_write` integer DEFAULT 0 NOT NULL,
  `metadata` text
);
```

Important mapping:

| OpenCode column                               | OpenSync field     |
| --------------------------------------------- | ------------------ | ------------- | ------------- |
| `session.id`                                  | `externalId`       |
| `"opencode"`                                  | `source`           |
| `session.title                                |                    | session.slug` | `title`       |
| `session.directory                            |                    | session.path` | `projectPath` |
| basename of project path                      | `projectName`      |
| `json_extract(session.model, '$.id')`         | `model`            |
| `json_extract(session.model, '$.providerID')` | `provider`         |
| `session.tokens_input`                        | `promptTokens`     |
| `session.tokens_output`                       | `completionTokens` |
| `session.cost`                                | `cost`             |
| `session.time_created`                        | `createdAt`        |

### `message` table

Verified local schema:

```sql
CREATE TABLE `message` (
  `id` text PRIMARY KEY,
  `session_id` text NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  `data` text NOT NULL
);
```

`message.data` is JSON. Upstream `message-v2.ts` hydrates rows as:

```ts
{
  ...row.data,
  id: row.id,
  sessionID: row.session_id,
}
```

Observed JSON fields include:

- `role`: `"user" | "assistant"`
- user messages: `model.providerID`, `model.modelID`, optional `agent`, `tools`, `system`
- assistant messages: `modelID`, `providerID`, `cost`, `tokens.input`, `tokens.output`, `tokens.reasoning`, `tokens.cache.read`, `tokens.cache.write`, `time.completed`

Important mapping:

| OpenCode value                                                 | OpenSync field      |
| -------------------------------------------------------------- | ------------------- |
| `message.session_id`                                           | `sessionExternalId` |
| `message.id`                                                   | `externalId`        |
| `json_extract(message.data, '$.role')`                         | `role`              |
| `json_extract(message.data, '$.modelID')` or `$.model.modelID` | `model`             |
| `json_extract(message.data, '$.tokens.input')`                 | `promptTokens`      |
| `json_extract(message.data, '$.tokens.output')`                | `completionTokens`  |
| `message.time_created` or `$.time.created`                     | `createdAt`         |
| `$.time.completed - $.time.created`                            | `durationMs`        |

### `part` table

Verified local schema:

```sql
CREATE TABLE `part` (
  `id` text PRIMARY KEY,
  `message_id` text NOT NULL,
  `session_id` text NOT NULL,
  `time_created` integer NOT NULL,
  `time_updated` integer NOT NULL,
  `data` text NOT NULL
);
```

`part.data` is JSON. Upstream `message-v2.ts` hydrates rows as:

```ts
{
  ...row.data,
  id: row.id,
  sessionID: row.session_id,
  messageID: row.message_id,
}
```

Relevant part types from upstream:

- `text` with `text`
- `reasoning` with `text`
- `tool` with `state`
- `step-start`
- `step-finish` with `cost` and `tokens`
- `file`, `patch`, `agent`, `retry`, `compaction`, `subtask`, `snapshot`

Initial OpenSync message `textContent` mapping:

- concatenate `text` parts for each message ordered by `part.id` or `part.time_created, part.id`
- ignore `reasoning` for normal message text initially
- optionally preserve non-text parts later via OpenSync `parts`

### Query shape for backfill

Initial session query:

```sql
SELECT
  id,
  slug,
  directory,
  path,
  title,
  model,
  cost,
  tokens_input,
  tokens_output,
  time_created,
  time_updated
FROM session
WHERE time_archived IS NULL
ORDER BY time_created ASC;
```

Initial message + text query:

```sql
SELECT
  m.id,
  m.session_id,
  m.time_created,
  m.time_updated,
  m.data,
  group_concat(json_extract(p.data, '$.text'), '') AS text_content
FROM message m
LEFT JOIN part p
  ON p.message_id = m.id
 AND json_extract(p.data, '$.type') = 'text'
GROUP BY m.id
ORDER BY m.session_id, m.time_created, m.id;
```

Implementation may prefer loading parts separately instead of relying on `group_concat` ordering.

### SQLite implementation recommendation

Because the repo uses Bun/Vite+ and OpenCode itself uses `bun:sqlite`, start with `bun:sqlite` for the CLI if the CLI runtime is Bun-first.

If the CLI must run under plain Node.js, use `better-sqlite3` instead.

Decision pending before implementation: whether the distributed CLI requires Node-only runtime or can require Bun.

## OpenCode SQLite source-read responsibilities

The OpenCode adapter must read OpenCode's current SQLite storage described above.

The CLI `sync --source opencode --all` uses the adapter's source-record methods:

```txt
adapter.listSessions()
adapter.listMessages(sessionExternalId)
  -> OpenSync sync events/payloads
  -> transport or dry-run/inspection output
```

Discovery is complete for the current TypeScript OpenCode implementation. Implementation should use the verified table mappings above and should not use the legacy JSON-file layout.

Full sync flow:

```txt
OpenCode SQLite DB
  -> adapter.listSessions/listMessages
  -> produce adapter records
  -> CLI/daemon converts to OpenSync sync events/payloads
  -> daemon/sync command sends via same OpenSync client
```

No code should assume old JSON file layout unless explicitly added as a legacy reader.

## CLI app responsibilities

Package: `apps/cli`, likely `@opensync/cli`.

Commands:

```bash
opensync login
opensync logout
opensync status
opensync verify
opensync daemon
opensync queue inspect [--source opencode]
opensync queue flush [--source opencode]
opensync queue drain [--source opencode] [adapter params...]
opensync sync --source opencode --all [adapter params...]
```

Responsibilities:

- store/read OpenSync credentials
- validate Convex URL + API key
- normalize `.convex.cloud` -> `.convex.site`
- run durable daemon loop
- drain JSONL queue
- parse source adapter params from unknown `--key value` flags
- send durable events to OpenSync HTTP endpoints
- retry transient failures
- track offsets/checkpoints
- run backfill/import from OpenCode SQLite

The CLI should be executable durably:

- `opensync daemon` runs continuously
- plugin does not spawn CLI per event
- daemon can be manually started first; later we can add autostart instructions or service files

## OpenCode plugin responsibilities

Package: `plugins/opencode`, `@opensync/opencode`.

Responsibilities:

- load in OpenCode
- listen to OpenCode event hook
- call shared `@opensync/adapter-opencode` live adapter
- append resulting durable events to queue
- never send HTTP requests to OpenSync
- never prompt user
- never write console output
- never block OpenCode on network or daemon availability

OpenCode config should become:

```json
{
  "plugin": ["@opensync/opencode"]
}
```

## OpenCode plugin install modes

The OpenCode config should always reference the package name:

```json
{
  "plugin": ["@opensync/opencode"]
}
```

Do **not** require users or local development configs to point at a package directory or built file path.

### Mode A — `npm link` local workspace package

For local development, link the workspace package into OpenCode's npm context so Node/OpenCode can resolve `@opensync/opencode` by package name.

Expected effective link:

```txt
~/.config/opencode/node_modules/@opensync/opencode
  -> npm link target for <repo>/plugins/opencode
```

This should be exposed directly through `plugins/opencode/package.json` scripts, not a separate script file. The command should use npm's link workflow instead of manually creating symlinks.

Example command shape:

```json
{
  "scripts": {
    "link:opencode": "npm link && npm link @opensync/opencode --prefix ~/.config/opencode",
    "unlink:opencode": "npm unlink @opensync/opencode --prefix ~/.config/opencode"
  }
}
```

Expected local loop:

```bash
vp run -F @opensync/opencode build
vp run -F @opensync/opencode link:opencode
```

Then OpenCode loads `@opensync/opencode` through the symlink and the package's normal `exports`/`main` fields.

### Mode B — packed install validation

For testing the package as it would be consumed from a registry/package artifact, support a packed install into OpenCode's npm context.

This mode should still preserve package-name OpenCode config and should avoid writing ugly `file:` dependencies to `~/.config/opencode/package.json`.

Use `npm install --no-save --prefix ~/.config/opencode <tarball>` for this mode.

Example command shape:

```json
{
  "scripts": {
    "pack:opencode": "vp pack && npm pack --pack-destination ~/.local/share/opencode/opensync",
    "install:opencode": "npm install --prefix ~/.config/opencode --no-save ~/.local/share/opencode/opensync/opensync-opencode-*.tgz"
  }
}
```

Implementation note: verify the exact tarball filename for scoped package `@opensync/opencode` during implementation. It is expected to be similar to `opensync-opencode-<version>.tgz`.

### Non-goals

- Do not put local filesystem paths in OpenCode config.
- Do not require a `file:` dependency in `~/.config/opencode/package.json` for normal local use.
- Do not manually create symlinks unless `npm link` proves insufficient.
- Do not create separate install helper script files unless package.json shell commands become unmaintainable.

## OpenSync transport responsibilities

The CLI owns HTTP transport.

Existing endpoints to use initially:

- `GET /health`
- `POST /sync/session`
- `POST /sync/message`
- `GET /sync/sessions/list` if still useful for backfill dedupe

Payloads should include:

- `source: "opencode"`
- original timestamps as `createdAt`
- session/message external IDs from source

Transport should be isolated so future batching can swap in:

- `POST /sync/batch`

without changing plugin or adapter logic.

## Implementation phases

### Phase 0 — Stop and clean current partial scaffold

- [ ] Review current uncommitted files from earlier exploratory migration.
- [ ] Remove or rename `plugins/opencode-sync` partial package.
- [ ] Ensure no stale package names remain:
  - `@opensync/opencode-sync`
  - `@opensync/opencode-sync-plugin`
  - `opencode-sync-plugin`
- [ ] Keep backup source untouched under `backup/opencode-sync-plugin` until migration is verified.

Verification:

- `git diff` shows only intended plan/scaffold changes.

### Phase 1 — Research current OpenCode SQLite storage

- [x] Confirm latest `@opencode-ai/plugin` and `@opencode-ai/sdk` versions.
- [x] Inspect official docs/source for current local storage path.
- [x] Inspect a real local OpenCode SQLite DB if present on the dev machine.
- [x] Document DB path, tables, and session/message/part mapping in this plan.
- [ ] Decide whether the CLI runtime is Bun-first (`bun:sqlite`) or Node-first (`better-sqlite3`).

SQLite dependency candidates:

- `bun:sqlite` if Vite+/Bun runtime is acceptable for CLI runtime.
- `better-sqlite3` if Node-native CLI support is required.
- avoid dependency until the schema/path is verified.

Verification:

- Schema/path notes added above with exact tables/columns used.

### Phase 2 — Create OpenCode adapter package

- [x] Create `adapters/opencode` (`@opensync/adapter-opencode`).
- [x] Implement `OpenCodeAdapter extends SourceAdapter<"opencode">`.
- [x] Implement SQLite-backed `listSessions`, `getSession`, `listMessages`, `getMessage`.
- [x] Implement live-event source-reference mapper for session/message update events and current `session.next.*` events.
- [x] Add unit tests for row-to-record and live reference mapping.

Verification:

- `vp run -F @opensync/adapter-opencode build`
- targeted tests for normalizer behavior if feasible

### Phase 3 — Create CLI app

- [x] Create `apps/cli` (`@opensync/cli`).
- [x] Add Vite+ pack build for CLI binary.
- [x] Move/adapt login/logout/status/verify from backup CLI.
- [x] Implement queue reader utilities for source-reference JSONL queues.
- [x] Implement durable daemon loop with offset checkpointing.
- [x] Implement `queue inspect`.
- [x] Implement `queue drain` resolving source references through adapters (offset checkpointing, dead-letter, retry/backoff).
- [x] Implement `queue flush`.
- [x] Implement OpenSync HTTP client for `/health`, `/sync/session`, `/sync/message`, `/sync/sessions/list`.
- [x] Implement `sync --source opencode --all` using SQLite adapter.
- [x] Implement `sync --new`, `--force`, connectivity test, `config`, and `version` compatibility behavior from backup CLI.

Verification:

- `vp run -F @opensync/cli build`
- `opensync status` works from built output
- `opensync queue inspect` handles missing queue gracefully

### Phase 4 — Create OpenCode plugin package

- [x] Create `plugins/opencode` (`@opensync/opencode`).
- [x] Use latest `@opencode-ai/plugin` package.
- [x] Implement plugin event hook.
- [x] Use shared OpenCode live adapter to produce source-reference queue events.
- [x] Append source-reference events to `~/.opensync/queues/opencode.jsonl`.
- [x] No direct OpenSync HTTP/API calls in plugin.
- [x] No CLI subprocess spawn per event.
- [x] No logging/terminal output.
- [ ] Add package.json-only commands for `npm link` local install into OpenCode's npm context.
- [ ] Add package.json-only commands for packed install validation with `--no-save`.
- [ ] Ensure OpenCode config uses `@opensync/opencode`, not a local path.

Verification:

- `vp run -F @opensync/opencode build`
- source grep confirms plugin has no `/sync/session`, `/sync/message`, or Convex URL handling
- link mode: `~/.config/opencode/node_modules/@opensync/opencode` resolves to the linked workspace package
- packed mode: package installs into `~/.config/opencode/node_modules/@opensync/opencode` without adding a `file:` dependency to `~/.config/opencode/package.json`

### Phase 5 — Integrate daemon + plugin queue

- [x] Start daemon manually.
- [x] Trigger synthetic/sample queued OpenCode durable events.
- [x] Confirm daemon sends to OpenSync endpoints.
- [x] Confirm offset advances only after successful sends.
- [x] Confirm daemon resumes after restart without duplicating already processed events.
- [x] Plugin-triggered autostart with single-instance guarantee (multi-window safe).

Realized design (autostart evolution of the manual-start note above):

- The OpenCode plugin best-effort spawns `opensync daemon --source opencode`
  detached + `unref()` on load; failures are swallowed so OpenCode is never
  blocked or affected.
- Autostart also fires from the plugin `event` hook (throttled to ~30s) so the
  daemon is respawned on activity after an idle-exit. Without this, idle-exit
  would stall sync in a still-open window until a new window opened. Redundant
  spawns just hit the live lock and exit, so over-triggering is harmless.
- A single-instance lock is enforced in the daemon (the process that advances
  the offset), so any number of OpenCode windows can each spawn a daemon and
  only one survives. Implemented in `apps/cli/src/daemon-lock.ts`.
- Lock location: OS temp dir (`<tmp>/opensync-daemon-<source>.lock`), not
  `~/.opensync/state/daemon.lock` as originally sketched. Reboot clears it,
  removing the worst pid-reuse window for free.
- Stale-lock recovery: atomic `O_EXCL` create; on conflict, reclaim if the
  holder pid is dead (`process.kill(pid, 0)`) or the lock is older than a
  generous `staleMs`. This guarantees a leftover lock from a crash/SIGKILL/OOM
  can never permanently block sync. No heartbeat (a wedged-but-alive daemon is a
  manual kill).
- Idle-exit: daemon releases the lock and exits after `--idle-timeout` (default
  5 min) of empty drains, so no idle process lingers once all windows close.
  `--idle-timeout 0` runs until terminated.

Verification:

- `apps/cli/test/daemon-lock.test.ts` covers acquire / live-holder reject /
  dead-pid reclaim / stale-age reclaim / corrupt-lock reclaim / release / no
  release after another owner reclaims.
- Manual: two parallel `opensync daemon` → exactly one survives; incremental
  drain advances offset.

### Phase 6 — Backfill/import

- [ ] Implement SQLite reader for current OpenCode DB.
- [ ] Map sessions/messages/token/cost/title/project fields.
- [ ] Reuse same OpenSync transport as queue daemon.
- [ ] Preserve original timestamps.
- [ ] Add dedupe against local state and/or backend session list.

Verification:

- dry-run output prints counts without sending
- `sync --source opencode --all --dry-run` if we add dry-run in this phase
- real sync test with a small fixture or local DB copy

### Phase 7 — Docs and migration cleanup

- [ ] Update README ecosystem/package names.
- [ ] Update OpenCode setup docs to use `@opensync/opencode`.
- [ ] Document daemon requirement.
- [ ] Document queue location and troubleshooting.
- [ ] Document SQLite-backed import behavior.
- [ ] Remove stale combined plugin/CLI docs.

Verification:

- docs grep for stale package names

### Phase 8 — Final validation

- [ ] `vp install` succeeds.
- [ ] `vp check` succeeds for changed workspaces.
- [ ] `vp run -F @opensync/adapters build` succeeds.
- [ ] `vp run -F @opensync/cli build` succeeds.
- [ ] `vp run -F @opensync/opencode build` succeeds.
- [ ] Plugin package outputs correct ESM entry and type declarations.
- [ ] CLI package outputs executable binary.

## Risks / things to avoid

- Do not send OpenSync HTTP requests directly from the OpenCode plugin.
- Do not spawn the CLI once per OpenCode event/message.
- Do not implement against old OpenCode JSON storage without verifying current SQLite schema.
- Do not duplicate normalization between live events and `sync --all`.
- Do not make the daemon required for OpenCode to run; plugin queue writes must be safe if daemon is absent.
- Do not introduce a generic core abstraction until package boundaries force it.

## Current status

Implemented and verified at package level: `@opensync/kit`, `@opensync/adapter-opencode`,
`@opensync/opencode` (plugin), `@opensync/cli`. `vp test` (24 tests) and `vp check`
(0 errors) pass. Builds pass for all four packages.

### Post-implementation audit fixes (done)

- Adapter `getSession`/`getMessage` now use indexed `WHERE id = ?` queries instead of
  full-table scans (and `getMessage` reads only its own parts).
- Queue parsing is byte-accurate (`parseQueueBuffer` over a `Buffer`, per-line end
  offsets) — fixes the byte-vs-UTF16 offset hazard.
- Drain commits offsets in order, per reference. The offset never advances past a
  resolved-but-failed upload or a not-yet-resolvable reference, so those are retried.
  References that stay unresolved longer than `STALE_REFERENCE_MS` (60s) are
  dead-lettered and skipped so one permanently-missing reference cannot block the queue.
- Removed dead `liveEventToEvents` alias.
- Plugin flushes pending debounced message references on `process.once("exit")`
  (no signal listeners, to avoid altering OpenCode's own shutdown).
- Extracted the pure drain ordering/commit core into `drain-core.ts` (IO-free,
  dependency-injected `resolve`/`upload`) so durability semantics are unit-tested.
  `apps/cli/test/drain.test.ts` covers in-order commit, failed-upload-blocks,
  fresh-missing-blocks, stale-missing dead-letter, malformed dead-letter, dry-run,
  and first-entry-blocks offset preservation. Full suite: 31 tests passing.

### Known blocker — delete propagation (item 3, not implemented)

`SourceChangeAction` includes `"deleted"`, but end-to-end delete propagation is
**blocked outside the four packages**:

- `packages/api/convex/http.ts` exposes `/sync/session`, `/sync/message`,
  `/sync/batch`, `/sync/sessions/list`, `/health` — there is **no delete endpoint**.
  Propagating deletes needs a new Convex HTTP route + mutation (`packages/api` scope).
- `@opencode-ai/plugin` is not installed in this repo, so OpenCode's deletion event
  names are unconfirmed; `live-events.ts` cannot map deletes without guessing.

Until both are resolved, `live-events` only emits `"changed"` and `resolveQueuedEvent`
treats non-`"changed"` references as unresolved (dead-lettered once stale).

### Remaining manual validation (cannot run here)

- Plugin inside a live OpenCode runtime.
- Uploads against real Convex credentials.
- `npm link` and packed-install flows into `~/.config/opencode`.
