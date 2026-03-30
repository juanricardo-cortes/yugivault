import { getExchangeRates } from "@/lib/currency";

export async function GET() {
  const rates = await getExchangeRates();
  return Response.json(rates);
}
