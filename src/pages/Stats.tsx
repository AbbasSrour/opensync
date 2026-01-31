// =============================================================================
// STATS PAGE - Message counter with animated count-up for 1M+ documents
// Growth chart is commented out to reduce Convex reads
// =============================================================================

import { useState, useEffect, useRef, Component, type ReactNode } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { useTheme, type Theme } from "../lib/theme";
import { Sun, Moon, MessagesSquare, ArrowLeft, RefreshCw } from "lucide-react";

// =============================================================================
// Utility hooks and types
// =============================================================================

type StaticQueryState<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | null;
};

// One-shot query hook to avoid reactive subscriptions on large datasets
function useStaticQuery<T>(
  queryRef: unknown,
  args: Record<string, unknown> = {},
  refreshToken = 0,
) {
  const convex = useConvex();
  const [state, setState] = useState<StaticQueryState<T>>({
    data: undefined,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const runQuery = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await convex.query(queryRef as any, args);
        if (!isMounted) return;
        setState({ data: result as T, loading: false, error: null });
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error ? error.message : "Failed to load stats";
        setState({ data: undefined, loading: false, error: message });
      }
    };

    runQuery();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convex, refreshToken]);

  return state;
}

// =============================================================================
// Animated counter hook - starts at 999,900 and counts up to target
// =============================================================================

function useAnimatedCounter(
  targetValue: number,
  duration: number = 2000,
): number {
  // Start at 999,900 for the million milestone effect
  const START_VALUE = 999_900;
  const [displayValue, setDisplayValue] = useState(START_VALUE);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // Only animate once we have a real target value
    if (targetValue <= 0 || hasAnimatedRef.current) return;

    // If target is less than start value, just show target immediately
    if (targetValue <= START_VALUE) {
      setDisplayValue(targetValue);
      hasAnimatedRef.current = true;
      return;
    }

    hasAnimatedRef.current = true;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth deceleration
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);

      // Calculate current value
      const currentValue = Math.floor(
        START_VALUE + (targetValue - START_VALUE) * easeOutQuart,
      );

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we land exactly on target
        setDisplayValue(targetValue);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration]);

  return displayValue;
}

// =============================================================================
// Message counter component with animated count-up
// =============================================================================

function MessageMilestoneCounter({
  isDark,
  refreshToken,
}: {
  isDark: boolean;
  refreshToken: number;
}) {
  const {
    data: messageCount,
    loading,
    error,
  } = useStaticQuery<number>(
    api.analytics.publicMessageCount,
    {},
    refreshToken,
  );

  const targetCount = messageCount ?? 0;
  const animatedCount = useAnimatedCounter(targetCount);

  // Show loading state or animated count
  const displayCount = loading ? 999_900 : animatedCount;

  return (
    <div
      className={`rounded-lg border p-5 ${
        isDark
          ? "border-zinc-800 bg-[#161616]"
          : "border-[#e6e4e1] bg-[#f5f3f0]"
      }`}
    >
      <h3
        className={`text-sm font-medium mb-4 flex items-center gap-2 ${
          isDark ? "text-zinc-300" : "text-[#1a1a1a]"
        }`}
      >
        <MessagesSquare
          className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-[#8b7355]"}`}
        />
        Messages Synced
        {loading && (
          <span
            className={`ml-auto text-[10px] font-normal ${
              isDark ? "text-zinc-600" : "text-[#8b7355]"
            }`}
          >
            loading
          </span>
        )}
      </h3>

      <div>
        <span
          className={`text-3xl font-bold tabular-nums ${
            isDark ? "text-zinc-100" : "text-[#1a1a1a]"
          }`}
        >
          {displayCount.toLocaleString()}
        </span>
      </div>

      {error && (
        <p
          className={`mt-2 text-xs ${isDark ? "text-red-400" : "text-red-600"}`}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Error boundary for crash protection
// =============================================================================

class StatsErrorBoundary extends Component<
  { children: ReactNode; isDark: boolean },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Stats page crashed", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { isDark } = this.props;
    return (
      <div
        className={`min-h-screen ${
          isDark ? "bg-[#0a0a0a] text-zinc-100" : "bg-[#f8f6f3] text-[#1a1a1a]"
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1
            className={`text-lg font-semibold ${
              isDark ? "text-zinc-100" : "text-[#1a1a1a]"
            }`}
          >
            Stats failed to load
          </h1>
          <p
            className={`mt-2 text-sm ${
              isDark ? "text-zinc-500" : "text-[#8b7355]"
            }`}
          >
            We hit an error while loading metrics. Refresh to try again.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to="/"
              className={`text-sm ${
                isDark
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-[#8b7355] hover:text-[#1a1a1a]"
              }`}
            >
              Back
            </Link>
            <button
              onClick={() => window.location.reload()}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isDark
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-[#ebe9e6] text-[#1a1a1a] hover:bg-[#e6e4e1]"
              }`}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// =============================================================================
// Main page content
// =============================================================================

type StatsPageContentProps = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

function StatsPageContent({ theme, setTheme }: StatsPageContentProps) {
  const isDark = theme === "dark";
  const [manualRefresh, setManualRefresh] = useState(0);

  const handleManualRefresh = () => {
    setManualRefresh((prev) => prev + 1);
  };

  return (
    <div
      className={`min-h-screen ${
        isDark ? "bg-[#0a0a0a] text-zinc-100" : "bg-[#f8f6f3] text-[#1a1a1a]"
      }`}
    >
      <header
        className={`border-b ${
          isDark
            ? "border-zinc-800 bg-[#0a0a0a]"
            : "border-[#e6e4e1] bg-[#f8f6f3]"
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className={`flex items-center gap-2 text-sm ${
                isDark
                  ? "text-zinc-400 hover:text-zinc-200"
                  : "text-[#8b7355] hover:text-[#1a1a1a]"
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <h1
              className={`text-lg font-semibold ${
                isDark ? "text-zinc-100" : "text-[#1a1a1a]"
              }`}
            >
              Platform Stats
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-md ${
                isDark
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  : "text-[#8b7355] hover:text-[#1a1a1a] hover:bg-[#e6e4e1]"
              }`}
              title="Refresh stats"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={() => setTheme(isDark ? "tan" : "dark")}
              className={`p-2 rounded-md ${
                isDark
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  : "text-[#8b7355] hover:text-[#1a1a1a] hover:bg-[#e6e4e1]"
              }`}
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <MessageMilestoneCounter
            isDark={isDark}
            refreshToken={manualRefresh}
          />
        </div>

        {/* Growth chart commented out to reduce Convex reads on large datasets */}

        <p
          className={`mt-8 text-center text-sm ${
            isDark ? "text-zinc-600" : "text-[#8b7355]"
          }`}
        >
          Stats snapshot from the OpenSync platform.
        </p>
      </main>
    </div>
  );
}

// =============================================================================
// Exported component
// =============================================================================

export function StatsPage() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <StatsErrorBoundary isDark={isDark}>
      <StatsPageContent theme={theme} setTheme={setTheme} />
    </StatsErrorBoundary>
  );
}

/* =============================================================================
   GROWTH CHART - COMMENTED OUT (preserved for future use)
   To re-enable: uncomment and add to the main grid in StatsPageContent
   =============================================================================
import { Zap } from "lucide-react";

function GrowthChart({ isDark, refreshToken }: { isDark: boolean; refreshToken: number }) {
  // Growth chart implementation preserved here for future use
  // See git history for full implementation
}
============================================================================= */
