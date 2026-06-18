import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Generate daily wrapped images at 9:30 AM PT (17:30 UTC)
// PT is UTC-8 (or UTC-7 during DST), so 9:30 AM PT = 17:30 UTC (standard) or 16:30 UTC (DST)
// Using 17:30 UTC as the baseline (standard time)
crons.cron(
  "generate daily wrapped",
  "30 17 * * *", // 9:30 AM PT (standard time)
  internal.wrappedActions.generateAllWrapped,
  {},
);

// Clean up expired wrapped records every 6 hours
crons.interval("cleanup expired wrapped", { hours: 6 }, internal.wrapped.deleteExpired, {});

export default crons;
