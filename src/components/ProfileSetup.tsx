"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  username: string;
  display_name: string;
  facebook_url: string | null;
}

interface ProfileSetupProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileSetup({ onClose, onSaved }: ProfileSetupProps) {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setUsername(data.username);
      setDisplayName(data.display_name);
      setFacebookUrl(data.facebook_url || "");
      setIsNew(false);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername || !displayName.trim()) {
      setError("Username and display name are required");
      setSaving(false);
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, hyphens, and underscores");
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const profileData = {
      id: user.id,
      username: trimmedUsername,
      display_name: displayName.trim(),
      facebook_url: facebookUrl.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error: dbError } = isNew
      ? await supabase.from("profiles").insert(profileData)
      : await supabase.from("profiles").update(profileData).eq("id", user.id);

    if (dbError) {
      if (dbError.code === "23505") {
        setError("That username is already taken");
      } else {
        setError(dbError.message);
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="rounded-2xl bg-slate-900 border border-white/10 p-6">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            {isNew ? "Set Up Profile" : "Edit Profile"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. duelmaster99"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Your collection will be at /collection/{username || "..."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Facebook Profile URL
            </label>
            <input
              type="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/yourprofile"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
