import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { joinTextParts } from "./lib/parts";

// Dedup window to prevent rapid updates causing write conflicts
const MESSAGE_DEDUP_MS = 5 * 1000;

// Internal: upsert message from sync
export const upsert = internalMutation({
  args: {
    userId: v.id("users"),
    sessionExternalId: v.string(),
    externalId: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("unknown"),
    ),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    cachedTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    // Source identifier passed from plugin ("opencode" or "claude-code")
    source: v.optional(v.string()),
    // Canonical message parts. Source of truth for all message text.
    parts: v.array(
      v.object({
        type: v.string(),
        content: v.any(),
      }),
    ),
    createdAt: v.optional(v.number()), // Original timestamp from source
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find session using index
    let session = await ctx.db
      .query("sessions")
      .withIndex("by_user_external", (q) =>
        q.eq("userId", args.userId).eq("externalId", args.sessionExternalId),
      )
      .first();

    // Store session data we need for later (avoid re-reading)
    let sessionId: Id<"sessions">;
    let sessionMessageCount: number;
    let sessionSearchableText: string | undefined;

    // Look up an existing message by its session-scoped identity. A message is
    // unique within its session, and the session is already user-scoped, so this
    // makes resync idempotent without relying on the optional message.userId.
    const existingSessionId = session?._id;
    const existing = existingSessionId
      ? await ctx.db
          .query("messages")
          .withIndex("by_session_external", (q) =>
            q.eq("sessionId", existingSessionId).eq("externalId", args.externalId),
          )
          .first()
      : null;

    // Early return if message exists and was recently updated (idempotent)
    if (existing && now - existing.createdAt < MESSAGE_DEDUP_MS) {
      return existing._id;
    }

    // Auto-create session if it doesn't exist (handles out-of-order sync)
    if (!session) {
      // Normalize source: "cursor" -> "cursor-sync" for consistency
      const rawSource = args.source || "opencode";
      const normalizedSource = rawSource === "cursor" ? "cursor-sync" : rawSource;
      sessionId = await ctx.db.insert("sessions", {
        userId: args.userId,
        externalId: args.sessionExternalId,
        title: undefined,
        projectPath: undefined,
        projectName: undefined,
        model: args.model,
        provider: undefined,
        source: normalizedSource,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        durationMs: undefined,
        isPublic: false,
        searchableText: undefined,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      // Use defaults since we just created it
      sessionMessageCount = 0;
      sessionSearchableText = undefined;
    } else {
      sessionId = session._id;
      sessionMessageCount = session.messageCount;
      sessionSearchableText = session.searchableText;
    }

    let messageId: Id<"messages">;
    let shouldUpdateSessionStats = false;

    // Derive flat text from canonical parts (source of truth for all text).
    const searchText = joinTextParts(args.parts);

    if (existing) {
      // Update existing message - patch directly without re-reading
      await ctx.db.patch(existing._id, {
        userId: existing.userId ?? args.userId,
        searchText,
        model: args.model ?? existing.model,
        provider: args.provider ?? existing.provider,
        promptTokens: args.promptTokens ?? existing.promptTokens,
        completionTokens: args.completionTokens ?? existing.completionTokens,
        cachedTokens: args.cachedTokens ?? existing.cachedTokens,
        cost: args.cost ?? existing.cost,
        durationMs: args.durationMs ?? existing.durationMs,
      });
      messageId = existing._id;

      // Delete existing parts in parallel
      const existingParts = await ctx.db
        .query("parts")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .collect();

      if (existingParts.length > 0) {
        await Promise.all(existingParts.map((part) => ctx.db.delete(part._id)));
      }
    } else {
      // Create new message - use provided createdAt or current time
      const messageCreatedAt = args.createdAt ?? now;
      messageId = await ctx.db.insert("messages", {
        sessionId,
        userId: args.userId,
        externalId: args.externalId,
        role: args.role,
        searchText,
        model: args.model,
        provider: args.provider,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        cachedTokens: args.cachedTokens,
        cost: args.cost,
        durationMs: args.durationMs,
        createdAt: messageCreatedAt,
      });
      shouldUpdateSessionStats = true;
    }

    // Insert parts in parallel
    if (args.parts.length > 0) {
      await Promise.all(
        args.parts.map((part, i) =>
          ctx.db.insert("parts", {
            messageId,
            type: part.type,
            content: part.content,
            order: i,
          }),
        ),
      );
    }

    // Build session searchable text from this message's derived text.
    let newSearchableText: string | undefined;
    if (searchText) {
      const currentText = sessionSearchableText || "";
      newSearchableText = `${currentText} ${searchText}`.slice(0, 10000);
    }

    // Single combined patch for session updates (avoids multiple writes).
    // Deliberately does NOT touch updatedAt: session recency is owned by
    // session-level sync and derived from the source timestamp, so message
    // syncs must not bump it to the sync time.
    if (shouldUpdateSessionStats || newSearchableText) {
      const sessionUpdate: Record<string, unknown> = {};

      if (shouldUpdateSessionStats) {
        // Only update messageCount. Session tokens are set exclusively by
        // session-level sync (the authoritative source). Never accumulate
        // per-message tokens onto the session to avoid double-counting.
        sessionUpdate.messageCount = sessionMessageCount + 1;
      }

      if (newSearchableText) {
        sessionUpdate.searchableText = newSearchableText;
      }

      await ctx.db.patch(sessionId, sessionUpdate);
    }

    return messageId;
  },
});

// Message input type for batch upsert
const messageInputValidator = v.object({
  sessionExternalId: v.string(),
  externalId: v.string(),
  role: v.union(
    v.literal("user"),
    v.literal("assistant"),
    v.literal("system"),
    v.literal("tool"),
    v.literal("unknown"),
  ),
  model: v.optional(v.string()),
  provider: v.optional(v.string()),
  promptTokens: v.optional(v.number()),
  completionTokens: v.optional(v.number()),
  cachedTokens: v.optional(v.number()),
  cost: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  source: v.optional(v.string()),
  createdAt: v.optional(v.number()), // Original timestamp from source
  // Canonical message parts. Source of truth for all message text.
  parts: v.array(
    v.object({
      type: v.string(),
      content: v.any(),
    }),
  ),
});

// Internal: batch upsert messages in a single transaction
export const batchUpsert = internalMutation({
  args: {
    userId: v.id("users"),
    messages: v.array(messageInputValidator),
  },
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
    // IDs of messages inserted or updated this batch (for embedding generation)
    messageIds: v.array(v.id("messages")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<string> = [];
    const messageIds: Array<Id<"messages">> = [];

    // Group messages by session for efficient processing
    const messagesBySession = new Map<string, typeof args.messages>();
    for (const msg of args.messages) {
      const existing = messagesBySession.get(msg.sessionExternalId) || [];
      existing.push(msg);
      messagesBySession.set(msg.sessionExternalId, existing);
    }

    // Process each session's messages
    for (const [sessionExternalId, messages] of messagesBySession) {
      // Find or create session
      let session = await ctx.db
        .query("sessions")
        .withIndex("by_user_external", (q) =>
          q.eq("userId", args.userId).eq("externalId", sessionExternalId),
        )
        .first();

      // Track session stats for batch update
      let sessionMessageCount = 0;
      let sessionSearchableText = "";
      let sessionId: Id<"sessions">;

      if (!session) {
        // Create session for out-of-order messages
        const firstMsg = messages[0];
        // Normalize source: "cursor" -> "cursor-sync" for consistency
        const rawSource = firstMsg.source || "opencode";
        const normalizedSource = rawSource === "cursor" ? "cursor-sync" : rawSource;
        sessionId = await ctx.db.insert("sessions", {
          userId: args.userId,
          externalId: sessionExternalId,
          title: undefined,
          projectPath: undefined,
          projectName: undefined,
          model: firstMsg.model,
          provider: undefined,
          source: normalizedSource,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          durationMs: undefined,
          isPublic: false,
          searchableText: undefined,
          messageCount: 0,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        sessionId = session._id;
        sessionMessageCount = session.messageCount;
        sessionSearchableText = session.searchableText || "";
      }

      // Process messages in parallel
      const results = await Promise.all(
        messages.map(async (msg) => {
          try {
            // Check if message exists, scoped to its session (session is already
            // user-scoped) so resync is idempotent without relying on userId.
            const existing = await ctx.db
              .query("messages")
              .withIndex("by_session_external", (q) =>
                q.eq("sessionId", sessionId).eq("externalId", msg.externalId),
              )
              .first();

            // Early return for dedup
            if (existing && now - existing.createdAt < MESSAGE_DEDUP_MS) {
              return { action: "skipped" as const, text: "", messageId: existing._id };
            }

            let messageId: Id<"messages">;

            // Derive flat text from canonical parts (source of truth).
            const searchText = joinTextParts(msg.parts);

            if (existing) {
              // Update existing
              await ctx.db.patch(existing._id, {
                userId: existing.userId ?? args.userId,
                searchText,
                model: msg.model ?? existing.model,
                provider: msg.provider ?? existing.provider,
                promptTokens: msg.promptTokens ?? existing.promptTokens,
                completionTokens: msg.completionTokens ?? existing.completionTokens,
                cachedTokens: msg.cachedTokens ?? existing.cachedTokens,
                cost: msg.cost ?? existing.cost,
                durationMs: msg.durationMs ?? existing.durationMs,
              });
              messageId = existing._id;

              // Delete existing parts in parallel
              const existingParts = await ctx.db
                .query("parts")
                .withIndex("by_message", (q) => q.eq("messageId", messageId))
                .collect();
              if (existingParts.length > 0) {
                await Promise.all(existingParts.map((p) => ctx.db.delete(p._id)));
              }

              // Re-insert parts so updated messages keep parts in sync.
              if (msg.parts.length > 0) {
                await Promise.all(
                  msg.parts.map((part, i) =>
                    ctx.db.insert("parts", {
                      messageId,
                      type: part.type,
                      content: part.content,
                      order: i,
                    }),
                  ),
                );
              }

              return { action: "updated" as const, text: "", messageId };
            }

            // Insert new message
            messageId = await ctx.db.insert("messages", {
              sessionId,
              userId: args.userId,
              externalId: msg.externalId,
              role: msg.role,
              searchText,
              model: msg.model,
              provider: msg.provider,
              promptTokens: msg.promptTokens,
              completionTokens: msg.completionTokens,
              cachedTokens: msg.cachedTokens,
              cost: msg.cost,
              durationMs: msg.durationMs,
              createdAt: msg.createdAt ?? now,
            });

            // Insert parts in parallel
            if (msg.parts.length > 0) {
              await Promise.all(
                msg.parts.map((part, i) =>
                  ctx.db.insert("parts", {
                    messageId,
                    type: part.type,
                    content: part.content,
                    order: i,
                  }),
                ),
              );
            }

            return { action: "inserted" as const, text: searchText, messageId };
          } catch (e) {
            return {
              action: "error" as const,
              error: `${msg.externalId}: ${e}`,
              text: "",
              messageId: null,
            };
          }
        }),
      );

      // Aggregate results for session update
      let newMessages = 0;
      const textParts: Array<string> = [];

      for (const result of results) {
        if (result.action === "inserted") {
          inserted++;
          newMessages++;
          if (result.text) textParts.push(result.text);
          if (result.messageId) messageIds.push(result.messageId);
        } else if (result.action === "updated") {
          updated++;
          if (result.messageId) messageIds.push(result.messageId);
        } else if (result.action === "skipped") {
          skipped++;
        } else if (result.action === "error") {
          errors.push(result.error || "Unknown error");
        }
      }

      // Single session update for all new messages. Only messageCount and searchableText.
      // Session tokens are set exclusively by session-level sync (the authoritative source).
      // Never accumulate per-message tokens onto the session to avoid double-counting.
      if (newMessages > 0 || textParts.length > 0) {
        const newSearchable =
          textParts.length > 0
            ? `${sessionSearchableText} ${textParts.join(" ")}`.slice(0, 10000)
            : sessionSearchableText;

        // Does NOT touch updatedAt: session recency is owned by session-level
        // sync and derived from the source timestamp.
        await ctx.db.patch(sessionId, {
          messageCount: sessionMessageCount + newMessages,
          searchableText: newSearchable || undefined,
        });
      }
    }

    return { inserted, updated, skipped, errors, messageIds };
  },
});
