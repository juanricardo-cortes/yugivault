import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  // Verify admin via bearer token
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
  } = await anonClient.auth.getUser();

  if (!user || user.email !== "cortes.ricardo1@gmail.com") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Use service role for cross-user queries
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const trialCutoff = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();

  const [
    usersResult,
    profileCount,
    cardStats,
    subscriptionStats,
    topCollections,
    stalePrices,
  ] = await Promise.all([
    // User stats from auth.admin
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),

    // Profile count
    supabase.from("profiles").select("*", { count: "exact", head: true }),

    // Card stats
    supabase.from("cards").select("price, quantity, last_price_update, user_id"),

    // Active subscriptions
    supabase
      .from("subscriptions")
      .select("plan")
      .eq("status", "active")
      .gte("current_period_end", now.toISOString()),

    // Top collections: get all cards grouped by user
    supabase
      .from("cards")
      .select("user_id, price, quantity"),

    // Stale prices (>7 days or never updated)
    supabase
      .from("cards")
      .select("*", { count: "exact", head: true })
      .or(`last_price_update.is.null,last_price_update.lt.${weekAgo}`),
  ]);

  // Process user stats
  const allUsers = usersResult.data?.users || [];
  const totalUsers = allUsers.length;
  const loggedInToday = allUsers.filter(
    (u) => u.last_sign_in_at && u.last_sign_in_at >= todayStart
  ).length;
  const newThisWeek = allUsers.filter(
    (u) => u.created_at && u.created_at >= weekAgo
  ).length;
  const newThisMonth = allUsers.filter(
    (u) => u.created_at && u.created_at >= monthAgo
  ).length;
  const trialUsers = allUsers.filter(
    (u) => u.created_at && u.created_at >= trialCutoff
  ).length;

  // Process card stats
  const allCards = cardStats.data || [];
  const totalCards = allCards.length;
  const totalQuantity = allCards.reduce((sum, c) => sum + (c.quantity || 0), 0);
  const totalValue = allCards.reduce(
    (sum, c) => sum + (c.price || 0) * (c.quantity || 0),
    0
  );
  const usersWithCards = new Set(allCards.map((c) => c.user_id)).size;
  const avgCollectionValue = usersWithCards > 0 ? totalValue / usersWithCards : 0;

  // Top 10 collections
  const collectionsByUser: Record<string, number> = {};
  for (const card of (topCollections.data || [])) {
    const uid = card.user_id;
    collectionsByUser[uid] = (collectionsByUser[uid] || 0) + (card.price || 0) * (card.quantity || 0);
  }
  const topCollectionsList = Object.entries(collectionsByUser)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  // Get profile info for top collections
  const topUserIds = topCollectionsList.map(([uid]) => uid);
  const { data: topProfiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", topUserIds);

  const profileMap = new Map(
    (topProfiles || []).map((p) => [p.id, p])
  );

  const topCollectionsWithNames = topCollectionsList.map(([uid, value]) => ({
    user_id: uid,
    username: profileMap.get(uid)?.username || null,
    display_name: profileMap.get(uid)?.display_name || null,
    total_value: value,
  }));

  // Subscription breakdown
  const monthlyCount = (subscriptionStats.data || []).filter(
    (s) => s.plan === "monthly"
  ).length;
  const yearlyCount = (subscriptionStats.data || []).filter(
    (s) => s.plan === "yearly"
  ).length;

  // Profiles setup
  const withProfiles = profileCount.count || 0;
  const withoutProfiles = totalUsers - withProfiles;

  // Trial users without subscription
  const subscribedUserIds = new Set(
    (subscriptionStats.data || []).map(() => null) // we don't have user_id here
  );

  return Response.json({
    users: {
      total: totalUsers,
      loggedInToday,
      newThisWeek,
      newThisMonth,
      withProfiles,
      withoutProfiles,
      trialUsers,
    },
    cards: {
      totalCards,
      totalQuantity,
      totalValue,
      usersWithCards,
      avgCollectionValue: Math.round(avgCollectionValue),
      stalePrices: stalePrices.count || 0,
    },
    subscriptions: {
      monthly: monthlyCount,
      yearly: yearlyCount,
      total: monthlyCount + yearlyCount,
    },
    topCollections: topCollectionsWithNames,
  });
}
