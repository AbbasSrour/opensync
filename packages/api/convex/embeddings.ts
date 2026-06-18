import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { embed, embedMany } from "./lib/ai";

// Only these roles carry meaningful search signal. Tool/system messages are
// structured noise and dilute retrieval relevance, so they are not embedded.
const EMBEDDABLE_ROLES = new Set(["user", "assistant"]);

// Messages embedded per batched embedding API call. One HTTP request per chunk
// keeps us well under provider rate limits while one vector is produced per
// message (fine-grained retrieval).
const MESSAGE_EMBED_CHUNK_SIZE = 25;

// Small gap between chunks to smooth bursts against the embedding provider.
const MESSAGE_EMBED_CHUNK_DELAY_MS = 250;

// Hash text for change detection
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Generate embedding for a session
export const generateForSession = internalAction({
  args: { sessionId: v.id("sessions") },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => {
    const data = await ctx.runMutation(internal.sessions.getForEmbedding, {
      sessionId,
    });

    if (!data || !data.textContent) return null;

    const textHash = hashText(data.textContent);

    // Check if already up to date
    const existing = await ctx.runQuery(internal.embeddings.getBySessionAndHash, {
      sessionId,
      textHash,
    });

    if (existing) return null;

    // Generate embedding
    const embedding = await embed(data.textContent);

    // Store
    await ctx.runMutation(internal.embeddings.store, {
      sessionId,
      userId: data.session.userId,
      embedding,
      textHash,
    });

    return null;
  },
});

// Store embedding with idempotency check
export const store = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    embedding: v.array(v.float64()),
    textHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check for existing embedding using index
    const existing = await ctx.db
      .query("sessionEmbeddings")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Idempotency check: early return if already up to date
    if (existing && existing.textHash === args.textHash) {
      return null;
    }

    const now = Date.now();

    if (existing) {
      // Replace existing embedding with new data
      await ctx.db.replace(existing._id, {
        sessionId: args.sessionId,
        userId: args.userId,
        embedding: args.embedding,
        textHash: args.textHash,
        createdAt: now,
      });
    } else {
      // Insert new embedding
      await ctx.db.insert("sessionEmbeddings", {
        sessionId: args.sessionId,
        userId: args.userId,
        embedding: args.embedding,
        textHash: args.textHash,
        createdAt: now,
      });
    }

    return null;
  },
});

// Check if embedding is current
export const getBySessionAndHash = internalQuery({
  args: {
    sessionId: v.id("sessions"),
    textHash: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("sessionEmbeddings"),
      _creationTime: v.number(),
      sessionId: v.id("sessions"),
      userId: v.id("users"),
      embedding: v.array(v.float64()),
      textHash: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, { sessionId, textHash }) => {
    const existing = await ctx.db
      .query("sessionEmbeddings")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();

    if (existing && existing.textHash === textHash) {
      return existing;
    }

    return null;
  },
});

// Batch generate for user
export const batchGenerateForUser = internalAction({
  args: { userId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, { userId }): Promise<number> => {
    const sessions: Id<"sessions">[] = await ctx.runQuery(
      internal.embeddings.getSessionsNeedingEmbeddings,
      {
        userId,
      },
    );

    for (const sessionId of sessions) {
      try {
        await ctx.runAction(internal.embeddings.generateForSession, { sessionId });
      } catch (e) {
        console.error(`Failed to embed session ${sessionId}:`, e);
      }
    }

    return sessions.length;
  },
});

// Get sessions without embeddings
export const getSessionsNeedingEmbeddings = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(v.id("sessions")),
  handler: async (ctx, { userId }) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const needsEmbedding = [];

    for (const session of sessions) {
      const embedding = await ctx.db
        .query("sessionEmbeddings")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .first();

      if (!embedding) {
        needsEmbedding.push(session._id);
      }
    }

    return needsEmbedding;
  },
});

// ============================================================================
// MESSAGE-LEVEL EMBEDDINGS (finer-grained retrieval)
// ============================================================================

// Load a batch of messages for embedding generation. Returns only embeddable
// messages (user/assistant, non-empty text), with the currently stored hash so
// the coordinator can skip unchanged ones.
export const getMessagesForEmbedding = internalQuery({
  args: { messageIds: v.array(v.id("messages")) },
  returns: v.array(
    v.object({
      messageId: v.id("messages"),
      sessionId: v.id("sessions"),
      userId: v.id("users"),
      textContent: v.string(),
      existingHash: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { messageIds }) => {
    const out: Array<{
      messageId: Id<"messages">;
      sessionId: Id<"sessions">;
      userId: Id<"users">;
      textContent: string;
      existingHash: string | null;
    }> = [];

    for (const messageId of messageIds) {
      const message = await ctx.db.get(messageId);
      if (!message || !message.textContent) continue;
      if (!EMBEDDABLE_ROLES.has(message.role)) continue;

      const session = await ctx.db.get(message.sessionId);
      if (!session) continue;

      const existing = await ctx.db
        .query("messageEmbeddings")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .first();

      out.push({
        messageId,
        sessionId: message.sessionId,
        userId: session.userId,
        textContent: message.textContent,
        existingHash: existing ? existing.textHash : null,
      });
    }

    return out;
  },
});

// Coordinator: generate embeddings for a list of messages in burst-safe chunks.
// Embeds one chunk per batched API call, stores each vector, then reschedules
// itself for the remainder. Idempotent — unchanged messages are skipped by hash.
export const enqueueMessageEmbeddings = internalAction({
  args: { messageIds: v.array(v.id("messages")) },
  returns: v.null(),
  handler: async (ctx, { messageIds }): Promise<null> => {
    if (messageIds.length === 0) return null;

    const chunk = messageIds.slice(0, MESSAGE_EMBED_CHUNK_SIZE);
    const rest = messageIds.slice(MESSAGE_EMBED_CHUNK_SIZE);

    const candidates = await ctx.runQuery(internal.embeddings.getMessagesForEmbedding, {
      messageIds: chunk,
    });

    // Compute hashes and drop messages whose embedding is already current.
    const toEmbed = candidates
      .map((c) => ({ ...c, textHash: hashText(c.textContent) }))
      .filter((c) => c.existingHash !== c.textHash);

    if (toEmbed.length > 0) {
      const vectors = await embedMany(toEmbed.map((c) => c.textContent));

      for (let i = 0; i < toEmbed.length; i++) {
        const c = toEmbed[i];
        await ctx.runMutation(internal.embeddings.storeMessageEmbedding, {
          messageId: c.messageId,
          sessionId: c.sessionId,
          userId: c.userId,
          embedding: vectors[i],
          textHash: c.textHash,
        });
      }
    }

    if (rest.length > 0) {
      await ctx.scheduler.runAfter(
        MESSAGE_EMBED_CHUNK_DELAY_MS,
        internal.embeddings.enqueueMessageEmbeddings,
        { messageIds: rest },
      );
    }

    return null;
  },
});

// Store message embedding with idempotency check
export const storeMessageEmbedding = internalMutation({
  args: {
    messageId: v.id("messages"),
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    embedding: v.array(v.float64()),
    textHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check for existing embedding using index
    const existing = await ctx.db
      .query("messageEmbeddings")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();

    // Idempotency check: early return if already up to date
    if (existing && existing.textHash === args.textHash) {
      return null;
    }

    const now = Date.now();

    if (existing) {
      // Replace existing embedding with new data
      await ctx.db.replace(existing._id, {
        messageId: args.messageId,
        sessionId: args.sessionId,
        userId: args.userId,
        embedding: args.embedding,
        textHash: args.textHash,
        createdAt: now,
      });
    } else {
      // Insert new embedding
      await ctx.db.insert("messageEmbeddings", {
        messageId: args.messageId,
        sessionId: args.sessionId,
        userId: args.userId,
        embedding: args.embedding,
        textHash: args.textHash,
        createdAt: now,
      });
    }

    return null;
  },
});

// ============================================================================
// BACKFILL (one-shot, resumable)
// ============================================================================

// Get embeddable messages for a user that don't yet have an embedding.
// Mirrors the coordinator's filter: user/assistant roles with non-empty text.
export const getMessagesNeedingEmbeddings = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(v.id("messages")),
  handler: async (ctx, { userId }) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const needsEmbedding: Id<"messages">[] = [];

    for (const session of sessions) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const message of messages) {
        if (!message.textContent) continue;
        if (!EMBEDDABLE_ROLES.has(message.role)) continue;

        const embedding = await ctx.db
          .query("messageEmbeddings")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .first();

        if (!embedding) {
          needsEmbedding.push(message._id);
        }
      }
    }

    return needsEmbedding;
  },
});

// One-shot backfill for a single user. Finds messages missing embeddings and
// hands them to the burst-safe coordinator. Run via:
//   convex run --prod internal.embeddings.backfillMessagesForUser '{"userId":"..."}'
export const backfillMessagesForUser = internalAction({
  args: { userId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, { userId }): Promise<number> => {
    const messageIds: Id<"messages">[] = await ctx.runQuery(
      internal.embeddings.getMessagesNeedingEmbeddings,
      { userId },
    );

    if (messageIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.embeddings.enqueueMessageEmbeddings, {
        messageIds,
      });
    }

    return messageIds.length;
  },
});

// One-shot backfill for every user. Schedules a per-user backfill for each.
// Run via: convex run --prod internal.embeddings.backfillAllMessages
export const backfillAllMessages = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const userIds: Id<"users">[] = await ctx.runQuery(internal.embeddings.getAllUserIds, {});

    for (const userId of userIds) {
      await ctx.scheduler.runAfter(0, internal.embeddings.backfillMessagesForUser, {
        userId,
      });
    }

    return userIds.length;
  },
});

// List all user IDs (for global backfill fan-out).
export const getAllUserIds = internalQuery({
  args: {},
  returns: v.array(v.id("users")),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => u._id);
  },
});



