import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Helper to get PT timezone date string
function getPTDateString(timestamp?: number): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

// Helper to get next 9:30 AM PT timestamp
function getNext930AMPT(): number {
  const now = new Date();
  // Convert to PT
  const ptString = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
  });
  const ptDate = new Date(ptString);

  // Set to 9:30 AM
  const target = new Date(ptDate);
  target.setHours(9, 30, 0, 0);

  // If we're past 9:30 AM PT today, move to tomorrow
  if (ptDate >= target) {
    target.setDate(target.getDate() + 1);
  }

  // Convert back to UTC timestamp
  const isDST = ptDate.getTimezoneOffset() < 480;
  const offsetMinutes = isDST ? -7 * 60 : -8 * 60;

  return target.getTime() - offsetMinutes * 60 * 1000;
}

// Helper to infer provider from model name
function inferProvider(model?: string): string {
  if (!model) return "unknown";
  const m = model.toLowerCase();
  if (m.includes("claude") || m.includes("anthropic")) return "anthropic";
  if (m.includes("gpt") || m.includes("o1") || m.includes("o3") || m.includes("davinci"))
    return "openai";
  if (m.includes("gemini") || m.includes("palm")) return "google";
  if (m.includes("mistral") || m.includes("mixtral")) return "mistral";
  if (m.includes("deepseek")) return "deepseek";
  if (m.includes("llama") || m.includes("meta")) return "meta";
  return "unknown";
}

// Validator for wrapped stats (sessionCount optional for backward compatibility)
export const wrappedStatsValidator = v.object({
  totalTokens: v.number(),
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalMessages: v.number(),
  sessionCount: v.optional(v.number()),
  cost: v.number(),
  topModels: v.array(
    v.object({
      model: v.string(),
      tokens: v.number(),
    }),
  ),
  topProviders: v.array(
    v.object({
      provider: v.string(),
      tokens: v.number(),
    }),
  ),
});

// Get today's wrapped for the current user
export const getTodayWrapped = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("dailyWrapped"),
      userId: v.id("users"),
      date: v.string(),
      designIndex: v.number(),
      imageUrl: v.union(v.string(), v.null()),
      generatedAt: v.number(),
      expiresAt: v.number(),
      stats: wrappedStatsValidator,
      timeUntilExpiry: v.number(),
      nextGenerationAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) return null;

    const today = getPTDateString();
    const wrapped = await ctx.db
      .query("dailyWrapped")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id).eq("date", today))
      .first();

    if (!wrapped) return null;

    // Get image URL if exists
    let imageUrl: string | null = null;
    if (wrapped.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(wrapped.imageStorageId);
    }

    const now = Date.now();
    return {
      _id: wrapped._id,
      userId: wrapped.userId,
      date: wrapped.date,
      designIndex: wrapped.designIndex,
      imageUrl,
      generatedAt: wrapped.generatedAt,
      expiresAt: wrapped.expiresAt,
      stats: wrapped.stats,
      timeUntilExpiry: Math.max(0, wrapped.expiresAt - now),
      nextGenerationAt: getNext930AMPT(),
    };
  },
});

// Get 24-hour stats for wrapped generation (internal use)
export const get24HourStats = internalQuery({
  args: { userId: v.id("users") },
  returns: wrappedStatsValidator,
  handler: async (ctx, { userId }) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter to last 24 hours
    const recentSessions = sessions.filter((s) => s.createdAt >= cutoff);

    // Aggregate stats
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalMessages = 0;
    let cost = 0;

    const modelMap: Record<string, number> = {};
    const providerMap: Record<string, number> = {};

    for (const session of recentSessions) {
      totalTokens += session.totalTokens;
      promptTokens += session.promptTokens;
      completionTokens += session.completionTokens;
      totalMessages += session.messageCount || 0;
      cost += session.cost;

      // Model aggregation
      const model = session.model || "unknown";
      modelMap[model] = (modelMap[model] || 0) + session.totalTokens;

      // Provider aggregation (with inference)
      const provider = session.provider || inferProvider(session.model);
      providerMap[provider] = (providerMap[provider] || 0) + session.totalTokens;
    }

    // Sort and take top 5
    const topModels = Object.entries(modelMap)
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    const topProviders = Object.entries(providerMap)
      .map(([provider, tokens]) => ({ provider, tokens }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    return {
      totalTokens,
      promptTokens,
      completionTokens,
      totalMessages,
      sessionCount: recentSessions.length,
      cost,
      topModels,
      topProviders,
    };
  },
});

// Get stats for current user (public query for fallback display)
export const getWrappedStats = query({
  args: {},
  returns: v.union(wrappedStatsValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
      .first();

    if (!user) return null;

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const recentSessions = sessions.filter((s) => s.createdAt >= cutoff);

    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalMessages = 0;
    let cost = 0;

    const modelMap: Record<string, number> = {};
    const providerMap: Record<string, number> = {};

    for (const session of recentSessions) {
      totalTokens += session.totalTokens;
      promptTokens += session.promptTokens;
      completionTokens += session.completionTokens;
      totalMessages += session.messageCount || 0;
      cost += session.cost;

      const model = session.model || "unknown";
      modelMap[model] = (modelMap[model] || 0) + session.totalTokens;

      const provider = session.provider || inferProvider(session.model);
      providerMap[provider] = (providerMap[provider] || 0) + session.totalTokens;
    }

    const topModels = Object.entries(modelMap)
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    const topProviders = Object.entries(providerMap)
      .map(([provider, tokens]) => ({ provider, tokens }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    return {
      totalTokens,
      promptTokens,
      completionTokens,
      totalMessages,
      sessionCount: recentSessions.length,
      cost,
      topModels,
      topProviders,
    };
  },
});

// Create wrapped record after image generation
export const createWrapped = internalMutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    designIndex: v.number(),
    imageStorageId: v.optional(v.id("_storage")),
    stats: wrappedStatsValidator,
  },
  returns: v.id("dailyWrapped"),
  handler: async (ctx, args) => {
    // Delete any existing wrapped for this user/date
    const existing = await ctx.db
      .query("dailyWrapped")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
      .first();

    if (existing) {
      // Delete old image from storage if exists
      if (existing.imageStorageId) {
        await ctx.storage.delete(existing.imageStorageId);
      }
      await ctx.db.delete(existing._id);
    }

    const now = Date.now();
    return await ctx.db.insert("dailyWrapped", {
      userId: args.userId,
      date: args.date,
      designIndex: args.designIndex,
      imageStorageId: args.imageStorageId,
      generatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
      stats: args.stats,
    });
  },
});

// Delete expired wrapped records (cleanup)
export const deleteExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db.query("dailyWrapped").withIndex("by_expires").collect();

    let deleted = 0;
    for (const wrapped of expired) {
      if (wrapped.expiresAt < now) {
        if (wrapped.imageStorageId) {
          await ctx.storage.delete(wrapped.imageStorageId);
        }
        await ctx.db.delete(wrapped._id);
        deleted++;
      }
    }

    return deleted;
  },
});

// Get users with recent activity
export const getActiveUsers = internalQuery({
  args: { cutoff: v.number() },
  returns: v.array(v.id("users")),
  handler: async (ctx, { cutoff }) => {
    const sessions = await ctx.db.query("sessions").collect();

    // Get unique user IDs with sessions in last 24h
    const activeUserIds = new Set<Id<"users">>();
    for (const session of sessions) {
      if (session.createdAt >= cutoff) {
        activeUserIds.add(session.userId);
      }
    }

    return Array.from(activeUserIds);
  },
});

// Get countdown info for display
export const getCountdownInfo = query({
  args: {},
  returns: v.object({
    nextGenerationAt: v.number(),
    timeUntilNext: v.number(),
    currentDate: v.string(),
  }),
  handler: async () => {
    const now = Date.now();
    const nextGen = getNext930AMPT();
    return {
      nextGenerationAt: nextGen,
      timeUntilNext: nextGen - now,
      currentDate: getPTDateString(),
    };
  },
});
