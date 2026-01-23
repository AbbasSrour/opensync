# Codex Sync Sessions Fix

Documentation of the fixes required to get codex-sync sessions syncing correctly to OpenSync.

## Problem Summary

Sessions synced from the codex-sync plugin were displaying incorrectly in OpenSync:

- Token counts showing as 0
- Session titles showing as "Untitled Session"
- Message content appearing empty/blank
- CLI version stuck at 1.0.0

## Root Causes

### 1. Field Name Mismatch (Tokens)

The OpenSync backend schema uses:

- `promptTokens` (input tokens)
- `completionTokens` (output tokens)

The codex-sync plugin was sending:

- `inputTokens`
- `outputTokens`
- `totalTokens`

The backend silently ignored the misnamed fields, resulting in 0 token counts.

**Fix:** Updated `SyncSessionData` type and `transformSession()` to use correct field names.

```typescript
// Before (wrong)
return {
  totalTokens: session.tokenUsage.total,
  inputTokens: session.tokenUsage.input,
  outputTokens: session.tokenUsage.output,
};

// After (correct)
return {
  promptTokens: session.tokenUsage.input,
  completionTokens: session.tokenUsage.output,
};
```

### 2. Message Schema Mismatch

The OpenSync `messages:upsert` mutation expects:

- `externalId` (required) - unique ID for the message
- `sessionExternalId` - links to session's externalId
- `textContent` - the message text

The plugin was sending:

- No `externalId` (causing ArgumentValidationError)
- `sessionId` instead of `sessionExternalId`
- `content` instead of `textContent`

**Fix:** Updated `SyncMessageData` type and `transformMessages()`:

```typescript
// Before (wrong)
{
  sessionId: openSyncSessionId,
  content: msg.content,
}

// After (correct)
{
  externalId: generateMessageId(session.id, msgIndex++, msg.role),
  sessionExternalId: session.id,
  textContent: msg.content,
}
```

### 3. Content Type Parsing

Codex CLI uses different content type names than expected:

- May use `OutputText`, `output_text`, or `text`
- Types can be mixed case

**Fix:** Added flexible `extractTextFromContent()` helper with case-insensitive matching:

```typescript
function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const type = c.type?.toLowerCase() || "";
        if (
          (type === "outputtext" ||
            type === "output_text" ||
            type === "text") &&
          c.text
        ) {
          return c.text;
        }
        if (c.text) return c.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}
```

### 4. Hardcoded Version

The CLI version was hardcoded as `const VERSION = '1.0.0'`, so updates never showed the correct version.

**Fix:** Added dynamic version reading from package.json:

```typescript
function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}
```

### 5. Convex URL Format

Users enter `.convex.cloud` URLs (from dashboard) but HTTP endpoints use `.convex.site`.

**Fix:** Added URL normalization:

```typescript
function normalizeConvexUrl(convexUrl: string): string {
  return convexUrl.replace(".convex.cloud", ".convex.site");
}
```

### 6. Token Count Parsing

Early `token_count` events have `info: null`, only later events contain cumulative totals.

**Fix:** Added null-safe access and cumulative total tracking:

```typescript
const usage = tokenMsg.info?.total_token_usage;
if (usage) {
  const newTotal = usage.total_tokens || 0;
  if (newTotal > tokenUsage.total) {
    tokenUsage.input = usage.input_tokens || 0;
    tokenUsage.output = usage.output_tokens || 0;
    // ... update other fields
  }
}
```

## Files Modified

| File            | Changes                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `src/types.ts`  | Updated `SyncSessionData` and `SyncMessageData` interfaces to match backend |
| `src/client.ts` | Fixed field mappings, added dynamic versioning, URL normalization           |
| `src/parser.ts` | Added flexible content extraction, null-safe token parsing                  |
| `src/cli.ts`    | Added dynamic version reading                                               |

## Version History

| Version | Fix                                                                    |
| ------- | ---------------------------------------------------------------------- |
| 1.0.2   | Convex URL normalization (.convex.cloud -> .convex.site)               |
| 1.0.3   | Null-safe token usage parsing                                          |
| 1.0.4   | Cumulative token tracking, model extraction from turn_context          |
| 1.0.5   | Project path extraction (show folder name, not full path)              |
| 1.0.6   | Message schema fixes (externalId, sessionExternalId, textContent)      |
| 1.0.7   | Token field names (promptTokens, completionTokens), content extraction |

## Debugging Tips

If sessions still show issues:

1. **Check Convex logs** for ArgumentValidationError or schema mismatches
2. **Enable debug mode**: `codex-sync config set debug true`
3. **Verify session files exist**: Check `~/.codex/sessions/` for JSONL files
4. **Test connection**: `codex-sync status`

## Key Learnings

1. Always verify field names match the backend schema exactly
2. Backend silent field ignoring makes debugging difficult - check Convex logs
3. CLI tools should read version from package.json, not hardcode it
4. Different AI tools may use different content type naming conventions
5. Token counts in streaming events are cumulative, not per-event
