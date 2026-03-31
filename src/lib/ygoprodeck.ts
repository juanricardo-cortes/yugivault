export async function fetchCardType(
  jpSetNumber: string
): Promise<string | null> {
  // Convert JP set code to EN for YGOProDeck lookup
  const enSetNumber = jpSetNumber.replace(/-JP/i, "-EN");

  try {
    // Step 1: Get card ID from set code
    const setRes = await fetch(
      `https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=${encodeURIComponent(enSetNumber)}`
    );
    if (!setRes.ok) return null;

    const setInfo = await setRes.json();
    if (!setInfo.id) return null;

    // Step 2: Get full card info including type
    const cardRes = await fetch(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${setInfo.id}`
    );
    if (!cardRes.ok) return null;

    const cardData = await cardRes.json();
    return cardData.data?.[0]?.type || null;
  } catch {
    return null;
  }
}
