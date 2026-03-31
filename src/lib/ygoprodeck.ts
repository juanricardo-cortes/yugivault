export async function fetchCardType(
  jpSetNumber: string
): Promise<string | null> {
  // Try multiple set code variations since JP cards may not have direct EN equivalents
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

  return null;
}

function buildSetCodeVariations(jpSetNumber: string): string[] {
  const variations: string[] = [];

  // Direct JP→EN replacement (ROTD-JP001 → ROTD-EN001)
  variations.push(jpSetNumber.replace(/-JP/i, "-EN"));

  // Handle codes like TT02-JPB21 where region is "JP" and suffix is "B21"
  // Try normalizing: extract the numeric part and pad to 3 digits
  const match = jpSetNumber.match(/^(.+)-JP([A-Z]*)(\d+)$/i);
  if (match) {
    const [, prefix, midLetters, num] = match;
    const paddedNum = num.padStart(3, "0");

    // Try EN with same mid-letters (TT02-JPB21 → TT02-ENB021)
    if (midLetters) {
      variations.push(`${prefix}-EN${midLetters}${paddedNum}`);
      // Also try without mid-letters (TT02-EN021)
      variations.push(`${prefix}-EN${paddedNum}`);
    } else {
      variations.push(`${prefix}-EN${paddedNum}`);
    }
  }

  // Try the original JP code (YGOProDeck has some JP entries)
  variations.push(jpSetNumber);

  // Deduplicate
  return [...new Set(variations)];
}
