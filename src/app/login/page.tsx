"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div>
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Yugi<span className="text-purple-400">Vault</span>
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Track your Yu-Gi-Oh! card collection value
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-8 space-y-6">
          <p className="text-slate-300 text-sm">
            {isSignUp ? "Create an account" : "Sign in to manage your collection"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setMessage("");
            }}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Prices sourced from Yuyutei
        </p>
      </div>
    </div>
  );
}
