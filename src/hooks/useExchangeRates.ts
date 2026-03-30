"use client";

import { useState, useEffect } from "react";
import type { ExchangeRates } from "@/lib/currency";

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates | null>(null);

  useEffect(() => {
    fetch("/api/rates")
      .then((res) => res.json())
      .then(setRates)
      .catch(() => setRates({ USD: 0.0067, PHP: 0.38 }));
  }, []);

  return rates;
}
