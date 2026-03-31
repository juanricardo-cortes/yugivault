import { NextRequest } from "next/server";
import { fetchCardType } from "@/lib/ygoprodeck";

export async function GET(request: NextRequest) {
  const setNumber = request.nextUrl.searchParams.get("q");

  if (!setNumber) {
    return Response.json(
      { error: "Missing query parameter 'q'" },
      { status: 400 }
    );
  }

  const cardType = await fetchCardType(setNumber.trim().toUpperCase());

  return Response.json({ cardType });
}
