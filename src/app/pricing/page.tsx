"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PricingPage() {
  const supabase = createClient();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "cancelled") {
      setCancelled(true);
    }
  }, []);

  const handleSubscribe = async (plan: "monthly" | "yearly") => {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }

    setLoading(plan);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to start checkout");
        setLoading(null);
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-4">
        <a href={isLoggedIn ? "/dashboard" : "/browse"} className="text-xl font-bold text-white">
          Yugi<span className="text-purple-400">Vault</span>
        </a>
        <div className="flex items-center gap-3">
          <a
            href="/browse"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Browse
          </a>
          <a
            href={isLoggedIn ? "/dashboard" : "/login"}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            {isLoggedIn ? "Dashboard" : "Sign In"}
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-3xl w-full text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Unlock <span className="text-purple-400">YugiVault Premium</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Track your Yu-Gi-Oh! collection with real-time prices from Yuyutei
          </p>
        </div>

        {cancelled && (
          <div className="mb-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-400">
            Payment was cancelled. You can try again anytime.
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full mb-12">
          {/* Monthly */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-1">Monthly</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-white">&#8369;99</span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <span className="text-purple-400">&#10003;</span> Add &amp; manage cards
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">&#10003;</span> Search Yuyutei prices
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">&#10003;</span> Card type filtering
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">&#10003;</span> Auto price refresh
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">&#10003;</span> Folders &amp; organization
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">&#10003;</span> Camera OCR scanning
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe("monthly")}
              disabled={loading !== null}
              className="w-full rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading === "monthly" ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "Subscribe with GCash"
              )}
            </button>
          </div>

          {/* Yearly */}
          <div className="rounded-2xl bg-white/5 border-2 border-purple-500/50 p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-3 py-0.5 text-xs font-semibold text-white">
              Save 16%
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Yearly</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-white">&#8369;999</span>
              <span className="text-slate-400 text-sm">/year</span>
            </div>
            <ul className="space-y-2 mb-6 flex-1 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <span className="text-purple-400">&#10003;</span> Everything in Monthly
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">&#10003;</span> 2 months free
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe("yearly")}
              disabled={loading !== null}
              className="w-full rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading === "yearly" ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "Subscribe with GCash"
              )}
            </button>
          </div>
        </div>

        {/* Free Features */}
        <div className="text-center">
          <p className="text-sm text-slate-500">
            Free users can browse other players&apos; collections without an account.
          </p>
        </div>
      </main>
    </div>
  );
}
