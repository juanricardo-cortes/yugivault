"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CardSearch from "@/components/CardSearch";
import FolderList from "@/components/FolderList";
import type { YuyuteiCard } from "@/lib/yuyutei";

interface Card {
  id: string;
  set_number: string;
  card_name: string;
  rarity: string | null;
  price: number | null;
  image_url: string | null;
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
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [addToFolderId, setAddToFolderId] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
    });
  }, []);

  const loadFolders = useCallback(async () => {
    const { data: folderData } = await supabase
      .from("folders")
      .select("*")
      .order("created_at");

    if (folderData) {
      // Get card counts and values per folder
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
          .order("created_at", { ascending: false });
        setCards(data || []);
      } else {
        setCards([]);
      }
    } else {
      const { data } = await supabase
        .from("cards")
        .select("*")
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

  const handleAddCard = async (card: YuyuteiCard) => {
    const { data, error } = await supabase
      .from("cards")
      .insert({
        set_number: card.setNumber,
        card_name: card.cardName,
        rarity: card.rarity,
        price: card.price,
        image_url: card.imageUrl,
        last_price_update: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      alert("Failed to add card");
      return;
    }

    // If a folder is selected or addToFolderId is set, add to that folder
    const targetFolder = addToFolderId || selectedFolder;
    if (targetFolder && data) {
      await supabase
        .from("card_folders")
        .insert({ card_id: data.id, folder_id: targetFolder });
    }

    loadCards();
    loadFolders();
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

  const totalValue = cards.reduce(
    (sum, c) => sum + (c.price || 0) * c.quantity,
    0
  );

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
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
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-400">
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:border-white/20 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Folders */}
        <aside
          className={`${
            showMobileNav ? "fixed inset-0 z-50 bg-slate-950/95" : "hidden"
          } sm:block sm:relative sm:bg-transparent w-full sm:w-64 border-r border-white/10 p-4 overflow-y-auto flex-shrink-0`}
        >
          {/* Mobile close */}
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
                {cards.length} card{cards.length !== 1 && "s"} &middot; Total
                value:{" "}
                <span className="font-semibold text-purple-300">
                  ¥{totalValue.toLocaleString()}
                </span>
              </p>
            </div>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 active:scale-[0.98] transition-all w-full sm:w-auto"
            >
              {showSearch ? "Close Search" : "+ Add Card"}
            </button>
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
              <CardSearch onAddCard={handleAddCard} />
            </div>
          )}

          {/* Card Grid */}
          {cards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-4">&#127183;</div>
              <p className="text-slate-400">No cards yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Search for cards to add them to your collection
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cards.map((card) => (
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
                      {card.quantity > 1 && (
                        <span className="text-xs text-slate-500">
                          x{card.quantity}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-base font-bold text-white">
                      ¥{(card.price || 0).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Add to folder */}
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

                    {/* Remove from folder */}
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

                    {/* Delete card */}
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
      </div>
    </div>
  );
}
