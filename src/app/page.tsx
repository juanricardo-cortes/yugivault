import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-6xl sm:text-7xl font-bold text-white tracking-tight">
          Yugi<span className="text-purple-400">Vault</span>
        </h1>
        <p className="mt-4 max-w-md text-lg text-slate-300">
          Look up your Yu-Gi-Oh! card prices instantly.
          Track your collection&apos;s total value with live Yuyutei pricing.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-500 active:scale-[0.98] transition-all"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-6 pb-16 max-w-4xl mx-auto w-full">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="text-2xl mb-2">&#128269;</div>
          <h3 className="font-semibold text-white">Set Number Lookup</h3>
          <p className="mt-1 text-sm text-slate-400">
            Enter a set number like ROTD-JP001 and get instant pricing across all rarities.
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="text-2xl mb-2">&#128247;</div>
          <h3 className="font-semibold text-white">Scan Your Cards</h3>
          <p className="mt-1 text-sm text-slate-400">
            Upload a photo and we&apos;ll read the set number automatically.
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="text-2xl mb-2">&#128193;</div>
          <h3 className="font-semibold text-white">Organize Collections</h3>
          <p className="mt-1 text-sm text-slate-400">
            Group cards into folders — decks, trade binders, or however you like.
          </p>
        </div>
      </div>
    </div>
  );
}
