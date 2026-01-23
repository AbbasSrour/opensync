# Add New Plugin to OpenSync

## Required Information

- Package name (npm): \_\_\_
- GitHub URL: \_\_\_
- Source ID (lowercase, hyphenated): \_\_\_
- Display name: \_\_\_
- Short label (2 chars): \_\_\_
- Status: supported | community | planned
- Badge color: blue | amber | orange | purple | green
- CLI commands: login, sync, etc.

## Files to Update (in order)

### 1. README.md

Location: Root - Ecosystem table
Action: Add row with package name, description, GitHub/npm links

### 2. src/pages/Settings.tsx

Locations:

- AI_AGENTS array (~line 49): Add entry with id, name, status, defaultEnabled, url
- Plugin Setup section (~line 254): Add npm/GitHub links
- Quick Setup section (~line 371): Add install commands

### 3. src/pages/Dashboard.tsx

Location: AI_AGENTS_MAP (~line 59)
Action: Add source-id to display name mapping (if not already present)

### 4. src/pages/Login.tsx

Locations:

- getSourceDisplayName (~line 110): Add mapping
- Syncs with section (~line 621): Add icon
- Getting started section (~line 699): Add package link

### 5. src/lib/source.ts

Locations:

- SourceType (~line 2): Add to union type
- getSourceLabel (~line 9): Add short/full label mappings
- getSourceColorClass (~line 22): Add themed color classes

### 6. src/pages/Docs.tsx

Locations:

- searchIndex array (~line 41): Add search entries
- Documentation content: Add full plugin section

### 7. convex/analytics.ts

Location: inferProvider (~line 13)
Action: Add model pattern matching if needed

### 8. files.md

Action: Update relevant descriptions

### 9. changelog.md

Action: Add changelog entry following changelog.mdc format

## Testing Checklist

- [ ] Package appears in README Ecosystem table
- [ ] Agent shows in Settings with correct status badge
- [ ] Source filter dropdown includes new agent when enabled
- [ ] Icon appears in "Syncs with" section
- [ ] Package link appears in "Getting started"
- [ ] Source badges display correct label and color
- [ ] Docs search finds plugin entries
- [ ] Full documentation section is navigable
- [ ] Platform Stats shows correct display name
