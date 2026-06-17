"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { wrappedStatsValidator } from "./wrapped";

// Helper to get PT timezone date string
function getPTDateString(): string {
  const date = new Date();
  return date.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

// Design prompt templates for Google Imagen
const DESIGN_PROMPTS = [
  // 0: Minimal Dark (like Sole DXB)
  "Create a minimalist vertical poster (9:16 ratio) with pure black background, white monospace typography displaying coding statistics. Bold header 'DAILY SYNC WRAPPED' at top. Clean data layout with numbers prominently displayed. No decorations, just typography.",

  // 1: Gradient Noise (like Rare Design Tools)
  "Create a vertical poster (9:16 ratio) with magenta to dark purple gradient background with subtle grain/noise texture. White sans-serif text showing coding metrics. Modern, editorial design aesthetic. Rounded corners.",

  // 2: Geometric Beige (like Answers the Why)
  "Create a vertical poster (9:16 ratio) with warm beige/cream background. Orange geometric squares arranged in a pyramid pattern on left side. Serif typography on right showing analytics data. Minimal, sophisticated.",

  // 3: Tech Cards (like Origin)
  "Create a vertical poster (9:16 ratio) with dark background featuring three white rounded rectangle cards displaying icons and statistics. Clean tech aesthetic. Monospace font for numbers.",

  // 4: Bold Typography (like Momentum at Scale)
  "Create a vertical poster (9:16 ratio) with dark navy blue background. Large elegant serif headline 'WRAPPED' at top. Blue accent color for numbers. Statistics displayed in clean list format.",

  // 5: Vinyl Record (like Yeezus)
  "Create a vertical poster (9:16 ratio) with dark textured background featuring a large cream/beige circle in center like a vinyl record. Bold warped typography inside circle. Statistics arranged around the circle.",

  // 6: Orange Gradient (like Take Control)
  "Create a vertical poster (9:16 ratio) with warm orange to peach gradient. White rounded pill-shaped buttons. Modern fintech aesthetic. Clean sans-serif typography for metrics.",

  // 7: Dark Minimal (like Sole DXB date)
  "Create a vertical poster (9:16 ratio) with pure black background. Sparse white uppercase text. Date prominently displayed. Extremely minimal with lots of negative space. Monospace font.",

  // 8: Blue Landscape (artistic)
  "Create a vertical poster (9:16 ratio) with deep blue and cream color split design. Abstract artistic element. Statistics overlaid in clean white typography. Contemplative mood.",

  // 9: Color Shapes (like Khroma)
  "Create a vertical poster (9:16 ratio) with dark background and colorful geometric shapes (triangles, squares, circles) as accents. Clean white typography. Modern data visualization aesthetic.",
];

// Generate wrapped image using Google Imagen API
export const generateWrappedImage = internalAction({
  args: {
    userId: v.id("users"),
    designIndex: v.number(),
    stats: wrappedStatsValidator,
    date: v.string(),
  },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_AI_API_KEY not configured");
      return null;
    }

    // Build the prompt with user data
    const basePrompt = DESIGN_PROMPTS[args.designIndex % DESIGN_PROMPTS.length];
    const dataPrompt = `
Include these exact statistics in the design:
- Total Tokens: ${args.stats.totalTokens.toLocaleString()}
- Prompt Tokens: ${args.stats.promptTokens.toLocaleString()}
- Completion Tokens: ${args.stats.completionTokens.toLocaleString()}
- Messages: ${args.stats.totalMessages.toLocaleString()}
- Cost: $${args.stats.cost.toFixed(2)}
- Date: ${args.date}
- Top Model: ${args.stats.topModels[0]?.model || "N/A"}
Include "OpenSync" branding at bottom.
`;

    const fullPrompt = `${basePrompt}\n\n${dataPrompt}`;

    try {
      // Call Google Imagen API (Gemini with image generation)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instances: [{ prompt: fullPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "9:16",
              personGeneration: "dont_allow",
              safetySetting: "block_few",
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Google Imagen API error:", error);
        return null;
      }

      const data = await response.json();
      const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

      if (!imageBase64) {
        console.error("No image in response");
        return null;
      }

      // Convert base64 to blob and store in Convex
      const imageBuffer = Buffer.from(imageBase64, "base64");
      const blob = new Blob([imageBuffer], { type: "image/png" });

      const storageId = await ctx.storage.store(blob);
      return storageId;
    } catch (error) {
      console.error("Failed to generate image:", error);
      return null;
    }
  },
});

// Generate wrapped for a single user
export const generateForUser = internalAction({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const date = getPTDateString();
    const designIndex = new Date().getDate() % 10; // Rotate based on day of month

    // Get 24h stats
    const stats = await ctx.runQuery(internal.wrapped.get24HourStats, {
      userId,
    });

    // Skip if no activity
    if (stats.totalTokens === 0 && stats.totalMessages === 0) {
      console.log(`Skipping wrapped for user ${userId}: no activity`);
      return null;
    }

    // Generate image
    const imageStorageId = await ctx.runAction(internal.wrappedActions.generateWrappedImage, {
      userId,
      designIndex,
      stats,
      date,
    });

    // Create wrapped record (with or without image)
    await ctx.runMutation(internal.wrapped.createWrapped, {
      userId,
      date,
      designIndex,
      imageStorageId: imageStorageId ?? undefined,
      stats,
    });

    console.log(`Generated wrapped for user ${userId}, design ${designIndex}`);
    return null;
  },
});

// Generate wrapped for all active users (called by cron)
export const generateAllWrapped = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Clean up expired records first
    await ctx.runMutation(internal.wrapped.deleteExpired, {});

    // Get all users with recent activity
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    // Query all users (we'll filter by activity)
    const allUsers = await ctx.runQuery(internal.wrapped.getActiveUsers, {
      cutoff,
    });

    console.log(`Generating wrapped for ${allUsers.length} active users`);

    // Generate for each user (in sequence to avoid rate limits)
    for (const userId of allUsers) {
      try {
        await ctx.runAction(internal.wrappedActions.generateForUser, { userId });
      } catch (error) {
        console.error(`Failed to generate wrapped for ${userId}:`, error);
      }
    }

    return null;
  },
});
