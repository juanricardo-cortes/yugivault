import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const event = body?.data?.attributes?.type;
  if (event !== "checkout_session.payment.paid") {
    return Response.json({ received: true });
  }

  const checkoutData = body?.data?.attributes?.data;
  const metadata = checkoutData?.attributes?.metadata;

  if (!metadata?.user_id || !metadata?.plan) {
    console.error("Webhook missing metadata:", metadata);
    return Response.json({ error: "Missing metadata" }, { status: 400 });
  }

  const userId = metadata.user_id;
  const plan = metadata.plan as "monthly" | "yearly";
  const paymentId = checkoutData?.attributes?.payments?.[0]?.id || checkoutData?.id || null;

  const days = plan === "yearly" ? 365 : 30;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Use service role to write subscription (webhook has no user session)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Expire any existing active subscriptions
  await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: now.toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");

  // Create new subscription
  const { error } = await supabase.from("subscriptions").insert({
    user_id: userId,
    plan,
    status: "active",
    paymongo_payment_id: paymentId,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  if (error) {
    console.error("Failed to create subscription:", error);
    return Response.json(
      { error: "Failed to activate subscription" },
      { status: 500 }
    );
  }

  return Response.json({ received: true, activated: true });
}
