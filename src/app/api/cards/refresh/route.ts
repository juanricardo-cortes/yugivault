import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchCard } from "@/lib/yuyutei";
import { fetchCardType } from "@/lib/ygoprodeck";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Accept optional batch parameters
  const body = await request.json().catch(() => ({}));
  const batchSize = 5;
  const offset = (body.offset as number) || 0;

  // Get all cards for this user
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, set_number, rarity, card_type")
    .eq("user_id", user.id);

  if (error || !cards || cards.length === 0) {
    return Response.json({ updated: 0, done: true, total: 0 });
  }

  // Group by set_number to minimize scraping requests
  const allSetNumbers = [...new Set(cards.map((c) => c.set_number))];
  const batch = allSetNumbers.slice(offset, offset + batchSize);
  const done = offset + batchSize >= allSetNumbers.length;

  let updated = 0;

  for (const setNumber of batch) {
    try {
      const results = await searchCard(setNumber);
      const matchingCards = cards.filter((c) => c.set_number === setNumber);

      let cardType: string | null = null;
      if (matchingCards.some((c) => !c.card_type)) {
        cardType = await fetchCardType(setNumber);
      }

      for (const card of matchingCards) {
        const match = results.find((r) => r.rarity === card.rarity);
        if (match) {
          const updateData: Record<string, unknown> = {
            price: match.price,
            image_url: match.imageUrl,
            last_price_update: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (!card.card_type && cardType) {
            updateData.card_type = cardType;
          }
          await supabase.from("cards").update(updateData).eq("id", card.id);
          updated++;
        }
      }

      // Rate limit between requests
      if (batch.indexOf(setNumber) < batch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`Failed to refresh prices for ${setNumber}:`, err);
    }
  }

  return Response.json({
    updated,
    done,
    nextOffset: offset + batchSize,
    total: allSetNumbers.length,
    processed: Math.min(offset + batchSize, allSetNumbers.length),
  });
}
