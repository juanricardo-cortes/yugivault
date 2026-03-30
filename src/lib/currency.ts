export interface ExchangeRates {
  USD: number;
  PHP: number;
}

let cachedRates: ExchangeRates | null = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getExchangeRates(): Promise<ExchangeRates> {
  if (cachedRates && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedRates;
  }

  try {
    const res = await fetch(
      "https://api.exchangerate-api.com/v4/latest/JPY"
    );
    const data = await res.json();
    cachedRates = {
      USD: data.rates.USD,
      PHP: data.rates.PHP,
    };
    cacheTime = Date.now();
    return cachedRates;
  } catch {
    // Fallback rates if API fails
    return { USD: 0.0067, PHP: 0.38 };
  }
}

export function formatPrice(
  yen: number,
  rates: ExchangeRates
): { jpy: string; usd: string; php: string } {
  return {
    jpy: `¥${yen.toLocaleString()}`,
    usd: `$${(yen * rates.USD).toFixed(2)}`,
    php: `₱${(yen * rates.PHP).toFixed(2)}`,
  };
}
