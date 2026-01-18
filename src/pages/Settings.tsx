import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../lib/auth";
import { Link } from "react-router-dom";
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
} from "lucide-react";

// Convex URL from environment - safe to expose, this is a public endpoint
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const currentUser = useQuery(api.users.me);
  const stats = useQuery(api.users.stats);

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

  // Copy API key to clipboard
  const handleCopyKey = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  // Copy Convex URL to clipboard
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-foreground font-semibold">Settings</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Profile */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Profile</h2>
          <div className="p-4 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-4">
              {user?.profilePictureUrl ? (
                <img
                  src={user.profilePictureUrl}
                  alt=""
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                  {user?.firstName?.[0] || user?.email?.[0] || "?"}
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-4 px-4 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
            >
              Sign out
            </button>
          </div>
        </section>

        {/* Stats */}
        {stats && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Usage Statistics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs">Sessions</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.sessionCount.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Cpu className="h-4 w-4" />
                  <span className="text-xs">Tokens</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalTokens.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Coins className="h-4 w-4" />
                  <span className="text-xs">Cost</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  ${stats.totalCost.toFixed(2)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Time</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatDuration(stats.totalDurationMs)}
                </p>
              </div>
            </div>

            {/* Model breakdown */}
            {Object.keys(stats.modelUsage).length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-card border border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Usage by Model
                </h3>
                <div className="space-y-2">
                  {Object.entries(stats.modelUsage).map(([model, tokens]) => (
                    <div key={model} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground font-mono">
                        {model}
                      </span>
                      <span className="text-sm text-foreground">
                        {(tokens as number).toLocaleString()} tokens
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Plugin Setup */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Plugin Setup
          </h2>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Use these credentials to configure the{" "}
              <a
                href="https://www.npmjs.com/package/opencode-sync-plugin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                opencode-sync-plugin
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>

            {/* Convex URL */}
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Convex URL
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono text-foreground bg-muted px-3 py-2 rounded border border-border overflow-x-auto">
                    {CONVEX_URL || "Not configured"}
                  </code>
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 rounded hover:bg-accent border border-border"
                    title="Copy Convex URL"
                  >
                    {copiedUrl ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* API Key Status */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  API Key
                </label>
                {currentUser?.hasApiKey || newApiKey ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono text-foreground bg-muted px-3 py-2 rounded border border-border">
                      {newApiKey && showApiKey ? newApiKey : "osk_••••••••••••••••"}
                    </code>
                    {newApiKey && (
                      <>
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-2 rounded hover:bg-accent border border-border"
                          title={showApiKey ? "Hide API key" : "Show API key"}
                        >
                          {showApiKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={handleCopyKey}
                          className="p-2 rounded hover:bg-accent border border-border"
                          title="Copy API key"
                        >
                          {copiedKey ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No API key generated. Create one below.
                  </p>
                )}
              </div>
            </div>

            {/* Quick Setup Instructions */}
            <div className="mt-4 p-3 rounded bg-background border border-border">
              <p className="text-xs font-medium text-foreground mb-2">Quick setup</p>
              <div className="space-y-1 text-xs font-mono text-muted-foreground">
                <p>npm install -g opencode-sync-plugin</p>
                <p>opencode-sync login</p>
                <p className="text-zinc-600"># Paste credentials when prompted</p>
              </div>
            </div>
          </div>
        </section>

        {/* API Key */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
          </h2>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Generate an API key to access your sessions from external applications.
              Use this for context engineering, custom integrations, or exporting data.
            </p>

            {currentUser?.hasApiKey || newApiKey ? (
              <div className="space-y-3">
                {newApiKey && showApiKey && (
                  <div className="p-3 rounded bg-background border border-border">
                    <p className="text-xs text-muted-foreground mb-2">
                      Copy this key now. You won't see it again.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono text-foreground bg-muted px-2 py-1 rounded overflow-x-auto">
                        {newApiKey}
                      </code>
                      <button
                        onClick={handleCopyKey}
                        className="p-2 rounded hover:bg-accent"
                        title="Copy API key"
                      >
                        {copiedKey ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-500">API key active</span>
                  <button
                    onClick={handleRevokeKey}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Revoke
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateKey}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Key className="h-4 w-4" />
                Generate API Key
              </button>
            )}
          </div>

          {/* API Docs Preview */}
          <div className="mt-4 p-4 rounded-lg bg-card border border-border">
            <h3 className="text-sm font-medium text-foreground mb-3">
              API Endpoints
            </h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 text-xs">
                  GET
                </span>
                <span className="text-muted-foreground">/api/sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 text-xs">
                  GET
                </span>
                <span className="text-muted-foreground">/api/search?q=query</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 text-xs">
                  GET
                </span>
                <span className="text-muted-foreground">/api/context?q=query</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 text-xs">
                  GET
                </span>
                <span className="text-muted-foreground">/api/export?id=sessionId</span>
              </div>
            </div>
            <Link
              to="/docs"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              View full API documentation
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
