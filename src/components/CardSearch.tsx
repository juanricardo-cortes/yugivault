"use client";

import { useState } from "react";
import type { YuyuteiCard } from "@/lib/yuyutei";
import type { ExchangeRates } from "@/lib/currency";
import PriceDisplay from "./PriceDisplay";

interface CardSearchProps {
  onAddCard?: (card: YuyuteiCard) => void;
  rates: ExchangeRates | null;
}

export default function CardSearch({ onAddCard, rates }: CardSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YuyuteiCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch(
        `/api/cards?q=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        return;
      }

      if (data.cards.length === 0) {
        setError("No cards found for that set number");
        return;
      }

      setResults(data.cards);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter set number (e.g. ROTD-JP001)"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            "Search"
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400">
            Found {results.length} result{results.length !== 1 && "s"}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {results.map((card, i) => (
              <div
                key={`${card.setNumber}-${card.rarity}-${i}`}
                className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors"
              >
                {/* Card Image */}
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt={card.cardName}
                    className="h-20 w-14 rounded object-cover flex-shrink-0"
                  />
                )}

                {/* Card Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">
                    {card.cardName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {card.setNumber}
                    </span>
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-300">
                      {card.rarity}
                    </span>
                    {!card.inStock && (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                        Out of stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & Action */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <PriceDisplay
                    yen={card.price}
                    rates={rates}
                    originalYen={card.originalPrice}
                    size="lg"
                  />
                  {onAddCard && (
                    <button
                      onClick={() => onAddCard(card)}
                      className="rounded-lg bg-purple-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 active:scale-95 transition-all"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
