// =============================================================================
// STATS PAGE - DISABLED
// The static stats page with animated counter and growth chart has been
// commented out to reduce Convex reads. Route still exists but shows placeholder.
// =============================================================================

import { Link } from "react-router-dom";
import { useTheme } from "../lib/theme";
import { ArrowLeft } from "lucide-react";

// Placeholder component - page disabled
export function StatsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
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
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className={`text-sm ${isDark ? "text-zinc-500" : "text-[#8b7355]"}`}>
          Stats page is currently disabled.
        </p>
      </main>
    </div>
  );
}
