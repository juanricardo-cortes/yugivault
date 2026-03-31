import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PLANS = {
  monthly: { name: "YugiVault Premium (Monthly)", amount: 9900, days: 30 },
  yearly: { name: "YugiVault Premium (Yearly)", amount: 99900, days: 365 },
} as const;

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

  const body = await request.json();
  const plan = body.plan as keyof typeof PLANS;

  if (!PLANS[plan]) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  const planInfo = PLANS[plan];
  const origin = request.nextUrl.origin;

  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY!;
    const encodedKey = Buffer.from(`${secretKey}:`).toString("base64");

    const res = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encodedKey}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: planInfo.name,
                amount: planInfo.amount,
                currency: "PHP",
                quantity: 1,
              },
            ],
            payment_method_types: ["gcash"],
            success_url: `${origin}/dashboard?payment=success`,
            cancel_url: `${origin}/pricing?payment=cancelled`,
            description: `${planInfo.name} subscription`,
            metadata: {
              user_id: user.id,
              plan,
            },
          },
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("PayMongo error:", data);
      return Response.json(
        { error: "Failed to create checkout session" },
        { status: 502 }
      );
    }

    return Response.json({
      checkoutUrl: data.data.attributes.checkout_url,
      sessionId: data.data.id,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
