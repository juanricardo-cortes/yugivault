export interface Env {
  ALLOWED_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow GET
    if (request.method !== "GET") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders }
      );
    }

    // Get the search query
    const searchWord = url.searchParams.get("q");
    if (!searchWord) {
      return Response.json(
        { error: "Missing query parameter 'q'" },
        { status: 400, headers: corsHeaders }
      );
    }

    const yuyuteiUrl = `https://yuyu-tei.jp/sell/ygo/s/search?search_word=${encodeURIComponent(searchWord)}`;

    try {
      const response = await fetch(yuyuteiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Referer: "https://yuyu-tei.jp/sell/ygo",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (!response.ok) {
        return Response.json(
          { error: `Yuyutei returned status ${response.status}` },
          { status: 502, headers: corsHeaders }
        );
      }

      const html = await response.text();

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    } catch (error) {
      return Response.json(
        { error: "Failed to fetch from Yuyutei" },
        { status: 502, headers: corsHeaders }
      );
    }
  },
};
