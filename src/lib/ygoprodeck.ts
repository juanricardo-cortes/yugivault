export async function fetchCardType(
  jpSetNumber: string,
  jpCardName?: string
): Promise<string | null> {
  // Strategy 1: Try set code variations on YGOProDeck
  const variations = buildSetCodeVariations(jpSetNumber);

  for (const code of variations) {
    try {
      const setRes = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=${encodeURIComponent(code)}`
      );
      if (!setRes.ok) continue;

      const setInfo = await setRes.json();
      if (!setInfo.id) continue;

      const cardRes = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${setInfo.id}`
      );
      if (!cardRes.ok) continue;

      const cardData = await cardRes.json();
      const type = cardData.data?.[0]?.type;
      if (type) return type;
    } catch {
      continue;
    }
  }

  // Strategy 2: Look up English name from Japanese via Yugipedia, then search YGOProDeck
  if (jpCardName) {
    try {
      const enName = await lookupEnglishName(jpCardName);
      if (enName) {
        const cardRes = await fetch(
          `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(enName)}`
        );
        if (cardRes.ok) {
          const cardData = await cardRes.json();
          const type = cardData.data?.[0]?.type;
          if (type) return type;
        }
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

async function lookupEnglishName(japaneseName: string): Promise<string | null> {
  try {
    const url = new URL("https://yugipedia.com/api.php");
    url.searchParams.set("action", "askargs");
    url.searchParams.set(
      "conditions",
      `Japanese name::${japaneseName}|Medium::TCG`
    );
    url.searchParams.set("printouts", "English name");
    url.searchParams.set("format", "json");
    url.searchParams.set("parameters", "limit=1");

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const results = data?.query?.results;
    if (!results) return null;

    // Get first result's English name or page title
    const firstKey = Object.keys(results)[0];
    if (!firstKey) return null;

    const entry = results[firstKey];
    const englishName = entry?.printouts?.["English name"]?.[0];
    return englishName || entry?.fulltext || null;
  } catch {
    return null;
  }
}

function buildSetCodeVariations(jpSetNumber: string): string[] {
  const variations: string[] = [];

  // Direct JP→EN replacement (ROTD-JP001 → ROTD-EN001)
  variations.push(jpSetNumber.replace(/-JP/i, "-EN"));

  // Handle codes like TT02-JPB21 where region is "JP" and suffix is "B21"
  const match = jpSetNumber.match(/^(.+)-JP([A-Z]*)(\d+)$/i);
  if (match) {
    const [, prefix, midLetters, num] = match;
    const paddedNum = num.padStart(3, "0");

    if (midLetters) {
      variations.push(`${prefix}-EN${midLetters}${paddedNum}`);
      variations.push(`${prefix}-EN${paddedNum}`);
    } else {
      variations.push(`${prefix}-EN${paddedNum}`);
    }
  }

  // Try the original JP code
  variations.push(jpSetNumber);

  return [...new Set(variations)];
}
