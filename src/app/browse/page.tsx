"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProfileResult {
  id: string;
  username: string;
  display_name: string;
  facebook_url: string | null;
  card_count?: number;
}

export default function BrowsePage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
    loadAllProfiles();
  }, []);

  const loadAllProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("display_name");

    if (data) {
      const withCounts = await Promise.all(
        data.map(async (profile) => {
          const { count } = await supabase
            .from("cards")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id);
          return { ...profile, card_count: count || 0 };
        })
      );
      setProfiles(withCounts);
    }
    setLoading(false);
  };

  const filtered = query.trim()
    ? profiles.filter(
        (p) =>
          p.username.toLowerCase().includes(query.toLowerCase()) ||
          p.display_name.toLowerCase().includes(query.toLowerCase())
      )
    : profiles;

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-4">
        <a href="/dashboard" className="text-xl font-bold text-white">
          Yugi<span className="text-purple-400">Vault</span>
        </a>
        <a
          href={isLoggedIn ? "/dashboard" : "/login"}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
        >
          {isLoggedIn ? "My Collection" : "Sign In"}
        </a>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-white mb-6">
          Browse Collections
        </h1>

        {/* Search */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or display name..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-6"
        />

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-4">&#128269;</div>
            <p className="text-slate-400">
              {profiles.length === 0
                ? "No users have set up profiles yet"
                : "No users match your search"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((profile) => (
              <a
                key={profile.id}
                href={`/collection/${profile.username}`}
                className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/30 text-xl flex-shrink-0">
                  &#128100;
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">
                    {profile.display_name}
                  </p>
                  <p className="text-sm text-slate-400">
                    @{profile.username}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-purple-300">
                    {profile.card_count} card
                    {profile.card_count !== 1 && "s"}
                  </p>
                </div>
                {profile.facebook_url && (
                  <svg
                    className="h-5 w-5 text-blue-400 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                )}
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
