import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchCard } from "@/lib/yuyutei";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  // Create a client with the user's token to verify auth
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

  // Get all unique set_number + rarity combos for this user's cards
  const { data: cards, error } = await supabase
    .from("cards")
    .select("id, set_number, rarity")
    .eq("user_id", user.id);

  if (error || !cards || cards.length === 0) {
    return Response.json({ updated: 0 });
  }

  // Group by set_number to minimize scraping requests
  const setNumbers = [...new Set(cards.map((c) => c.set_number))];

  let updated = 0;

  for (const setNumber of setNumbers) {
    try {
      const results = await searchCard(setNumber);

      // Update each card that matches
      const matchingCards = cards.filter((c) => c.set_number === setNumber);

      for (const card of matchingCards) {
        // Find the matching rarity result
        const match = results.find((r) => r.rarity === card.rarity);
        if (match) {
          await supabase
            .from("cards")
            .update({
              price: match.price,
              image_url: match.imageUrl,
              last_price_update: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", card.id);
          updated++;
        }
      }

      // Rate limit: wait 500ms between requests to Yuyutei
      if (setNumbers.indexOf(setNumber) < setNumbers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`Failed to refresh prices for ${setNumber}:`, err);
    }
  }

  return Response.json({ updated });
}
