"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CardSearch from "@/components/CardSearch";
import FolderList from "@/components/FolderList";
import PriceDisplay from "@/components/PriceDisplay";
import ProfileSetup from "@/components/ProfileSetup";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useSubscription } from "@/hooks/useSubscription";
import type { YuyuteiCard } from "@/lib/yuyutei";

interface Card {
  id: string;
  set_number: string;
  card_name: string;
  rarity: string | null;
  price: number | null;
  image_url: string | null;
  card_type: string | null;
  quantity: number;
  last_price_update: string | null;
}

interface Folder {
  id: string;
  name: string;
  description: string | null;
  card_count?: number;
  total_value?: number;
}

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();
  const rates = useExchangeRates();
  const { active: isPremium, isTrial, trialDaysLeft } = useSubscription();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [addToFolderId, setAddToFolderId] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshMsg, setLastRefreshMsg] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showProfile, setShowProfile] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const refreshPrices = useCallback(async () => {
    setRefreshing(true);
    setLastRefreshMsg("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      let offset = 0;
      let totalUpdated = 0;
      let done = false;

      while (!done) {
        const res = await fetch("/api/cards/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();

        if (!res.ok) break;

        totalUpdated += data.updated;
        done = data.done;
        offset = data.nextOffset;

        setLastRefreshMsg(
          `Refreshing... ${data.processed}/${data.total} sets`
        );
      }

      setLastRefreshMsg(
        `Updated ${totalUpdated} card${totalUpdated !== 1 ? "s" : ""}`
      );
      loadCards();
      loadFolders();
    } catch {
      setLastRefreshMsg("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", currentUser.id)
      .single();
    setProfileUsername(data?.username || null);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
    });
    loadProfile();

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setPaymentSuccess(true);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const loadFolders = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const { data: folderData } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", currentUser.id)
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
  }, []);

  const loadCards = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    if (selectedFolder) {
      const { data: cardFolders } = await supabase
        .from("card_folders")
        .select("card_id")
        .eq("folder_id", selectedFolder);

      if (cardFolders && cardFolders.length > 0) {
        const cardIds = cardFolders.map((cf) => cf.card_id);
        const { data } = await supabase
          .from("cards")
          .select("*")
          .in("id", cardIds)
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });
        setCards(data || []);
      } else {
        setCards([]);
      }
    } else {
      const { data } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
      setCards(data || []);
    }
  }, [selectedFolder]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Auto-refresh prices every 12 hours
  useEffect(() => {
    if (cards.length === 0) return;

    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    const oldestUpdate = cards.reduce((oldest, card) => {
      if (!card.last_price_update) return 0;
      const time = new Date(card.last_price_update).getTime();
      return oldest === 0 ? time : Math.min(oldest, time);
    }, 0);

    const needsRefresh =
      oldestUpdate === 0 || Date.now() - oldestUpdate > TWELVE_HOURS;

    if (needsRefresh && !refreshing) {
      refreshPrices();
    }
  }, [cards.length]);

  const handleAddCard = async (card: YuyuteiCard, quantity: number = 1) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    // Fetch card type from YGOProDeck
    let cardType: string | null = null;
    try {
      const typeRes = await fetch(`/api/cards/type?q=${encodeURIComponent(card.setNumber)}&name=${encodeURIComponent(card.cardName)}`);
      if (typeRes.ok) {
        const typeData = await typeRes.json();
        cardType = typeData.cardType;
      }
    } catch { /* card type is optional */ }

    const { data, error } = await supabase
      .from("cards")
      .insert({
        user_id: currentUser.id,
        set_number: card.setNumber,
        card_name: card.cardName,
        rarity: card.rarity,
        price: card.price,
        image_url: card.imageUrl,
        card_type: cardType,
        quantity,
        last_price_update: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to add card:", error);
      alert("Failed to add card");
      return;
    }

    const targetFolder = addToFolderId || selectedFolder;
    if (targetFolder && data) {
      await supabase
        .from("card_folders")
        .insert({ card_id: data.id, folder_id: targetFolder });
    }

    loadCards();
    loadFolders();
  };

  const [showTypePicker, setShowTypePicker] = useState<string | null>(null);

  const cardTypeOptions = [
    "Normal Monster", "Effect Monster", "Ritual Monster",
    "Fusion Monster", "Synchro Monster", "XYZ Monster",
    "Pendulum Effect Monster", "Link Monster",
    "Spell Card", "Trap Card",
  ];

  const handleSetCardType = async (cardId: string, cardType: string) => {
    await supabase
      .from("cards")
      .update({ card_type: cardType, updated_at: new Date().toISOString() })
      .eq("id", cardId);
    setShowTypePicker(null);
    loadCards();
  };

  const handleDeleteCard = async (cardId: string) => {
    await supabase.from("cards").delete().eq("id", cardId);
    loadCards();
    loadFolders();
  };

  const handleAddToFolder = async (cardId: string, folderId: string) => {
    await supabase
      .from("card_folders")
      .upsert({ card_id: cardId, folder_id: folderId });
    setShowFolderPicker(null);
    loadFolders();
  };

  const handleRemoveFromFolder = async (cardId: string) => {
    if (!selectedFolder) return;
    await supabase
      .from("card_folders")
      .delete()
      .eq("card_id", cardId)
      .eq("folder_id", selectedFolder);
    loadCards();
    loadFolders();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Card type categories for filtering
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
          <button
            onClick={() => setShowMobileNav(!showMobileNav)}
            className="sm:hidden text-slate-400 hover:text-white"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">
            Yugi<span className="text-purple-400">Vault</span>
          </h1>
        </div>
        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-3">
          {user?.email === "cortes.ricardo1@gmail.com" && (
            <a
              href="/admin"
              className="rounded-lg border border-purple-500/30 bg-purple-600/10 px-3 py-1.5 text-sm text-purple-300 hover:bg-purple-600/20 transition-colors"
            >
              Admin
            </a>
          )}
          <a
            href="/browse"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Browse
          </a>
          <button
            onClick={() => setShowProfile(true)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            {profileUsername ? `@${profileUsername}` : "Set Up Profile"}
          </button>
          <span className="text-sm text-slate-400">
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Mobile menu */}
        <div className="relative sm:hidden">
          <button
            onClick={() => setShowHeaderMenu(!showHeaderMenu)}
            className="text-slate-400 hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          {showHeaderMenu && (
            <div className="absolute right-0 top-10 z-50 w-48 rounded-xl bg-slate-800 border border-white/10 py-1 shadow-xl">
              {user?.email === "cortes.ricardo1@gmail.com" && (
                <a href="/admin" className="block w-full text-left px-4 py-2.5 text-sm text-purple-300 hover:bg-white/10">
                  Admin
                </a>
              )}
              <a href="/browse" className="block w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10">
                Browse
              </a>
              <button
                onClick={() => { setShowProfile(true); setShowHeaderMenu(false); }}
                className="block w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10"
              >
                {profileUsername ? `@${profileUsername}` : "Set Up Profile"}
              </button>
              <div className="border-t border-white/10 my-1" />
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/10"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Loading subscription check */}
      {isPremium === null && (
        <div className="flex-1 flex items-center justify-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {/* Premium Gate */}
      {isPremium === false && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">&#128274;</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Premium Required
          </h2>
          <p className="text-slate-400 mb-6 max-w-md">
            Subscribe to YugiVault Premium to manage your collection, search cards, track prices, and more.
          </p>
          <div className="flex gap-3">
            <a
              href="/pricing"
              className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 active:scale-[0.98] transition-all"
            >
              View Plans
            </a>
            <a
              href="/browse"
              className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-300 hover:text-white hover:border-white/20 transition-all"
            >
              Browse Collections
            </a>
          </div>
        </div>
      )}

      {isPremium && <>
      {isTrial && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-xl bg-purple-500/10 border border-purple-500/20 px-4 py-3 text-sm text-purple-300 flex items-center justify-between">
          <span>Free trial: {trialDaysLeft} day{trialDaysLeft !== 1 && "s"} remaining</span>
          <a href="/pricing" className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-500 transition-colors">
            Subscribe
          </a>
        </div>
      )}
      {paymentSuccess && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400 flex items-center justify-between">
          <span>Payment successful! Welcome to YugiVault Premium.</span>
          <button onClick={() => setPaymentSuccess(false)} className="text-green-400 hover:text-green-300">&times;</button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Folders */}
        <aside
          className={`${
            showMobileNav ? "fixed inset-0 z-50 bg-slate-950/95" : "hidden"
          } sm:block sm:relative sm:bg-transparent w-full sm:w-64 border-r border-white/10 p-4 overflow-y-auto flex-shrink-0`}
        >
          <div className="flex justify-end sm:hidden mb-4">
            <button
              onClick={() => setShowMobileNav(false)}
              className="text-slate-400 hover:text-white"
            >
              <svg
                className="h-6 w-6"
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

          <FolderList
            folders={folders}
            selectedFolderId={selectedFolder}
            onSelectFolder={(id) => {
              setSelectedFolder(id);
              setShowMobileNav(false);
            }}
            onFoldersChange={loadFolders}
            rates={rates}
          />
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
                {filteredCards.length} card{filteredCards.length !== 1 && "s"}
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
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
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
              <button
                onClick={refreshPrices}
                disabled={refreshing}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:border-white/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
                title="Refresh all prices from Yuyutei"
              >
                <svg
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="hidden sm:inline">
                  {refreshing ? "Refreshing..." : "Refresh Prices"}
                </span>
              </button>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 active:scale-[0.98] transition-all flex-1 sm:flex-none"
              >
                {showSearch ? "Close Search" : "+ Add Card"}
              </button>
            </div>
            {lastRefreshMsg && (
              <p className="text-xs text-green-400 w-full sm:w-auto text-right">
                {lastRefreshMsg}
              </p>
            )}
          </div>

          {/* Search Panel */}
          {showSearch && (
            <div className="mb-6 rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Search Yuyutei
                </h3>
                {folders.length > 0 && (
                  <select
                    value={addToFolderId || ""}
                    onChange={(e) =>
                      setAddToFolderId(e.target.value || null)
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Add to: No folder</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        Add to: {f.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <CardSearch onAddCard={handleAddCard} rates={rates} />
            </div>
          )}

          {/* Card Grid */}
          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-4">&#127183;</div>
              <p className="text-slate-400">
                {cards.length === 0 ? "No cards yet" : "No cards match this filter"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {cards.length === 0
                  ? "Search for cards to add them to your collection"
                  : "Try selecting a different type"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="group relative flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors"
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
                      <div className="relative">
                        <button
                          onClick={() => setShowTypePicker(showTypePicker === card.id ? null : card.id)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                            card.card_type
                              ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                              : "bg-slate-500/20 text-slate-400 hover:bg-slate-500/30"
                          }`}
                        >
                          {card.card_type ? getTypeCategory(card.card_type) : "Set Type"}
                        </button>
                        {showTypePicker === card.id && (
                          <div className="absolute left-0 top-7 z-10 w-48 rounded-xl bg-slate-800 border border-white/10 py-1 shadow-xl">
                            {cardTypeOptions.map((type) => (
                              <button
                                key={type}
                                onClick={() => handleSetCardType(card.id, type)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${
                                  card.card_type === type ? "text-purple-300" : "text-slate-300"
                                }`}
                              >
                                {getTypeCategory(type)}
                                {card.card_type === type && " ✓"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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

                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setShowFolderPicker(
                            showFolderPicker === card.id ? null : card.id
                          )
                        }
                        className="rounded-lg bg-white/10 p-1.5 text-slate-400 hover:text-white hover:bg-white/20"
                        title="Add to folder"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                      </button>
                      {showFolderPicker === card.id && folders.length > 0 && (
                        <div className="absolute right-0 top-8 z-10 w-48 rounded-xl bg-slate-800 border border-white/10 py-1 shadow-xl">
                          {folders.map((folder) => (
                            <button
                              key={folder.id}
                              onClick={() =>
                                handleAddToFolder(card.id, folder.id)
                              }
                              className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                            >
                              {folder.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedFolder && (
                      <button
                        onClick={() => handleRemoveFromFolder(card.id)}
                        className="rounded-lg bg-white/10 p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-white/20"
                        title="Remove from folder"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 12H4"
                          />
                        </svg>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="rounded-lg bg-white/10 p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/20"
                      title="Delete card"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div></>}

      {/* Profile Modal */}
      {showProfile && (
        <ProfileSetup
          onClose={() => setShowProfile(false)}
          onSaved={() => {
            setShowProfile(false);
            loadProfile();
          }}
        />
      )}
    </div>
  );
}
