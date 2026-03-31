import { NextRequest } from "next/server";
import { searchCard } from "@/lib/yuyutei";

// Deploy this function to Tokyo for best access to Yuyutei
export const runtime = "nodejs";
export const preferredRegion = "hnd1";

export async function GET(request: NextRequest) {
  const setNumber = request.nextUrl.searchParams.get("q");

  if (!setNumber) {
    return Response.json(
      { error: "Missing query parameter 'q' (set number)" },
      { status: 400 }
    );
  }

  // Validate format: full card number (ROTD-JP001, TT02-JPB21) or set prefix (ROTD)
  const pattern = /^[A-Z0-9]+(-[A-Z]{1,4}[A-Z0-9]*)?$/i;
  if (!pattern.test(setNumber.trim())) {
    return Response.json(
      { error: "Invalid format. Examples: ROTD-JP001 (single card) or ROTD (entire set)" },
      { status: 400 }
    );
  }

  try {
    const cards = await searchCard(setNumber.trim().toUpperCase());
    return Response.json({ cards });
  } catch (error) {
    console.error("Yuyutei scraping error:", error);
    return Response.json(
      { error: "Failed to fetch card prices from Yuyutei" },
      { status: 502 }
    );
  }
}
