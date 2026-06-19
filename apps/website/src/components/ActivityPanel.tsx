import { ActivityHeatmap } from "./ActivityHeatmap.tsx";
import { StatCard } from "./Charts.tsx";
import { cn } from "../lib/utils.ts";
import { getThemeClasses } from "../lib/theme.tsx";
import { Flame, Clock, Folder, MessageSquare, Calendar, Trophy } from "lucide-react";

// Profile section for the Dashboard Overview: heatmap + streaks + insights
// (most active hour, most worked project, total prompts sent). Inspired by
// Synara's ProfileSettingsPanel, adapted to OpenSync's theme + data shape.

export interface ActivityStatsData {
  heatmap: Array<{ day: string; count: number }>;
  currentStreakDays: number;
  longestStreakDays: number;
  peakDay: { day: string; tokens: number } | null;
  mostActiveHour: number | null;
  mostWorkedProject: {
    project: string;
    promptCount: number;
    sessionCount: number;
  } | null;
  promptsToday: number;
  totalPromptsSent: number;
}

export interface SummaryStatsData {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  totalDurationMs: number;
  uniqueModels: number;
  uniqueProjects: number;
}

interface ActivityPanelProps {
  activityStats: ActivityStatsData | null | undefined;
  summaryStats: SummaryStatsData | null | undefined;
  theme: "dark" | "tan";
}

export function ActivityPanel({ activityStats, summaryStats, theme }: ActivityPanelProps) {
  const t = getThemeClasses(theme);

  // Loading state
  if (activityStats === undefined) {
    return (
      <div className={cn("rounded-lg border p-4", t.bgCard, t.border)}>
        <h3 className={cn("text-xs font-normal mb-3", t.textMuted)}>Activity</h3>
        <div className={cn("h-24 w-full rounded animate-pulse", t.bgSecondary)} />
      </div>
    );
  }

  // No data
  if (activityStats === null || activityStats.totalPromptsSent === 0) {
    return (
      <div className={cn("rounded-lg border p-6 text-center", t.bgCard, t.border)}>
        <h3 className={cn("text-xs font-normal mb-2", t.textMuted)}>Activity</h3>
        <p className={cn("text-sm", t.textDim)}>
          No activity yet. Start syncing your coding sessions to see your profile.
        </p>
      </div>
    );
  }

  const {
    heatmap,
    currentStreakDays,
    longestStreakDays,
    peakDay,
    mostActiveHour,
    mostWorkedProject,
    promptsToday,
    totalPromptsSent,
  } = activityStats;

  const hasHeatmap = heatmap.length > 0;

  return (
    <div className={cn("rounded-lg border p-4", t.bgCard, t.border)}>
      <h3 className={cn("text-xs font-normal mb-4", t.textMuted)}>Activity</h3>

      {/* Streak + peak day tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Current streak"
          value={formatDays(currentStreakDays)}
          icon={<Flame className="h-4 w-4" />}
          theme={theme}
        />
        <StatCard
          label="Longest streak"
          value={formatDays(longestStreakDays)}
          icon={<Trophy className="h-4 w-4" />}
          theme={theme}
        />
        <StatCard
          label="Prompts today"
          value={promptsToday.toLocaleString()}
          icon={<MessageSquare className="h-4 w-4" />}
          theme={theme}
        />
        <StatCard
          label="Peak day tokens"
          value={peakDay ? formatNumber(peakDay.tokens) : "—"}
          subValue={peakDay ? formatShortDate(peakDay.day) : undefined}
          icon={<Calendar className="h-4 w-4" />}
          theme={theme}
        />
      </div>

      {/* Heatmap */}
      {hasHeatmap && (
        <div className="mb-5">
          <p className={cn("text-[11px] mb-2", t.textDim)}>Last 12 months</p>
          <ActivityHeatmap
            data={heatmap.map((cell) => ({ date: cell.day, value: cell.count }))}
            theme={theme}
            fill
            cellGap={3}
            tooltipUnit="sessions"
          />
        </div>
      )}

      {/* Insights */}
      <div className={cn("border-t pt-3", t.borderLight)}>
        <p className={cn("text-[11px] font-normal mb-2.5", t.textMuted)}>Insights</p>
        <dl className="flex flex-col gap-2">
          <InsightRow
            label="Most active hour"
            value={mostActiveHour !== null ? formatHour(mostActiveHour) : "—"}
            icon={<Clock className="h-3.5 w-3.5" />}
            theme={theme}
          />
          <InsightRow
            label="Most worked project"
            value={
              mostWorkedProject
                ? `${mostWorkedProject.project} · ${mostWorkedProject.promptCount.toLocaleString()} prompts`
                : "—"
            }
            icon={<Folder className="h-3.5 w-3.5" />}
            theme={theme}
          />
          <InsightRow
            label="Total prompts sent"
            value={totalPromptsSent.toLocaleString()}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            theme={theme}
          />
          <InsightRow
            label="Total sessions"
            value={summaryStats?.totalSessions.toLocaleString() ?? "0"}
            icon={<Calendar className="h-3.5 w-3.5" />}
            theme={theme}
          />
        </dl>
      </div>
    </div>
  );
}

function InsightRow({
  label,
  value,
  icon,
  theme,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  theme: "dark" | "tan";
}) {
  const t = getThemeClasses(theme);
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn("flex items-center gap-2 text-sm", t.textMuted)}>
        <span className={t.iconSubtle}>{icon}</span>
        {label}
      </dt>
      <dd className={cn("truncate text-sm font-normal", t.textSecondary)} title={value}>
        {value}
      </dd>
    </div>
  );
}

function formatDays(days: number): string {
  if (days === 0) return "0 days";
  return days === 1 ? "1 day" : `${days} days`;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return "12 AM";
  if (normalized === 12) return "12 PM";
  return normalized < 12 ? `${normalized} AM` : `${normalized - 12} PM`;
}

function formatShortDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, date));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
