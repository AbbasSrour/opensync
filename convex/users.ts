import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { nanoid } from "nanoid";

// Get current user from auth
export const me = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
      hasApiKey: v.boolean(),
      enabledAgents: v.optional(v.array(v.string())),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) return null;

    // Normalize enabledAgents: convert "cursor" -> "cursor-sync" and deduplicate
    let normalizedAgents = user.enabledAgents;
    if (normalizedAgents) {
      normalizedAgents = normalizedAgents.map((a) => (a === "cursor" ? "cursor-sync" : a));
      normalizedAgents = [...new Set(normalizedAgents)];
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      hasApiKey: !!user.apiKey,
      enabledAgents: normalizedAgents,
      createdAt: user.createdAt,
    };
  },
});

// Get or create user from identity (called on login)
export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (existing) {
      // Update if info changed
      if (
        existing.email !== identity.email ||
        existing.name !== identity.name
      ) {
        await ctx.db.patch(existing._id, {
          email: identity.email,
          name: identity.name,
          updatedAt: Date.now(),
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      workosId: identity.subject,
      email: identity.email,
      name: identity.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Generate API key for external access
export const generateApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Generate secure API key
    const apiKey = `osk_${nanoid(32)}`;

    await ctx.db.patch(user._id, {
      apiKey,
      apiKeyCreatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return apiKey;
  },
});

// Revoke API key
export const revokeApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      apiKey: undefined,
      apiKeyCreatedAt: undefined,
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Update enabled AI coding agents for source filter dropdown
export const updateEnabledAgents = mutation({
  args: {
    enabledAgents: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { enabledAgents }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Normalize: convert "cursor" -> "cursor-sync" and deduplicate
    const normalizedAgents = [...new Set(
      enabledAgents.map((a) => (a === "cursor" ? "cursor-sync" : a))
    )];

    // Patch directly for idempotency
    await ctx.db.patch(user._id, {
      enabledAgents: normalizedAgents,
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Get user stats
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) return null;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const totalTokens = sessions.reduce((acc, s) => acc + s.totalTokens, 0);
    const totalCost = sessions.reduce((acc, s) => acc + s.cost, 0);
    const totalMessages = sessions.reduce((acc, s) => acc + s.messageCount, 0);
    const totalDuration = sessions.reduce(
      (acc, s) => acc + (s.durationMs || 0),
      0
    );

    // Model usage breakdown
    const modelUsage: Record<string, number> = {};
    for (const s of sessions) {
      const model = s.model || "unknown";
      modelUsage[model] = (modelUsage[model] || 0) + s.totalTokens;
    }

    return {
      sessionCount: sessions.length,
      messageCount: totalMessages,
      totalTokens,
      totalCost,
      totalDurationMs: totalDuration,
      modelUsage,
    };
  },
});

// Internal: get user by API key
export const getByApiKey = internalMutation({
  args: { apiKey: v.string() },
  handler: async (ctx, { apiKey }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_api_key", (q) => q.eq("apiKey", apiKey))
      .first();
  },
});

// Internal: get user by WorkOS ID
export const getByWorkosId = internalMutation({
  args: { workosId: v.string() },
  handler: async (ctx, { workosId }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
      .first();

    if (existing) return existing;

    // Create if doesn't exist
    const userId = await ctx.db.insert("users", {
      workosId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});

// Delete all user data (keeps account intact)
// Deletes: parts, messages, sessionEmbeddings, messageEmbeddings, dailyWrapped, sessions, apiLogs
export const deleteAllData = mutation({
  args: {},
  returns: v.object({ deleted: v.boolean(), counts: v.object({
    sessions: v.number(),
    messages: v.number(),
    parts: v.number(),
    sessionEmbeddings: v.number(),
    messageEmbeddings: v.number(),
    dailyWrapped: v.number(),
    apiLogs: v.number(),
  })}),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Delete all user data using the internal helper
    const counts = await deleteUserData(ctx, user._id);

    return { deleted: true, counts };
  },
});

// Internal: delete all user data (used by deleteAccount action)
export const deleteAllDataInternal = internalMutation({
  args: { userId: v.id("users"), deleteUser: v.boolean() },
  returns: v.object({
    sessions: v.number(),
    messages: v.number(),
    parts: v.number(),
    sessionEmbeddings: v.number(),
    messageEmbeddings: v.number(),
    dailyWrapped: v.number(),
    apiLogs: v.number(),
  }),
  handler: async (ctx, { userId, deleteUser }) => {
    const counts = await deleteUserData(ctx, userId);
    
    // Optionally delete the user record itself
    if (deleteUser) {
      await ctx.db.delete(userId);
    }

    return counts;
  },
});

// Helper function to delete all user data with parallel deletes for performance
async function deleteUserData(ctx: any, userId: any) {
  const counts = {
    sessions: 0,
    messages: 0,
    parts: 0,
    sessionEmbeddings: 0,
    messageEmbeddings: 0,
    dailyWrapped: 0,
    apiLogs: 0,
  };

  // Get all sessions for this user
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  // Collect all message IDs and part IDs first, then delete in parallel
  const allMessageIds: any[] = [];
  const allPartIds: any[] = [];

  for (const session of sessions) {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q: any) => q.eq("sessionId", session._id))
      .collect();

    for (const message of messages) {
      allMessageIds.push(message._id);

      const parts = await ctx.db
        .query("parts")
        .withIndex("by_message", (q: any) => q.eq("messageId", message._id))
        .collect();

      for (const part of parts) {
        allPartIds.push(part._id);
      }
    }
  }

  // Delete parts in parallel (child records first)
  if (allPartIds.length > 0) {
    await Promise.all(allPartIds.map((id) => ctx.db.delete(id)));
    counts.parts = allPartIds.length;
  }

  // Delete messages in parallel
  if (allMessageIds.length > 0) {
    await Promise.all(allMessageIds.map((id) => ctx.db.delete(id)));
    counts.messages = allMessageIds.length;
  }

  // Delete sessions in parallel
  if (sessions.length > 0) {
    await Promise.all(sessions.map((s: any) => ctx.db.delete(s._id)));
    counts.sessions = sessions.length;
  }

  // Delete session embeddings in parallel
  const sessionEmbeddings = await ctx.db
    .query("sessionEmbeddings")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (sessionEmbeddings.length > 0) {
    await Promise.all(sessionEmbeddings.map((e: any) => ctx.db.delete(e._id)));
    counts.sessionEmbeddings = sessionEmbeddings.length;
  }

  // Delete message embeddings in parallel
  const messageEmbeddings = await ctx.db
    .query("messageEmbeddings")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (messageEmbeddings.length > 0) {
    await Promise.all(messageEmbeddings.map((e: any) => ctx.db.delete(e._id)));
    counts.messageEmbeddings = messageEmbeddings.length;
  }

  // Delete daily wrapped images in parallel
  const dailyWrappeds = await ctx.db
    .query("dailyWrapped")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (dailyWrappeds.length > 0) {
    await Promise.all(dailyWrappeds.map((d: any) => ctx.db.delete(d._id)));
    counts.dailyWrapped = dailyWrappeds.length;
  }

  // Delete API logs in parallel
  const apiLogs = await ctx.db
    .query("apiLogs")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  if (apiLogs.length > 0) {
    await Promise.all(apiLogs.map((l: any) => ctx.db.delete(l._id)));
    counts.apiLogs = apiLogs.length;
  }

  return counts;
}

// Internal query to get user info for deletion
export const getUserForDeletion = internalMutation({
  args: { workosId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      workosId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { workosId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosId))
      .first();

    if (!user) return null;

    return {
      _id: user._id,
      workosId: user.workosId,
    };
  },
});

// Delete account action - deletes Convex data first, then WorkOS account
// This ensures data is deleted even if WorkOS has side effects (session invalidation)
// Calls WorkOS API: DELETE /user_management/users/{user_id}
export const deleteAccount = action({
  args: {},
  returns: v.object({ deleted: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx): Promise<{ deleted: boolean; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { deleted: false, error: "Not authenticated" };
    }

    // Get the user record
    const user: { _id: any; workosId: string } | null = await ctx.runMutation(
      internal.users.getUserForDeletion,
      { workosId: identity.subject }
    );

    if (!user) {
      return { deleted: false, error: "User not found" };
    }

    // Get the WorkOS API key
    const workosApiKey = process.env.WORKOS_API_KEY;
    if (!workosApiKey) {
      return { deleted: false, error: "WorkOS API key not configured" };
    }

    try {
      // IMPORTANT: Delete Convex data FIRST before WorkOS
      // WorkOS deletion may invalidate sessions and cause redirects
      await ctx.runMutation(internal.users.deleteAllDataInternal, {
        userId: user._id,
        deleteUser: true,
      });

      // Now delete from WorkOS
      // API Reference: https://workos.com/docs/reference/authkit/user/delete
      const response: Response = await fetch(
        `https://api.workos.com/user_management/users/${user.workosId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${workosApiKey}`,
          },
        }
      );

      // 204 = success (no content), 404 = user already deleted
      if (!response.ok && response.status !== 404) {
        // Note: Convex data is already deleted at this point
        // Log the error but still consider it a success since data is gone
        console.error(`WorkOS deletion failed: ${response.status}`);
      }

      return { deleted: true };
    } catch (error) {
      return {
        deleted: false,
        error: `Failed to delete account: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
