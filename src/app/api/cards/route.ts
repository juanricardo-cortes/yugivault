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

  // Validate set number format (e.g., ROTD-JP001)
  const setNumberPattern = /^[A-Z0-9]+-[A-Z]{2}\d{3}$/i;
  if (!setNumberPattern.test(setNumber.trim())) {
    return Response.json(
      { error: "Invalid set number format. Expected format: ROTD-JP001" },
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
