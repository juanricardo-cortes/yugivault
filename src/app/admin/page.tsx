"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useExchangeRates } from "@/hooks/useExchangeRates";

interface Stats {
  users: {
    total: number;
    loggedInToday: number;
    newThisWeek: number;
    newThisMonth: number;
    withProfiles: number;
    withoutProfiles: number;
    trialUsers: number;
  };
  cards: {
    totalCards: number;
    totalQuantity: number;
    totalValue: number;
    usersWithCards: number;
    avgCollectionValue: number;
    stalePrices: number;
  };
  subscriptions: {
    monthly: number;
    yearly: number;
    total: number;
  };
  topCollections: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    total_value: number;
  }[];
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const rates = useExchangeRates();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.email !== "cortes.ricardo1@gmail.com") {
      router.push("/dashboard");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // Failed to load stats
    }
    setLoading(false);
  };

  const formatYen = (v: number) => `¥${v.toLocaleString()}`;
  const formatUsd = (v: number) =>
    rates ? `$${(v * rates.USD).toFixed(2)}` : "";
  const formatPhp = (v: number) =>
    rates ? `₱${(v * rates.PHP).toFixed(2)}` : "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
        <p className="text-slate-400">Failed to load stats</p>
      </div>
    );
  }

  // Revenue estimate
  const monthlyRevenue = stats.subscriptions.monthly * 99;
  const yearlyRevenue = stats.subscriptions.yearly * 999;
  const totalRevenue = monthlyRevenue + yearlyRevenue;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">
            Yugi<span className="text-purple-400">Vault</span>
            <span className="ml-2 text-sm font-normal text-slate-400">
              Admin
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Dashboard
          </a>
          <button
            onClick={loadStats}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Users Section */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Users
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Total Users" value={stats.users.total} />
            <MetricCard
              label="Logged In Today"
              value={stats.users.loggedInToday}
            />
            <MetricCard label="New This Week" value={stats.users.newThisWeek} />
            <MetricCard
              label="New This Month"
              value={stats.users.newThisMonth}
            />
            <MetricCard
              label="With Profiles"
              value={stats.users.withProfiles}
              subtitle={`${stats.users.total > 0 ? Math.round((stats.users.withProfiles / stats.users.total) * 100) : 0}%`}
            />
            <MetricCard
              label="Without Profiles"
              value={stats.users.withoutProfiles}
            />
            <MetricCard
              label="In Trial Period"
              value={stats.users.trialUsers}
            />
          </div>
        </section>

        {/* Cards & Collection Section */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Cards & Collections
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Total Platform Value"
              value={formatYen(stats.cards.totalValue)}
              subtitle={`${formatUsd(stats.cards.totalValue)} / ${formatPhp(stats.cards.totalValue)}`}
              large
            />
            <MetricCard
              label="Total Cards (unique)"
              value={stats.cards.totalCards}
            />
            <MetricCard
              label="Total Cards (qty)"
              value={stats.cards.totalQuantity}
            />
            <MetricCard
              label="Users With Cards"
              value={stats.cards.usersWithCards}
            />
            <MetricCard
              label="Avg Collection Value"
              value={formatYen(stats.cards.avgCollectionValue)}
              subtitle={formatUsd(stats.cards.avgCollectionValue)}
            />
            <MetricCard
              label="Stale Prices"
              value={stats.cards.stalePrices}
              subtitle=">7 days old"
              alert={stats.cards.stalePrices > 0}
            />
          </div>
        </section>

        {/* Subscriptions & Revenue */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Subscriptions & Revenue
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Active Subscriptions"
              value={stats.subscriptions.total}
            />
            <MetricCard
              label="Monthly Plans"
              value={stats.subscriptions.monthly}
              subtitle="₱99/mo each"
            />
            <MetricCard
              label="Yearly Plans"
              value={stats.subscriptions.yearly}
              subtitle="₱999/yr each"
            />
            <MetricCard
              label="Est. Revenue"
              value={`₱${totalRevenue.toLocaleString()}`}
              subtitle={`₱${monthlyRevenue} monthly + ₱${yearlyRevenue} yearly`}
              large
            />
          </div>
        </section>

        {/* Top Collections */}
        <section>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Top 10 Collections
          </h2>
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-right px-4 py-3 font-medium">
                    Total Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.topCollections.map((col, i) => (
                  <tr
                    key={col.user_id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      {col.username ? (
                        <a
                          href={`/collection/${col.username}`}
                          className="text-purple-300 hover:text-purple-200"
                        >
                          {col.display_name || col.username}
                          <span className="text-slate-500 ml-1">
                            @{col.username}
                          </span>
                        </a>
                      ) : (
                        <span className="text-slate-400">
                          {col.user_id.slice(0, 8)}...
                          <span className="text-slate-500 ml-1">
                            (no profile)
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-medium">
                        {formatYen(col.total_value)}
                      </span>
                      {rates && (
                        <span className="text-slate-500 ml-2">
                          {formatUsd(col.total_value)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {stats.topCollections.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No collections yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  large,
  alert,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  large?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl bg-white/5 border p-4 ${
        alert ? "border-red-500/30" : "border-white/10"
      } ${large ? "sm:col-span-2" : ""}`}
    >
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p
        className={`font-bold ${
          alert ? "text-red-400" : "text-white"
        } ${large ? "text-2xl" : "text-xl"}`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
