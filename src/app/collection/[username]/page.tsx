"use client";

import { use, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PriceDisplay from "@/components/PriceDisplay";
import { useExchangeRates } from "@/hooks/useExchangeRates";

interface Profile {
  id: string;
  username: string;
  display_name: string;
  facebook_url: string | null;
}

interface Card {
  id: string;
  set_number: string;
  card_name: string;
  rarity: string | null;
  price: number | null;
  image_url: string | null;
  card_type: string | null;
  quantity: number;
}

interface Folder {
  id: string;
  name: string;
  description: string | null;
  card_count?: number;
  total_value?: number;
}

const getTypeCategory = (cardType: string | null): string => {
  if (!cardType) return "Unknown";
  if (cardType.includes("Spell")) return "Spell";
  if (cardType.includes("Trap")) return "Trap";
  if (cardType.includes("Link")) return "Link";
  if (cardType.includes("XYZ")) return "Xyz";
  if (cardType.includes("Synchro")) return "Synchro";
  if (cardType.includes("Fusion")) return "Fusion";
  if (cardType.includes("Ritual")) return "Ritual";
  if (cardType.includes("Pendulum")) return "Pendulum";
  if (cardType.includes("Monster")) return "Monster";
  return "Unknown";
};

export default function CollectionPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const supabase = createClient();
  const rates = useExchangeRates();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (!data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProfile(data);
    loadFolders(data.id);
    loadCards(data.id, null);
    setLoading(false);
  };

  const loadFolders = async (userId: string) => {
    const { data: folderData } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");

    if (folderData) {
      const foldersWithStats = await Promise.all(
        folderData.map(async (folder) => {
          const { data: cardFolders } = await supabase
            .from("card_folders")
            .select("card_id")
            .eq("folder_id", folder.id);

          if (!cardFolders || cardFolders.length === 0) {
            return { ...folder, card_count: 0, total_value: 0 };
          }

          const cardIds = cardFolders.map((cf) => cf.card_id);
          const { data: folderCards } = await supabase
            .from("cards")
            .select("price, quantity")
            .in("id", cardIds);

          const total = (folderCards || []).reduce(
            (sum, c) => sum + (c.price || 0) * c.quantity,
            0
          );

          return {
            ...folder,
            card_count: cardFolders.length,
            total_value: total,
          };
        })
      );
      setFolders(foldersWithStats);
    }
  };

  const loadCards = useCallback(
    async (userId: string, folderId: string | null) => {
      if (folderId) {
        const { data: cardFolders } = await supabase
          .from("card_folders")
          .select("card_id")
          .eq("folder_id", folderId);

        if (cardFolders && cardFolders.length > 0) {
          const cardIds = cardFolders.map((cf) => cf.card_id);
          const { data } = await supabase
            .from("cards")
            .select("*")
            .in("id", cardIds)
            .order("created_at", { ascending: false });
          setCards(data || []);
        } else {
          setCards([]);
        }
      } else {
        const { data } = await supabase
          .from("cards")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        setCards(data || []);
      }
    },
    []
  );

  useEffect(() => {
    if (profile) {
      loadCards(profile.id, selectedFolder);
    }
  }, [selectedFolder, profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-center">
        <div className="text-4xl mb-4">&#128566;</div>
        <p className="text-xl text-white font-semibold">User not found</p>
        <p className="text-sm text-slate-400 mt-2">
          No collection exists for &ldquo;{username}&rdquo;
        </p>
        <a
          href="/dashboard"
          className="mt-6 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500"
        >
          Back to Dashboard
        </a>
      </div>
    );
  }

  const typeCategories = Array.from(
    new Set(cards.map((c) => getTypeCategory(c.card_type)))
  ).sort();

  const filteredCards =
    typeFilter === "all"
      ? cards
      : cards.filter((c) => getTypeCategory(c.card_type) === typeFilter);

  const totalValue = filteredCards.reduce(
    (sum, c) => sum + (c.price || 0) * c.quantity,
    0
  );

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-xl font-bold text-white">
            Yugi<span className="text-purple-400">Vault</span>
          </a>
        </div>
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
            {isLoggedIn ? "My Collection" : "Sign In"}
          </a>
        </div>
      </header>

      {/* Profile Banner */}
      <div className="border-b border-white/10 px-4 sm:px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-600/30 text-2xl">
            &#128100;
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {profile?.display_name}
            </h1>
            <p className="text-sm text-slate-400">@{profile?.username}</p>
          </div>
          {profile?.facebook_url && (
            <a
              href={profile.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto rounded-lg border border-white/10 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:border-blue-400/30 transition-colors flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Facebook
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Folders */}
        <aside className="hidden sm:block w-64 border-r border-white/10 p-4 overflow-y-auto flex-shrink-0">
          <div className="space-y-1">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                !selectedFolder
                  ? "bg-purple-600/20 text-purple-300 font-medium"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              All Cards
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  selectedFolder === folder.id
                    ? "bg-purple-600/20 text-purple-300 font-medium"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="block truncate">{folder.name}</span>
                <span className="text-xs text-slate-500">
                  {folder.card_count} card{folder.card_count !== 1 && "s"}
                  {folder.total_value
                    ? ` · ¥${folder.total_value.toLocaleString()}`
                    : ""}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Stats Bar */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {selectedFolder
                  ? folders.find((f) => f.id === selectedFolder)?.name
                  : "All Cards"}
              </h2>
              <p className="text-sm text-slate-400">
                {filteredCards.length} card
                {filteredCards.length !== 1 && "s"}
                {typeFilter !== "all" && ` (${typeFilter})`} &middot; Total:
              </p>
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="font-semibold text-purple-300">
                  ¥{totalValue.toLocaleString()}
                </span>
                {rates && (
                  <>
                    <span className="font-semibold text-green-300">
                      ${(totalValue * rates.USD).toFixed(2)}
                    </span>
                    <span className="font-semibold text-yellow-300">
                      ₱{(totalValue * rates.PHP).toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>
            {typeCategories.length > 1 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Types</option>
                {typeCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Card Grid */}
          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-4">&#127183;</div>
              <p className="text-slate-400">
                {cards.length === 0
                  ? "No cards in this collection"
                  : "No cards match this filter"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors"
                >
                  {card.image_url && (
                    <img
                      src={card.image_url}
                      alt={card.card_name}
                      className="h-20 w-14 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">
                      {card.card_name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400">
                        {card.set_number}
                      </span>
                      {card.rarity && (
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-300">
                          {card.rarity}
                        </span>
                      )}
                      {card.card_type && (
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
                          {getTypeCategory(card.card_type)}
                        </span>
                      )}
                      {card.quantity > 1 && (
                        <span className="text-xs text-slate-500">
                          x{card.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                  <PriceDisplay
                    yen={card.price || 0}
                    rates={rates}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
