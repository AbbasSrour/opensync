# Profile Feature — Deferred Items

These were identified while porting the Synara profile feature (see
`plans/profile-feature.md`) but explicitly deferred per scope decision. Each
item needs schema or larger-surface changes and should be tackled in its own
slice.

## 1. Skills / agent run tracking

**Synara reference**: `profileStats.ts` aggregates `skills_json` +
`mentions_json` on user messages to produce per-skill and per-agent run counts,
surfaced as "Most used plugins" and "Skills explored / Total skills used".

**OpenSync gap**: `enabledAgents` on the user is just a filter list; there is no
per-skill or per-agent invocation tracking. Messages have `role`/`textContent`
but no structured `skills`/`mentions` fields.

**Rough shape**:

- Add `skills` and `agentMentions` optional array fields to `messages` schema
  (or a new `skillInvocations` table keyed by `userId` + `messageId`).
- Update sync plugins (opencode-sync-plugin, claude-code-sync, etc.) to emit
  skill/mention metadata when they have it.
- Add a `skillStats` query in `analytics.ts` returning top skills/agents by
  run count.
- Render in `ProfileSection` as a "Most used plugins" list.

**Effort**: Medium-large. Schema + plugin protocol + UI.

## 2. Most used reasoning effort %

**Synara reference**: `profileStats.ts` reads `reasoningEffort`/`effort` from
`model_selection_json` per turn and surfaces "Most used reasoning" with a
percentage.

**OpenSync gap**: `sessions` and `messages` have no `reasoning`/`effort` field.
The model name is captured but not the reasoning effort selection.

**Rough shape**:

- Add optional `reasoningEffort` (or `effort`) string field to `sessions`
  (and/or `messages`) schema.
- Update sync plugins to emit it where the source tool exposes it (Codex/Claude
  often do; OpenCode may).
- Add reasoning aggregation to `activityStats` (or a new `insightsStats`
  query) returning top reasoning + percent.
- Render as an `InsightRow` in `ProfileSection`.

**Effort**: Medium. Schema + plugin protocol + small UI addition.

## 3. Share card export (not yet requested, noted for completeness)

**Synara reference**: `ShareDialog` + `ShareCard` render a shareable image of
the profile using `html-to-image`.

**OpenSync gap**: No share dialog. The profile section added in the first slice
is in-app only.

**Rough shape**:

- New `ShareDialog` component using `html-to-image` (or similar) to export the
  profile section as a PNG.
- Possibly gate behind a public profile route (`/u/:handle`) if sharing should
  be linkable, not just image export.

**Effort**: Medium. New dependency + UI. No schema changes.

## 4. Editable local identity (not yet requested)

**Synara reference**: `EditProfileDialog` + `useProfileName`/`useProfileHandle`/
`useProfileAvatarColor`/`useProfileAvatarImage` let the user override name,
handle, avatar color, and avatar image, persisted locally.

**OpenSync gap**: Identity comes entirely from WorkOS (`firstName`, `lastName`,
`email`, `profilePictureUrl`). No local override fields.

**Rough shape**:

- Add optional `displayName`, `handle`, `avatarColor`, `avatarImageStorageId`
  fields to `users` schema.
- Add mutations to update them; `users.me` query returns overrides merged with
  WorkOS identity.
- New `EditProfileDialog` component.

**Effort**: Medium. Schema + mutations + UI.
