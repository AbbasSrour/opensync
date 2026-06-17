// CSS-based fallback templates for Daily Sync Wrapped
// 10 unique designs - 9:16 portrait (675x1200 pixels)

interface WrappedStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalMessages: number;
  sessionCount?: number;
  cost: number;
  topModels: { model: string; tokens: number }[];
  topProviders: { provider: string; tokens: number }[];
}

interface TemplateProps {
  stats: WrappedStats;
  date: string;
}

// Helper to format numbers
const formatNumber = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

// Template 0: Minimal Dark (Sole DXB style)
export function Template0({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-black text-white font-mono flex flex-col p-10 relative">
      {/* Top accent */}
      <div className="absolute top-8 left-8 w-2 h-20 bg-gradient-to-b from-pink-500 to-purple-500" />
      <div className="absolute top-8 right-8 text-2xl tracking-widest">
        {new Date().getFullYear()}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-5xl tracking-[0.3em] font-bold mb-3">DAILY</h1>
        <h1 className="text-5xl tracking-[0.3em] font-bold mb-3">SYNC</h1>
        <h1 className="text-5xl tracking-[0.3em] font-bold mb-16">WRAPPED</h1>

        <div className="space-y-6">
          <div>
            <p className="text-7xl font-bold">{formatNumber(stats.totalTokens)}</p>
            <p className="text-2xl tracking-widest opacity-60 mt-2">TOKENS</p>
          </div>
          <div>
            <p className="text-5xl font-bold">{formatNumber(stats.totalMessages)}</p>
            <p className="text-xl tracking-widest opacity-60 mt-1">MESSAGES</p>
          </div>
          <div>
            <p className="text-4xl font-bold">{stats.sessionCount ?? 0}</p>
            <p className="text-xl tracking-widest opacity-60 mt-1">SESSIONS</p>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="flex justify-between items-end text-xl">
        <p className="tracking-widest">{date.replace(/-/g, "_")}</p>
        <p className="opacity-60">OPENSYNC</p>
      </div>
    </div>
  );
}

// Template 1: Gradient Noise (Rare Design Tools style)
export function Template1({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-purple-700 to-slate-900" />
      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center items-center p-10 text-white">
        <h2 className="text-3xl font-light mb-4 opacity-80">Daily Sync</h2>
        <h1 className="text-7xl font-bold mb-12">Wrapped</h1>

        <div className="text-center space-y-8">
          <div>
            <p className="text-8xl font-bold">{formatNumber(stats.totalTokens)}</p>
            <p className="text-2xl opacity-70 mt-2">Total Tokens</p>
          </div>
          <div className="flex gap-12 text-center">
            <div>
              <p className="text-5xl font-semibold">{formatNumber(stats.totalMessages)}</p>
              <p className="text-xl opacity-70 mt-1">Messages</p>
            </div>
            <div>
              <p className="text-5xl font-semibold">{stats.sessionCount ?? 0}</p>
              <p className="text-xl opacity-70 mt-1">Sessions</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 text-xl opacity-60">{date} | OpenSync</div>
      </div>
    </div>
  );
}

// Template 2: Geometric Beige (Answers the Why style)
export function Template2({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-[#f5f0e8] text-[#2d2d2d] p-8 flex flex-col relative">
      {/* Orange squares pyramid */}
      <div className="absolute left-6 top-24 flex flex-col gap-2">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="flex gap-2">
            {Array(row)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 bg-orange-500 flex items-center justify-center text-white text-lg font-bold"
                >
                  {(row * (row - 1)) / 2 + i + 1}
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center mt-48 px-4">
        <h1 className="font-serif text-5xl italic mb-10 leading-tight">
          Your Daily
          <br />
          Sync Wrapped
        </h1>

        <div className="space-y-5 text-2xl">
          <div className="flex justify-between border-b-2 border-[#ccc] pb-2">
            <span>Tokens</span>
            <span className="font-bold">{formatNumber(stats.totalTokens)}</span>
          </div>
          <div className="flex justify-between border-b-2 border-[#ccc] pb-2">
            <span>Messages</span>
            <span className="font-bold">{stats.totalMessages}</span>
          </div>
          <div className="flex justify-between border-b-2 border-[#ccc] pb-2">
            <span>Sessions</span>
            <span className="font-bold">{stats.sessionCount ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Top Model</span>
            <span className="font-bold text-orange-600 text-xl truncate max-w-[50%]">
              {stats.topModels[0]?.model || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="flex justify-between items-end text-lg mt-8">
        <span className="opacity-60">{date}</span>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-5 h-5 bg-orange-500" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Template 3: Tech Cards (Origin style)
export function Template3({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-black p-10 flex flex-col justify-center items-center relative">
      {/* Corner dots */}
      <div className="absolute top-6 left-6 w-3 h-3 bg-white rounded-full" />
      <div className="absolute top-6 right-6 w-3 h-3 bg-white rounded-full" />
      <div className="absolute bottom-6 left-6 w-3 h-3 bg-white rounded-full" />
      <div className="absolute bottom-6 right-6 w-3 h-3 bg-white rounded-full" />

      {/* Header text */}
      <div className="absolute top-10 text-white text-xl tracking-widest text-center">
        DAILY SYNC WRAPPED
      </div>
      <div className="absolute top-16 text-white text-lg opacity-60">{date}</div>

      {/* Cards */}
      <div className="flex flex-col gap-6 mt-8">
        <div className="w-56 h-32 bg-white rounded-3xl flex flex-col items-center justify-center">
          <div className="text-5xl font-bold text-black">{formatNumber(stats.totalTokens)}</div>
          <div className="text-lg text-gray-500 mt-2">TOKENS</div>
        </div>
        <div className="w-56 h-32 bg-white rounded-3xl flex flex-col items-center justify-center">
          <div className="text-5xl font-bold text-black">{stats.totalMessages}</div>
          <div className="text-lg text-gray-500 mt-2">MESSAGES</div>
        </div>
        <div className="w-56 h-32 bg-white rounded-3xl flex flex-col items-center justify-center">
          <div className="text-5xl font-bold text-black">{stats.sessionCount ?? 0}</div>
          <div className="text-lg text-gray-500 mt-2">SESSIONS</div>
        </div>
        <div className="w-56 h-32 bg-white rounded-3xl flex flex-col items-center justify-center px-4">
          <div className="text-2xl font-bold text-black text-center truncate w-full">
            {stats.topModels[0]?.model || "N/A"}
          </div>
          <div className="text-lg text-gray-500 mt-2">TOP MODEL</div>
        </div>
      </div>

      {/* Bottom brand */}
      <div className="absolute bottom-10 text-white text-2xl font-mono tracking-widest">
        OPENSYNC
      </div>
    </div>
  );
}

// Template 4: Bold Typography (Momentum at Scale style)
export function Template4({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-[#0a1628] text-white p-10 flex flex-col">
      {/* Logo/accent */}
      <div className="absolute top-8 right-8">
        <div className="w-12 h-12 relative">
          <div className="absolute inset-0 bg-blue-500 rotate-45 transform origin-center" />
          <div className="absolute inset-3 bg-[#0a1628] rotate-45 transform origin-center" />
        </div>
      </div>

      {/* Main headline */}
      <div className="flex-1 flex flex-col justify-center">
        <h1 className="font-serif text-6xl leading-tight mb-12">
          Daily Sync
          <br />
          <span className="text-blue-400">Wrapped</span>
        </h1>

        {/* Stats */}
        <div className="space-y-6">
          <div>
            <span className="text-blue-400 text-6xl font-light">
              {formatNumber(stats.totalTokens)}
            </span>
            <p className="text-gray-400 text-2xl mt-1">Tokens</p>
          </div>
          <div>
            <span className="text-blue-400 text-5xl font-light">{stats.totalMessages}</span>
            <p className="text-gray-400 text-2xl mt-1">Messages</p>
          </div>
          <div>
            <span className="text-blue-400 text-5xl font-light">{stats.sessionCount ?? 0}</span>
            <p className="text-gray-400 text-2xl mt-1">Sessions</p>
          </div>
          {stats.topModels[0] && (
            <div>
              <span className="text-blue-400 text-3xl font-light truncate block max-w-full">
                {stats.topModels[0].model}
              </span>
              <p className="text-gray-400 text-xl mt-1">Top Model</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="text-xl text-gray-500">{date} | OpenSync</div>
    </div>
  );
}

// Template 5: Vinyl Record (Yeezus style) - Big circle, no center hole
export function Template5({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-[#1a1a1a] p-8 flex flex-col items-center justify-center relative">
      {/* Top corners */}
      <div className="absolute top-8 left-8 text-[#f5f0e8] text-2xl">
        <span className="opacity-60">BY</span>
        <br />
        <span className="font-bold text-3xl">OPENSYNC</span>
      </div>
      <div className="absolute top-8 right-8 text-[#f5f0e8] text-3xl font-bold tracking-wider">
        WRAPPED
      </div>

      {/* Big circle with all content inside - no center hole */}
      <div className="w-[420px] h-[420px] rounded-full bg-[#f5f0e8] flex items-center justify-center relative mt-16">
        {/* Date at top */}
        <div className="absolute top-10 text-2xl tracking-wider text-[#1a1a1a] font-bold">
          {date.toUpperCase()}
        </div>

        {/* Main stats in center */}
        <div className="text-[#1a1a1a] text-center">
          <div className="text-8xl font-black tracking-tighter" style={{ fontFamily: "serif" }}>
            {formatNumber(stats.totalTokens)}
          </div>
          <div className="text-3xl tracking-wider mt-4 font-bold">TOKENS</div>
          <div className="text-2xl tracking-wider mt-6 opacity-70">
            {stats.totalMessages} MSG | {stats.sessionCount ?? 0} SESSIONS
          </div>
        </div>

        {/* Model at bottom */}
        <div className="absolute bottom-10 text-xl tracking-wider text-[#1a1a1a] truncate max-w-[80%] px-4 font-medium">
          {stats.topModels[0]?.model || "Your activity"}
        </div>
      </div>

      {/* Bottom text */}
      <div className="text-[#f5f0e8] text-center mt-12">
        <h1 className="text-6xl font-bold tracking-wide">DAILY SYNC</h1>
        <h1 className="text-6xl font-bold tracking-wide">WRAPPED</h1>
      </div>
    </div>
  );
}

// Template 6: Orange Gradient (Take Control style) - HUGE readable text
export function Template6({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 p-12 flex flex-col relative overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute -right-24 top-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -left-16 bottom-1/3 w-48 h-48 bg-white/10 rounded-full blur-2xl" />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        <h1 className="text-white text-6xl font-bold leading-tight mb-10">
          Your daily
          <br />
          sync wrapped.
        </h1>

        {/* Stats card with HUGE numbers */}
        <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-10 space-y-8">
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-3xl font-medium">Tokens</span>
            <span className="text-white font-bold text-6xl">{formatNumber(stats.totalTokens)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-3xl font-medium">Messages</span>
            <span className="text-white font-bold text-6xl">{stats.totalMessages}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-3xl font-medium">Sessions</span>
            <span className="text-white font-bold text-6xl">{stats.sessionCount ?? 0}</span>
          </div>
        </div>

        {/* Model pill */}
        <div className="mt-10 bg-white/90 rounded-full py-5 px-10 flex items-center justify-between">
          <span className="text-gray-800 text-2xl font-semibold truncate max-w-[80%]">
            {stats.topModels[0]?.model || "No activity"}
          </span>
          <span className="text-gray-400 text-3xl">+</span>
        </div>
      </div>

      {/* Bottom */}
      <div className="relative z-10 mt-auto pt-8 text-white/80 text-2xl font-medium">
        {date} | OpenSync
      </div>
    </div>
  );
}

// Template 7: Dark Minimal (Sole DXB date style)
export function Template7({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-black text-white font-mono p-10 flex flex-col">
      {/* Sparse top */}
      <div className="text-xl tracking-[0.5em] opacity-40">OPENSYNC</div>

      {/* Center content - very minimal */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-8xl font-bold tracking-tighter mb-4">
          {formatNumber(stats.totalTokens)}
        </div>
        <div className="text-2xl tracking-widest opacity-60 mb-2">TOKENS SYNCED</div>
        <div className="text-xl tracking-widest opacity-40 mb-16">{date}</div>

        {/* Stats */}
        <div className="space-y-6">
          <div>
            <span className="opacity-40 text-xl">MSG </span>
            <span className="text-4xl font-bold">{stats.totalMessages}</span>
          </div>
          <div>
            <span className="opacity-40 text-xl">SESSIONS </span>
            <span className="text-4xl font-bold">{stats.sessionCount ?? 0}</span>
          </div>
          <div>
            <span className="opacity-40 text-xl">MODEL </span>
            <span className="text-2xl font-bold truncate block max-w-full">
              {stats.topModels[0]?.model?.slice(0, 20) || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Template 8: Blue Landscape (Artistic style)
export function Template8({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Split background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-[#f5f0e8]" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-[#1e3a5f]" />
        {/* Artistic wave divider */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M0 45 Q25 55, 50 45 Q75 35, 100 50 L100 100 L0 100 Z" fill="#1e3a5f" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-10">
        {/* Top section */}
        <div>
          <h2 className="text-[#1e3a5f] text-2xl font-light tracking-widest mb-4">DAILY SYNC</h2>
          <h1 className="text-[#1e3a5f] text-6xl font-bold">Wrapped</h1>
          <p className="text-[#1e3a5f] text-xl mt-4">{date}</p>
        </div>

        {/* Bottom section - stats */}
        <div className="flex-1 flex flex-col justify-end text-white pb-8">
          <div className="text-8xl font-bold mb-2">{formatNumber(stats.totalTokens)}</div>
          <div className="text-2xl opacity-70 mb-8">tokens</div>

          <div className="space-y-4 text-2xl">
            <div>{stats.totalMessages} messages</div>
            <div>{stats.sessionCount ?? 0} sessions</div>
            <div className="truncate">{stats.topModels[0]?.model || "N/A"}</div>
          </div>
        </div>

        <div className="text-white text-lg opacity-60">OpenSync</div>
      </div>
    </div>
  );
}

// Template 9: Color Shapes (Khroma style) - shapes positioned to not cover text
export function Template9({ stats, date }: TemplateProps) {
  return (
    <div className="w-full h-full bg-[#0f0f0f] p-12 flex flex-col relative overflow-hidden">
      {/* Colorful shape accents - positioned in corners away from text */}
      <div className="absolute top-16 right-12">
        <div className="w-0 h-0 border-l-[30px] border-l-transparent border-r-[30px] border-r-transparent border-b-[52px] border-b-yellow-300" />
      </div>
      <div className="absolute top-48 right-16 w-14 h-14 bg-pink-400 rounded-sm" />
      <div className="absolute bottom-48 right-12 w-16 h-16 bg-blue-500 rotate-45" />
      <div className="absolute bottom-16 right-16">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-red-400" />
      </div>

      {/* Header */}
      <div className="text-white text-3xl font-bold tracking-wider">opensync</div>

      {/* Main content - left aligned to avoid shapes on right */}
      <div className="flex-1 flex flex-col justify-center max-w-[85%]">
        <h1 className="text-white text-7xl font-serif mb-2">Daily Sync</h1>
        <h2 className="text-blue-400 text-7xl font-serif italic mb-10">wrapped.</h2>

        <p className="text-gray-400 text-2xl mb-12">Your coding activity for {date}</p>

        {/* Stats - large and readable */}
        <div className="space-y-8 text-white">
          <div>
            <div className="text-7xl font-bold">{formatNumber(stats.totalTokens)}</div>
            <div className="text-2xl text-gray-500 mt-2">Total Tokens</div>
          </div>
          <div>
            <div className="text-6xl font-bold">{stats.totalMessages}</div>
            <div className="text-2xl text-gray-500 mt-2">Messages</div>
          </div>
          <div>
            <div className="text-5xl font-bold">{stats.sessionCount ?? 0}</div>
            <div className="text-2xl text-gray-500 mt-2">Sessions</div>
          </div>
          <div>
            <div className="text-3xl font-bold truncate">{stats.topModels[0]?.model || "N/A"}</div>
            <div className="text-xl text-gray-500 mt-1">Top Model</div>
          </div>
        </div>
      </div>

      {/* Bottom providers */}
      <div className="text-gray-500 text-xl">
        {stats.topProviders.map((p) => p.provider).join(" | ")}
      </div>
    </div>
  );
}

// Template selector component
interface WrappedTemplateProps {
  designIndex: number;
  stats: WrappedStats;
  date: string;
}

export function WrappedTemplate({ designIndex, stats, date }: WrappedTemplateProps) {
  const templates = [
    Template0,
    Template1,
    Template2,
    Template3,
    Template4,
    Template5,
    Template6,
    Template7,
    Template8,
    Template9,
  ];

  const Template = templates[designIndex % templates.length];
  return <Template stats={stats} date={date} />;
}

export const TEMPLATE_COUNT = 10;
