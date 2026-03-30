"use client";

import type { ExchangeRates } from "@/lib/currency";

interface PriceDisplayProps {
  yen: number;
  rates: ExchangeRates | null;
  originalYen?: number;
  size?: "sm" | "md" | "lg";
}

export default function PriceDisplay({
  yen,
  rates,
  originalYen,
  size = "md",
}: PriceDisplayProps) {
  const textSize = {
    sm: { main: "text-sm", sub: "text-xs" },
    md: { main: "text-base", sub: "text-xs" },
    lg: { main: "text-lg", sub: "text-xs" },
  }[size];

  return (
    <div className="text-right">
      {originalYen && originalYen !== yen && (
        <p className="text-xs text-slate-500 line-through">
          ¥{originalYen.toLocaleString()}
        </p>
      )}
      <p className={`${textSize.main} font-bold text-white`}>
        ¥{yen.toLocaleString()}
      </p>
      {rates && (
        <div className={`${textSize.sub} text-slate-400 space-y-0.5`}>
          <p>${(yen * rates.USD).toFixed(2)}</p>
          <p>₱{(yen * rates.PHP).toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
