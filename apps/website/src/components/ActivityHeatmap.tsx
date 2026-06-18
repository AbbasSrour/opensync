import { useMemo, type CSSProperties } from "react";
import { cn } from "../lib/utils.ts";
import { getThemeClasses } from "../lib/theme.tsx";

// GitHub-style contribution heatmap for the Dashboard profile section.
// Renders columns of week × weekday cells with pre-bucketed intensity (0-4).
// Sizing uses inline px so cells are square and the grid never scrolls
// horizontally.

export interface HeatmapCell {
  day: string;
  count: number;
  weekday: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Dark-mode intensity ramp (mix toward transparent on the near-black bg).
const DARK_INTENSITY: readonly string[] = [
  "bg-zinc-800/40",
  "bg-blue-500/20",
  "bg-blue-500/40",
  "bg-blue-500/70",
  "bg-blue-500",
];

// Tan-mode intensity ramp (mix toward transparent on the warm bg).
const TAN_INTENSITY: readonly string[] = [
  "bg-[#ebe9e6]",
  "bg-[#EB5601]/20",
  "bg-[#EB5601]/40",
  "bg-[#EB5601]/70",
  "bg-[#EB5601]",
];

interface ActivityHeatmapProps {
  cells: ReadonlyArray<HeatmapCell>;
  cellSize?: number;
  gap?: number;
  radius?: number;
  showMonths?: boolean;
  monthsPosition?: "top" | "bottom";
  tooltip?: boolean;
  tooltipUnit?: string;
  theme: "dark" | "tan";
  className?: string;
}

export function ActivityHeatmap({
  cells,
  cellSize = 11,
  gap = 3,
  radius = 2,
  showMonths = true,
  monthsPosition = "bottom",
  tooltip = true,
  tooltipUnit = "prompts",
  theme,
  className,
}: ActivityHeatmapProps) {
  const t = getThemeClasses(theme);
  const intensityClasses = theme === "dark" ? DARK_INTENSITY : TAN_INTENSITY;

  // Group cells into week columns (7 rows = Sun..Sat).
  const weeks = useMemo(() => {
    if (cells.length === 0) return [];
    const byWeek: HeatmapCell[][] = [];
    let currentWeek: HeatmapCell[] = [];
    let currentWeekday = -1;
    for (const cell of cells) {
      if (cell.weekday <= currentWeekday) {
        byWeek.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(cell);
      currentWeekday = cell.weekday;
    }
    if (currentWeek.length > 0) byWeek.push(currentWeek);
    return byWeek;
  }, [cells]);

  // Month label positions: first week that starts on or after the 1st of a month.
  const monthLabels = useMemo(() => {
    if (!showMonths || weeks.length === 0) return [];
    const labels: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (!firstDay) return;
      const month = Number(firstDay.day.slice(5, 7)) - 1;
      if (month !== lastMonth) {
        labels.push({ label: MONTH_LABELS[month], weekIndex });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks, showMonths]);

  const gridWidth = weeks.length * (cellSize + gap) - gap;
  const monthRowHeight = showMonths ? 14 : 0;

  return (
    <div className={cn("flex flex-col", className)}>
      {showMonths && monthsPosition === "top" && (
        <MonthRow
          labels={monthLabels}
          cellSize={cellSize}
          gap={gap}
          width={gridWidth}
          theme={theme}
        />
      )}
      <div
        className="flex"
        style={{ gap: `${gap}px` } as CSSProperties}
        role="img"
        aria-label="Activity heatmap"
      >
        {weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            className="flex flex-col"
            style={{ gap: `${gap}px` } as CSSProperties}
          >
            {Array.from({ length: 7 }, (_, weekday) => {
              const cell = week.find((c) => c.weekday === weekday);
              const intensity = cell?.intensity ?? 0;
              const count = cell?.count ?? 0;
              return (
                <div
                  key={weekday}
                  className={cn(
                    "shrink-0",
                    intensityClasses[intensity],
                    tooltip && "group/relative",
                  )}
                  style={
                    {
                      width: `${cellSize}px`,
                      height: `${cellSize}px`,
                      borderRadius: `${radius}px`,
                    } as CSSProperties
                  }
                  title={
                    tooltip && cell
                      ? `${count} ${tooltipUnit} on ${formatShortDate(cell.day)}`
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
      {showMonths && monthsPosition === "bottom" && (
        <div style={{ height: `${monthRowHeight}px` } as CSSProperties} />
      )}
      {showMonths && monthsPosition === "bottom" && (
        <MonthRow
          labels={monthLabels}
          cellSize={cellSize}
          gap={gap}
          width={gridWidth}
          theme={theme}
          marginTop={4}
        />
      )}
      {/* Legend */}
      <div className={cn("mt-3 flex items-center gap-1.5", t.textDim)}>
        <span className="text-[10px]">Less</span>
        {intensityClasses.map((cls, i) => (
          <div
            key={i}
            className={cn(cls, "shrink-0")}
            style={
              {
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                borderRadius: `${radius}px`,
              } as CSSProperties
            }
          />
        ))}
        <span className="text-[10px]">More</span>
      </div>
    </div>
  );
}

function MonthRow({
  labels,
  cellSize,
  gap,
  width,
  theme,
  marginTop = 0,
}: {
  labels: Array<{ label: string; weekIndex: number }>;
  cellSize: number;
  gap: number;
  width: number;
  theme: "dark" | "tan";
  marginTop?: number;
}) {
  const t = getThemeClasses(theme);
  return (
    <div
      className={cn("relative", t.textDim)}
      style={{ width: `${width}px`, height: "14px", marginTop: `${marginTop}px` }}
    >
      {labels.map(({ label, weekIndex }) => (
        <span
          key={`${label}-${weekIndex}`}
          className="absolute text-[10px]"
          style={{ left: `${weekIndex * (cellSize + gap)}px`, top: 0 }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function formatShortDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, date));
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Re-export the cell type for consumers.
export type { HeatmapCell as ProfileHeatmapCell };
