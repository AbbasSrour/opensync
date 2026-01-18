import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { AreaChart, BarChart, ProgressBar, DonutChart } from "../components/Charts";
import {
  ArrowLeft,
  Key,
  Copy,
  Check,
  Trash2,
  BarChart3,
  Clock,
  Coins,
  MessageSquare,
  Cpu,
  Terminal,
  Eye,
  EyeOff,
  ExternalLink,
  User,
  LogOut,
  TrendingUp,
  Folder,
  Bot,
  Zap,
} from "lucide-react";

// Convex URL from environment
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;

// Colors for charts
const MODEL_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"usage" | "api" | "profile">("api");

  const currentUser = useQuery(api.users.me);
  const stats = useQuery(api.users.stats);
  const dailyStats = useQuery(api.analytics.dailyStats, { days: 30 });
  const modelStats = useQuery(api.analytics.modelStats);
  const projectStats = useQuery(api.analytics.projectStats);

  const generateApiKey = useMutation(api.users.generateApiKey);
  const revokeApiKey = useMutation(api.users.revokeApiKey);

  const handleGenerateKey = async () => {
    const key = await generateApiKey();
    setNewApiKey(key);
    setShowApiKey(true);
  };

  const handleRevokeKey = async () => {
    if (confirm("Are you sure? This will invalidate any apps using this key.")) {
      await revokeApiKey();
      setNewApiKey(null);
      setShowApiKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyUrl = async () => {
    if (CONVEX_URL) {
      await navigator.clipboard.writeText(CONVEX_URL);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#0E0E0E]">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-[#0E0E0E] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </Link>
          <span className="text-zinc-300 text-sm font-normal">Settings</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-zinc-800/50 pb-4">
          {(["usage", "api", "profile"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors capitalize",
                activeTab === tab
                  ? "bg-zinc-800/50 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/30"
              )}
            >
              {tab === "api" ? "API Access" : tab}
            </button>
          ))}
        </div>

        {/* Usage Tab */}
        {activeTab === "usage" && (
          <div className="space-y-8">
            {/* Summary stats */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="Sessions"
                  value={stats?.sessionCount.toLocaleString() || "0"}
                />
                <StatCard
                  icon={<Cpu className="h-4 w-4" />}
                  label="Total Tokens"
                  value={formatNumber(stats?.totalTokens || 0)}
                />
                <StatCard
                  icon={<Coins className="h-4 w-4" />}
                  label="Total Cost"
                  value={`$${(stats?.totalCost || 0).toFixed(2)}`}
                />
                <StatCard
                  icon={<Clock className="h-4 w-4" />}
                  label="Total Time"
                  value={formatDuration(stats?.totalDurationMs || 0)}
                />
              </div>
            </section>

            {/* Usage chart */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Token Usage (30 days)
              </h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <div className="h-48">
                  <AreaChart
                    data={(dailyStats || []).map((d) => ({
                      label: d.date,
                      value: d.totalTokens,
                    }))}
                    height={192}
                    color="#3b82f6"
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
                  <span>{dailyStats?.[0]?.date || ""}</span>
                  <span>{dailyStats?.[dailyStats.length - 1]?.date || ""}</span>
                </div>
              </div>
            </section>

            {/* Daily breakdown */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4">Daily Activity</h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <div className="h-32">
                  <BarChart
                    data={(dailyStats || []).slice(-14).map((d) => ({
                      label: new Date(d.date).toLocaleDateString("en", { weekday: "short" }),
                      value: d.sessions,
                      color: "bg-emerald-600",
                    }))}
                    height={128}
                    formatValue={(v) => `${v} sessions`}
                  />
                </div>
              </div>
            </section>

            {/* Model usage */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Usage by Model
              </h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Donut chart */}
                  <div className="flex justify-center">
                    <DonutChart
                      size={140}
                      thickness={14}
                      data={(modelStats || []).slice(0, 5).map((m, i) => ({
                        label: m.model,
                        value: m.totalTokens,
                        color: MODEL_COLORS[i % MODEL_COLORS.length],
                      }))}
                    />
                  </div>
                  {/* Model list */}
                  <div className="flex-1 space-y-3">
                    {(modelStats || []).map((m, i) => (
                      <div key={m.model} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm text-zinc-300">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                            />
                            <span className="truncate max-w-[200px]">{m.model}</span>
                          </span>
                          <span className="text-sm text-zinc-600">{formatNumber(m.totalTokens)}</span>
                        </div>
                        <ProgressBar
                          value={m.totalTokens}
                          max={modelStats?.[0]?.totalTokens || 1}
                          showPercentage={false}
                          color={`bg-[${MODEL_COLORS[i % MODEL_COLORS.length]}]`}
                        />
                        <div className="flex justify-between text-[10px] text-zinc-600">
                          <span>{m.sessions} sessions</span>
                          <span>${m.cost.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                    {(!modelStats || modelStats.length === 0) && (
                      <p className="text-sm text-zinc-600 text-center py-4">No model data yet</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Projects */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Usage by Project
              </h2>
              <div className="rounded-lg bg-zinc-900/30 border border-zinc-800/50 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/30 text-[10px] text-zinc-600 uppercase tracking-wider">
                      <th className="px-4 py-2 text-left font-normal">Project</th>
                      <th className="px-4 py-2 text-right font-normal">Sessions</th>
                      <th className="px-4 py-2 text-right font-normal">Tokens</th>
                      <th className="px-4 py-2 text-right font-normal">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(projectStats || []).slice(0, 10).map((p) => (
                      <tr key={p.project} className="border-b border-zinc-800/20">
                        <td className="px-4 py-2.5 text-sm text-zinc-300 truncate max-w-[300px]">{p.project}</td>
                        <td className="px-4 py-2.5 text-sm text-zinc-500 text-right">{p.sessions}</td>
                        <td className="px-4 py-2.5 text-sm text-zinc-500 text-right">{formatNumber(p.totalTokens)}</td>
                        <td className="px-4 py-2.5 text-sm text-zinc-500 text-right">${p.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!projectStats || projectStats.length === 0) && (
                  <div className="px-4 py-8 text-center text-sm text-zinc-600">No project data yet</div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* API Tab */}
        {activeTab === "api" && (
          <div className="space-y-8">
            {/* Plugin Setup */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Plugin Setup
              </h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <p className="text-sm text-zinc-500 mb-4">
                  Configure the{" "}
                  <a
                    href="https://www.npmjs.com/package/opencode-sync-plugin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    opencode-sync-plugin
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>

                {/* Convex URL */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Convex URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono text-zinc-300 bg-zinc-800/50 px-3 py-2 rounded border border-zinc-700/50 overflow-x-auto">
                        {CONVEX_URL || "Not configured"}
                      </code>
                      <button
                        onClick={handleCopyUrl}
                        className="p-2 rounded hover:bg-zinc-800 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400 transition-colors"
                        title="Copy"
                      >
                        {copiedUrl ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* API Key Status */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">API Key</label>
                    {currentUser?.hasApiKey || newApiKey ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono text-zinc-300 bg-zinc-800/50 px-3 py-2 rounded border border-zinc-700/50">
                          {newApiKey && showApiKey ? newApiKey : "osk_••••••••••••••••"}
                        </code>
                        {newApiKey && (
                          <>
                            <button
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="p-2 rounded hover:bg-zinc-800 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400 transition-colors"
                            >
                              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={handleCopyKey}
                              className="p-2 rounded hover:bg-zinc-800 border border-zinc-700/50 text-zinc-500 hover:text-zinc-400 transition-colors"
                            >
                              {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600">No API key generated</p>
                    )}
                  </div>
                </div>

                {/* Quick Setup */}
                <div className="mt-4 p-3 rounded bg-zinc-800/30 border border-zinc-700/30">
                  <p className="text-xs font-normal text-zinc-400 mb-2">Quick setup</p>
                  <div className="space-y-1 text-xs font-mono text-zinc-500">
                    <p>npm install -g opencode-sync-plugin</p>
                    <p>opencode-sync login</p>
                    <p className="text-zinc-700"># Paste credentials when prompted</p>
                  </div>
                </div>
              </div>
            </section>

            {/* API Key Management */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key Management
              </h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <p className="text-sm text-zinc-500 mb-4">
                  Generate an API key to access your sessions from external applications.
                </p>

                {currentUser?.hasApiKey || newApiKey ? (
                  <div className="space-y-3">
                    {newApiKey && showApiKey && (
                      <div className="p-3 rounded bg-zinc-800/30 border border-zinc-700/30">
                        <p className="text-xs text-zinc-500 mb-2">
                          Copy this key now. You won't see it again.
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm font-mono text-zinc-300 bg-zinc-900/50 px-2 py-1 rounded overflow-x-auto">
                            {newApiKey}
                          </code>
                          <button
                            onClick={handleCopyKey}
                            className="p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-400 transition-colors"
                          >
                            {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <span className="text-sm text-emerald-500">API key active</span>
                      <button
                        onClick={handleRevokeKey}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md text-red-400/80 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Revoke
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateKey}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors text-sm"
                  >
                    <Key className="h-4 w-4" />
                    Generate API Key
                  </button>
                )}
              </div>
            </section>

            {/* API Endpoints */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                API Endpoints
              </h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <div className="space-y-2 text-sm font-mono">
                  <EndpointRow method="GET" path="/api/sessions" />
                  <EndpointRow method="GET" path="/api/search?q=query" />
                  <EndpointRow method="GET" path="/api/context?q=query" />
                  <EndpointRow method="GET" path="/api/export?id=sessionId" />
                </div>
                <Link
                  to="/docs"
                  className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View full API documentation
                </Link>
              </div>
            </section>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4 flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                <div className="flex items-center gap-4">
                  {user?.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt="" className="h-14 w-14 rounded-full" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-lg font-normal">
                      {user?.firstName?.[0] || user?.email?.[0] || "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-zinc-200">{user?.firstName} {user?.lastName}</p>
                    <p className="text-sm text-zinc-500">{user?.email}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/50">
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm text-red-400/80 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </section>

            {/* Account info */}
            <section>
              <h2 className="text-sm font-normal text-zinc-400 mb-4">Account</h2>
              <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Member since</span>
                  <span className="text-sm text-zinc-300">
                    {currentUser?.createdAt
                      ? new Date(currentUser.createdAt).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Total sessions</span>
                  <span className="text-sm text-zinc-300">{stats?.sessionCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Total messages</span>
                  <span className="text-sm text-zinc-300">{stats?.messageCount || 0}</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// Stat card component
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
      <div className="flex items-center gap-2 text-zinc-500 mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-light text-zinc-200">{value}</p>
    </div>
  );
}

// Endpoint row component
function EndpointRow({ method, path }: { method: string; path: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">
        {method}
      </span>
      <span className="text-zinc-500">{path}</span>
    </div>
  );
}
