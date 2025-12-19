// src/pages/dashboard.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  fetchBlinkData,
  fetchDashboardStats,
  fetchTrends,
  exportBlinks,
} from "../lib/api";
import { formatDateTime } from "../lib/utils";
import { TrendChart } from "../components/TrendChart";

/**
 * Main dashboard page: shows current blink rate, history, and trends
 * for the authenticated user. Requires a JWT stored in localStorage
 * under the key "waw_token".
 */
export default function DashboardPage() {
  const router = useRouter();

  const [stats, setStats] = useState({});
  const [data, setData] = useState([]);
  const [trends, setTrends] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("week");      // day | week | month | all
  const [tab, setTab] = useState("overview");      // overview | history | trends

  /**
   * Read auth token from localStorage (browser only).
   * useMemo ensures this happens once after hydration.
   */
  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("waw_token");
  }, []);

  /**
   * Load all dashboard data (stats + history + trends) for the current range.
   * Optionally accepts an explicit token (used on first load).
   */
  const loadData = async (currentToken) => {
    const t = currentToken || token;
    if (!t) return;

    setLoading(true);
    setError("");

    try {
      const trendsPeriod = range === "all" ? "month" : range;

      const [statsRes, blinksRes, trendsRes] = await Promise.all([
        fetchDashboardStats(t),
        fetchBlinkData(t, { range }),
        fetchTrends(t, trendsPeriod),
      ]);

      setStats(statsRes || {});
      setData(blinksRes || []);
      setTrends(trendsRes || {});
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  /**
   * On mount and whenever token/range changes:
   * - Redirect to login if no token.
   * - Otherwise, fetch data for the current range.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const init = async () => {
      if (!token) {
        router.replace("/login");
        return;
      }
      await loadData(token);
    };

    init();
  }, [token, range, router]);

  /**
   * Trigger CSV export for the last N days.
   * Creates a temporary link and downloads the blob.
   */
  const handleExport = async () => {
    if (!token) {
      setError("Please login again");
      return;
    }
    try {
      const blob = await exportBlinks(token, 30);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waw-blinks-${range}-${new Date()
        .toISOString()
        .split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Export failed: " + (err.message || "Unknown error"));
    }
  };

  /**
   * Derived metrics: current average blink rate and risk level.
   */
  const blinkRate = useMemo(() => {
    if (!stats.avg_blink_rate) return 0;
    return stats.avg_blink_rate;
  }, [stats]);

  const riskLevel = useMemo(() => {
    const rate = blinkRate;
    if (rate < 10)
      return { label: "High Risk", color: "bg-red-500 text-red-100" };
    if (rate < 15)
      return { label: "Warning", color: "bg-yellow-500 text-yellow-100" };
    return { label: "Healthy", color: "bg-green-500 text-green-100" };
  }, [blinkRate]);

  /**
   * Small helper for metric cards.
   */
  const renderStatsCard = (label, value, diff, icon) => (
    <div className="group bg-zinc-900/50 backdrop-blur-md border border-zinc-700 rounded-xl p-6 hover:border-zinc-600 transition-all hover:-translate-y-1">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-3xl font-bold mb-1">{value ?? 0}</p>
      {typeof diff === "number" && (
        <span
          className={`text-xs ${
            diff > 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {diff > 0 ? "↑" : "↓"}
          {Math.abs(diff)}% vs last week
        </span>
      )}
    </div>
  );

  // ------------- Render states -------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center">
        <div className="text-center text-zinc-400">
          <div className="w-12 h-12 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">No session found</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ------------- Main layout -------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900 text-white">
      {/* Header */}
      <header className="backdrop-blur-md bg-black/30 sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-xl">👁️</span>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Wellness at Work
            </h1>
            <p className="text-xs text-zinc-400">Eye health dashboard</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-3 py-1.5 bg-zinc-800 text-xs rounded-lg border border-zinc-600 hover:bg-zinc-700 disabled:opacity-50 transition-all"
          >
            📊 Export CSV
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem("waw_token");
              }
              router.push("/login");
            }}
            className="px-4 py-1.5 text-sm text-zinc-300 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={() => loadData()}
            className="text-xs text-red-200 underline mt-1"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Hero metric */}
        <div className="bg-gradient-to-r from-zinc-900/50 to-zinc-800/50 backdrop-blur-md border border-zinc-700 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-400 text-sm mb-1">Current Blink Rate</p>
              <p className="text-4xl font-black">{blinkRate} bpm</p>
              <p className="text-sm text-zinc-400 mt-1">
                Normal: 15-20 | Warning: &lt;15 | High risk: &lt;10
              </p>
            </div>
            <div
              className={`px-6 py-3 rounded-xl ${riskLevel.color} font-semibold shadow-2xl`}
            >
              {riskLevel.label}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center bg-zinc-900/50 backdrop-blur-md border border-zinc-700 rounded-xl p-4">
          <div className="flex space-x-2">
            {["day", "week", "month", "all"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  range === r
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {r === "all" ? "All Time" : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex space-x-2 text-sm text-zinc-400">
            <span>Sessions: {stats.total_sessions ?? 0}</span>
            <span>• Time: {stats.total_time?.toFixed(1) || 0}h</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: "Total Blinks",
              value: stats.total_blinks,
              diff: stats.total_blinks_7d_change,
              icon: "👁️",
            },
            { label: "Today", value: stats.today_blinks, diff: null, icon: "📅" },
            {
              label: "Avg Rate",
              value: `${stats.avg_blink_rate || 0} bpm`,
              diff: null,
              icon: "⚡",
            },
            {
              label: "Peak Hour",
              value: stats.peak_hour ? `${stats.peak_hour}:00` : "-",
              diff: null,
              icon: "🕐",
            },
          ].map(({ label, value, diff, icon }) =>
            renderStatsCard(label, value, diff, icon),
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {["overview", "history", "trends"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-4 px-6 text-sm font-medium border-b-2 transition-all ${
                tab === t
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              {t === "overview" ? "Overview" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
              <h3 className="font-semibold mb-4">
                Blink Rate Trends ({range === "all" ? "month" : range})
              </h3>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <TrendChart data={trends.data || []} />
              </div>
              {trends.summary && (
                <p className="text-xs mt-3 text-zinc-400">
                  Best day: {trends.summary.best_day} (
                  {trends.summary.avg_daily_blinks} avg)
                </p>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-6">
                <h4 className="font-semibold mb-2 flex items-center">💡 Quick Tips</h4>
                <ul className="text-sm space-y-1 text-orange-100">
                  <li>• 20-20-20 rule every {Math.max(10, 20 - blinkRate)} min</li>
                  <li>• {blinkRate < 15 ? "Stay hydrated" : "Excellent rate!"}</li>
                  <li>• Blue light filter after 8PM</li>
                </ul>
              </div>
              <div
                className={`p-6 rounded-xl border ${riskLevel.color.replace(
                  "text-",
                  "border-",
                )}/30`}
              >
                <h4 className="font-semibold mb-2">
                  {riskLevel.label} Status • {stats.consistency_score || 0}/100
                  consistency
                </h4>
                <p className="text-sm text-zinc-200">
                  {stats.total_sessions || 0} sessions tracked this {range}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Recent Activity ({data.length} events)
              </h3>
              <div className="text-xs text-zinc-400">
                Last sync: {formatDateTime(Date.now())}
              </div>
            </div>
            {data.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <p className="text-lg mb-2">No blink data yet</p>
                <p className="text-sm">
                  Run desktop app → blink naturally → data syncs automatically
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left py-3 pr-4 w-32">Time</th>
                      <th className="text-left py-3 px-4 w-20">Delta</th>
                      <th className="text-left py-3 px-4 w-28">Session</th>
                      <th className="text-left py-3 px-4 w-24">Duration</th>
                      <th className="text-right py-3 pl-4 w-20">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 50).map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="py-3 pr-4 font-mono">
                          {formatDateTime(p.timestamp)}
                        </td>
                        <td className="py-3 px-4 font-mono bg-blue-500/10 text-blue-400 rounded px-2 py-1">
                          +{p.blink_delta}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400 truncate">
                          {p.session_id?.slice(-8) || "live"}
                        </td>
                        <td className="py-3 px-4 text-zinc-400">
                          {p.session_duration
                            ? `${(p.session_duration / 60).toFixed(0)}m`
                            : "-"}
                        </td>
                        <td className="py-3 pl-4 text-right text-zinc-400">
                          {p.session_rate
                            ? `${p.session_rate.toFixed(1)}bpm`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Trends tab */}
        {tab === "trends" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
              <h3 className="font-semibold mb-4">
                Trends: {trends.period || (range === "all" ? "month" : range)}
              </h3>
              <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
                <TrendChart data={trends.data || []} />
              </div>
              <p className="text-sm text-zinc-300">
                {trends.data?.length || 0} data points • Trend:{" "}
                {trends.trend_direction || "stable"}
              </p>
              {trends.summary && (
                <p className="text-xs mt-2 text-zinc-400">
                  Best day: {trends.summary.best_day || "—"} • Avg daily blinks:{" "}
                  {trends.summary.avg_daily_blinks ?? 0}
                </p>
              )}
            </div>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold mb-4">Session Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-zinc-400">Risk Level</span>
                  <span
                    className={`font-semibold px-2 py-1 rounded ${riskLevel.color} inline-block`}
                  >
                    {riskLevel.label}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Consistency</span>
                  <span className="font-semibold">
                    {stats.consistency_score || 0}/100
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400">Peak Hour</span>
                  <span>{stats.peak_hour ? `${stats.peak_hour}:00` : "N/A"}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Total Time</span>
                  <span>{stats.total_time?.toFixed(1) || 0}h</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
