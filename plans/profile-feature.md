# Profile Feature (from Synara)

Source of inspiration: Synara's Profile settings panel
(`/tmp/synara/apps/web/src/components/settings/ProfileSettingsPanel.tsx` +
`/tmp/synara/apps/server/src/profileStats.ts`).

## Goal

Bring a Synara-style profile/activity dashboard to OpenSync. First slice focuses
on **heatmap + streaks** and **insights (most active hour, most worked project,
total prompts sent)**. Heavier features (skills run tracking, reasoning effort,
share card, editable local identity) are deferred to a planned-features doc.

## Placement decision

- **Landing target: Dashboard (`/dashboard`)** — the authenticated app home.
- **Confirmed: new section inside the existing Overview view** (the Dashboard
  landing). No new tab. Placed alongside the stat tiles and recent sessions so
  it's visible immediately on sign-in.

## Scope — first pass (in scope)

| Feature                 | Source data (existing)                        | New work                      |
| ----------------------- | --------------------------------------------- | ----------------------------- |
| Activity heatmap (9-mo) | `sessions.createdAt`                          | New Convex query + heatmap UI |
| Current streak          | `sessions.createdAt` (per-day set)            | Compute in Convex query       |
| Longest streak          | `sessions.createdAt` (per-day set)            | Compute in Convex query       |
| Peak day tokens         | `sessions.createdAt` + `sessions.totalTokens` | Compute in Convex query       |
| Most active hour        | `sessions.createdAt` grouped by hour          | Compute in Convex query       |
| Most worked project     | `sessions.projectName/Path` + `messageCount`  | Compute in Convex query       |
| Total prompts sent      | `summaryStats.totalMessages` (already exists) | Reuse existing tile           |

## Scope — deferred (planned-features doc only)

- Skills / agent run tracking (needs schema field on messages/parts)
- Most used reasoning effort % (needs `reasoning` field on sessions/messages)
- Share card export (needs html-to-image style export)
- Editable local identity: name/handle, avatar color, avatar image upload
  (needs new user fields + file storage)

## Implementation shape

### 1. Convex query — `packages/api/convex/analytics.ts`

Add `activityStats` query (single round-trip, reuses the same auth + sessions
fetch pattern as `summaryStats`). Returns:

```ts
{
  heatmap: Array<{ day: string; count: number; weekday: number; intensity: 0|1|2|3|4 }>;
  currentStreakDays: number;
  longestStreakDays: number;
  peakDay: { day: string; tokens: number } | null;
  mostActiveHour: number | null;        // 0-23
  mostWorkedProject: {
    project: string;
    promptCount: number;
    sessionCount: number;
  } | null;
  promptsToday: number;
  totalPromptsSent: number;              // sum of messageCount
}
```

Pure helpers (ported from Synara, framework-agnostic):

- `addDaysIso(day, delta)`, `weekdayOf(day)`, `localToday()`
- `computeStreaks(activeDaysAsc, todayKey)` → { current, longest }
- `buildHeatmap(countByDay, todayKey)` → cells with intensity buckets
- `heatmapIntensity(count, max)` → 0..4 ramp

These are pure functions with no Synara-specific deps — safe to port verbatim.

### 2. UI — `apps/website/src/components/`

- New `ActivityHeatmap.tsx` — GitHub-style grid. Port Synara's component shape
  but adapt to OpenSync's theme system (`getThemeClasses`, `cn`, lucide icons)
  instead of Synara's shadcn/Radix stack. Inline-px sizing kept simple.
- New `ProfileSection.tsx` — composes: stat tiles (streaks, peak day, prompts),
  heatmap, insights list (most active hour, most worked project). Consumes the
  new `activityStats` query plus existing `summaryStats`.

### 3. Dashboard integration — `apps/website/src/pages/Dashboard.tsx`

- Add `const activityStats = useQuery(api.analytics.activityStats, { source: sourceArg });`
  next to existing analytics queries.
- Render `<ProfileSection>` inside `OverviewView` (placement TBD per question
  above), passing `activityStats`, `summaryStats`, `theme`.

### 4. Planned-features doc — `plans/profile-feature-deferred.md`

Capture the deferred items with notes on schema impact and rough effort, so
they're not lost.

## Verification

- `vp check` (format, lint, typecheck) on changed files.
- `vp test` for any analytics tests if present.
- Manual: load Dashboard, confirm heatmap renders with real session data,
  streaks/hour/project values look sane; verify dark + tan themes.

## Status

- [x] Placement detail confirmed (section in Overview)
- [x] Convex `activityStats` query
- [x] `ActivityHeatmap` component
- [x] `ProfileSection` component
- [x] Dashboard integration
- [x] Planned-features doc
- [x] Verification (`vp check`, `vp test`) — my files clean; 5 pre-existing errors in Settings.tsx/Updates.tsx unrelated to this change; 39/39 tests pass
