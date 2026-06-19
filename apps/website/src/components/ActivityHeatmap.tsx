import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "../lib/utils.ts";
import { getThemeClasses } from "../lib/theme.tsx";

// Heatmap calendar for the Dashboard profile section.
// Ported from fishdev20/shadcn-heatmap's HeatmapCalendar (grid structure,
// weekday/month axis labels, level bucketing, legend) and adapted to
// OpenSync's theme system (getThemeClasses + theme-aware color ramps instead
// of shadcn's bg-muted / bg-primary tokens).

export interface HeatmapDatum {
  date: string;
  value: number;
}

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapCell {
  date: Date;
  key: string;
  value: number;
  level: HeatmapLevel;
  label: string;
  disabled: boolean;
}

interface ActivityHeatmapProps {
  /** Daily aggregates as { date: "YYYY-MM-DD", value: count }. */
  data: ReadonlyArray<HeatmapDatum>;
  /** Number of days ending at endDate (default 365 ≈ 1 year). */
  rangeDays?: number;
  /** End date of the window (default: today). */
  endDate?: Date;
  /** 0 = Sunday, 1 = Monday (default 1). */
  weekStartsOn?: 0 | 1;

  /** Cell size in px in fixed mode (default 12). */
  cellSize?: number;
  /** Gap between cells in px (default 3). */
  cellGap?: number;

  /** Stretch the grid to fill container width (default true). */
  fill?: boolean;

  /** Show weekday labels on the left (default true). */
  showWeekdays?: boolean;
  /** Show month labels on top (default true). */
  showMonths?: boolean;
  /** Weekday rows to label (grid order 0..6). Default [1,3,5]. */
  weekdayIndices?: number[];
  /** Min weeks between month labels (default 3). */
  minWeekSpacing?: number;

  /** Show the Less/More legend (default true). */
  showLegend?: boolean;
  /** Tooltip unit noun (default "sessions"). */
  tooltipUnit?: string;

  /** Called when an in-range cell is clicked. */
  onCellClick?: (cell: HeatmapCell) => void;
  /** Custom tooltip render. */
  renderTooltip?: (cell: HeatmapCell) => ReactNode;

  theme: "dark" | "tan";
  className?: string;
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

// Level ramps per theme. Index 0 = empty, 4 = max.
const DARK_LEVELS: readonly string[] = [
  "bg-zinc-800/50",
  "bg-blue-500/20",
  "bg-blue-500/40",
  "bg-blue-500/70",
  "bg-blue-500",
];
const TAN_LEVELS: readonly string[] = [
  "bg-[#ebe9e6]",
  "bg-[#EB5601]/20",
  "bg-[#EB5601]/40",
  "bg-[#EB5601]/70",
  "bg-[#EB5601]",
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

/** Default GitHub-ish buckets. Override by pre-bucketing your data. */
function getLevel(value: number): HeatmapLevel {
  if (value <= 0) return 0;
  if (value <= 2) return 1;
  if (value <= 5) return 2;
  if (value <= 10) return 3;
  return 4;
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatMonth(d: Date): string {
  return MONTH_LABELS[d.getMonth()];
}

function weekdayLabelForIndex(index: number, weekStartsOn: 0 | 1): string {
  const actualDay = (weekStartsOn + index) % 7;
  const base = new Date(Date.UTC(2024, 0, 7 + actualDay));
  return base.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
}

export function ActivityHeatmap({
  data,
  rangeDays = 365,
  endDate = new Date(),
  weekStartsOn = 1,
  cellSize = 12,
  cellGap = 3,
  fill = true,
  showWeekdays = true,
  showMonths = true,
  weekdayIndices = [1, 3, 5],
  minWeekSpacing = 3,
  showLegend = true,
  tooltipUnit = "sessions",
  onCellClick,
  renderTooltip,
  theme,
  className,
}: ActivityHeatmapProps) {
  const t = getThemeClasses(theme);
  const levels = theme === "dark" ? DARK_LEVELS : TAN_LEVELS;

  const valueMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data) {
      const key = item.date;
      map.set(key, (map.get(key) ?? 0) + (item.value ?? 0));
    }
    return map;
  }, [data]);

  const end = startOfDay(endDate);
  const start = addDays(end, -(rangeDays - 1));
  const firstWeek = startOfWeek(start, weekStartsOn);
  const totalDays = Math.ceil((end.getTime() - firstWeek.getTime()) / 86400000) + 1;
  const weekCount = Math.ceil(totalDays / 7);

  // Build all cells row-major per week column.
  const columns: HeatmapCell[][] = useMemo(() => {
    const cols: HeatmapCell[][] = [];
    for (let w = 0; w < weekCount; w++) {
      const col: HeatmapCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(firstWeek, w * 7 + d);
        const inRange = date >= start && date <= end;
        const key = toKey(date);
        const v = inRange ? (valueMap.get(key) ?? 0) : 0;
        const lvl = getLevel(v);
        col.push({
          date,
          key,
          value: v,
          level: lvl,
          disabled: !inRange,
          label: date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        });
      }
      cols.push(col);
    }
    return cols;
  }, [weekCount, firstWeek, start, end, valueMap]);

  // Month labels with min spacing to avoid crowding.
  const monthLabels = useMemo(() => {
    if (!showMonths) return [] as { colIndex: number; text: string }[];
    const labels: { colIndex: number; text: string }[] = [];
    let lastLabeledWeek = -999;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const firstInCol = col.find((c) => !c.disabled)?.date ?? col[0].date;
      const prevFirst = i > 0 ? columns[i - 1].find((c) => !c.disabled)?.date : undefined;
      const monthChanged = !prevFirst || !sameMonth(firstInCol, prevFirst);
      if (monthChanged && i - lastLabeledWeek >= minWeekSpacing) {
        labels.push({ colIndex: i, text: formatMonth(firstInCol) });
        lastLabeledWeek = i;
      }
    }
    return labels;
  }, [columns, showMonths, minWeekSpacing]);

  // Fixed-grid width (used when not filling).
  const fixedWidth = columns.length * (cellSize + cellGap) - cellGap;
  const weekdayLabelWidth = showWeekdays ? 44 : 0;

  // Responsive fill mode: columns are flex items with aspect-square cells.
  const rowClass = fill ? "flex w-full min-w-0" : "flex";
  const columnClass = fill ? "flex min-w-0 flex-1 flex-col" : "flex shrink-0 flex-col";
  const columnStyle: CSSProperties = fill
    ? { gap: `${cellGap}px`, flex: "1 1 0%", minWidth: 0 }
    : { gap: `${cellGap}px`, width: `${cellSize}px` };
  const cellClass = fill ? "aspect-square w-full min-w-0" : "shrink-0";
  const cellStyle: CSSProperties = fill
    ? { borderRadius: "3px" }
    : { width: `${cellSize}px`, height: `${cellSize}px`, borderRadius: "3px" };

  // Single shared tooltip driven by hover/focus, positioned over the active cell
  // (viewport-fixed so it never clips inside the card). Mirrors Charts.tsx styling.
  const [active, setActive] = useState<{ cell: HeatmapCell; x: number; y: number } | null>(null);

  const showTip = (cell: HeatmapCell, el: HTMLElement) => {
    if (cell.disabled) return;
    const r = el.getBoundingClientRect();
    setActive({ cell, x: r.left + r.width / 2, y: r.top });
  };

  const ringClass =
    theme === "dark"
      ? "hover:ring-1 hover:ring-zinc-400 focus-visible:ring-2 focus-visible:ring-blue-400"
      : "hover:ring-1 hover:ring-[#8b7355] focus-visible:ring-2 focus-visible:ring-[#EB5601]";

  const tipContent = (cell: HeatmapCell): ReactNode => {
    if (renderTooltip) return renderTooltip(cell);
    const unit = cell.value === 1 ? tooltipUnit.slice(0, -1) : tooltipUnit;
    return (
      <>
        <span className={cn("font-medium", theme === "dark" ? "text-zinc-100" : "text-[#1a1a1a]")}>
          {cell.value} {unit}
        </span>
        <span className={cn("ml-1.5", t.textMuted)}>{cell.label}</span>
      </>
    );
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Month labels */}
      {showMonths && (
        <div className="flex items-end" style={{ paddingLeft: weekdayLabelWidth }}>
          <div
            className="relative"
            style={fill ? { height: 18, width: "100%" } : { height: 18, width: fixedWidth }}
          >
            {fill
              ? // Fill mode: labels positioned proportionally across full width.
                monthLabels.map((m) => (
                  <span
                    key={m.colIndex}
                    className={cn("absolute text-[11px]", t.textDim)}
                    style={{
                      left: `${(m.colIndex / Math.max(1, columns.length - 1)) * 100}%`,
                      top: 0,
                    }}
                  >
                    {m.text}
                  </span>
                ))
              : monthLabels.map((m) => (
                  <span
                    key={m.colIndex}
                    className={cn("absolute text-[11px]", t.textDim)}
                    style={{ left: m.colIndex * (cellSize + cellGap), top: 0 }}
                  >
                    {m.text}
                  </span>
                ))}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Weekday labels */}
        {showWeekdays && (
          <div
            className={cn("mr-2 flex flex-col", t.textDim)}
            style={{ gap: `${cellGap}px` }}
            aria-hidden="true"
          >
            {Array.from({ length: 7 }).map((_, rowIdx) => (
              <div
                key={rowIdx}
                className="flex items-center justify-end text-[11px]"
                style={
                  fill
                    ? { width: 40, height: `${cellSize}px` }
                    : { width: 40, height: `${cellSize}px` }
                }
              >
                {weekdayIndices.includes(rowIdx) ? weekdayLabelForIndex(rowIdx, weekStartsOn) : ""}
              </div>
            ))}
          </div>
        )}

        {/* Heatmap grid */}
        <div
          className={rowClass}
          style={{ gap: `${cellGap}px` } as CSSProperties}
          role="grid"
          aria-label="Activity heatmap"
        >
          {columns.map((col, i) => (
            <div key={i} className={columnClass} style={columnStyle} role="rowgroup">
              {col.map((cell) => {
                const cls = levels[cell.level];
                return (
                  <button
                    key={`${cell.key}-${i}`}
                    type="button"
                    disabled={cell.disabled}
                    className={cn(
                      cellClass,
                      cls,
                      "outline-none transition-shadow",
                      cell.disabled ? "cursor-default opacity-30" : cn("cursor-pointer", ringClass),
                    )}
                    style={cellStyle}
                    role="gridcell"
                    aria-label={cell.disabled ? "Outside range" : `${cell.label}: ${cell.value}`}
                    onMouseEnter={(e) => showTip(cell, e.currentTarget)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={(e) => showTip(cell, e.currentTarget)}
                    onBlur={() => setActive(null)}
                    onClick={() => !cell.disabled && onCellClick?.(cell)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Shared themed tooltip (hover/focus) */}
      {active && (
        <div
          className={cn(
            "pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-2 py-1 text-xs shadow-lg",
            theme === "dark"
              ? "bg-zinc-800 border border-zinc-700 text-zinc-200"
              : "bg-[#f5f3f0] border border-[#e6e4e1] text-[#1a1a1a]",
          )}
          style={{ left: active.x, top: active.y - 6 }}
          role="tooltip"
        >
          {tipContent(active.cell)}
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className={cn("mt-3 flex items-center gap-1.5", t.textDim)}>
          <span className="text-[10px]">Less</span>
          {levels.map((cls, i) => (
            <div
              key={i}
              className={cn(cls, "shrink-0")}
              style={
                {
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  borderRadius: "3px",
                } as CSSProperties
              }
              aria-hidden="true"
            />
          ))}
          <span className="text-[10px]">More</span>
        </div>
      )}
    </div>
  );
}
