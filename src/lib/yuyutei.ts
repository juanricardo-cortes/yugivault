import * as cheerio from "cheerio";

export interface YuyuteiCard {
  setNumber: string;
  cardName: string;
  rarity: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  inStock: boolean;
}

export async function searchCard(setNumber: string): Promise<YuyuteiCard[]> {
  const proxyUrl = process.env.YUYUTEI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error("YUYUTEI_PROXY_URL environment variable is not set");
  }

  const url = `${proxyUrl}?q=${encodeURIComponent(setNumber)}`;

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Proxy returned status ${response.status}: ${body}`);
  }

  const html = await response.text();
  return parseCards(html);
}

function parseCards(html: string): YuyuteiCard[] {
  const $ = cheerio.load(html);
  const cards: YuyuteiCard[] = [];
  let currentRarity = "";

  // Track rarity from section headers
  $("h3").each((_, h3) => {
    const raritySpan = $(h3).find("span.text-white");
    if (raritySpan.length) {
      currentRarity = raritySpan.text().trim();
    }
  });

  // Parse each card product
  $(".card-product").each((_, el) => {
    const $card = $(el);

    // Set number
    const setNumber =
      $card
        .find("span.d-block.border.border-dark")
        .text()
        .trim() ||
      $card
        .find("span.border")
        .text()
        .trim();

    if (!setNumber) return;

    // Card name
    const cardName = $card.find("h4").text().trim();

    // Price - get the strong tag text, extract number
    const priceText = $card.find("strong").text().trim();
    const priceMatch = priceText.replace(/,/g, "").match(/(\d+)/);
    const price = priceMatch ? parseInt(priceMatch[1], 10) : 0;

    // Original price if on sale
    const origPriceText = $card.find("del").text().trim();
    const origMatch = origPriceText.replace(/,/g, "").match(/(\d+)/);
    const originalPrice = origMatch ? parseInt(origMatch[1], 10) : undefined;

    // Card image (skip the star icon, get the actual card image)
    const cardImg = $card.find("img.card");
    const imgSrc = cardImg.attr("src") || "";

    // Rarity from card image alt (e.g. "ROTD-JP001 PSE 魔道騎士ガイア")
    const imgAlt = cardImg.attr("alt") || "";
    const altParts = imgAlt.split(" ");
    const rarity =
      altParts.length >= 2 ? altParts[1] : currentRarity || "Unknown";

    // Stock status
    const isSoldOut = $card.hasClass("sold-out");
    const stockText = $card.find(".cart_sell_zaiko").text();
    const inStock = !isSoldOut && !stockText.includes("x");

    cards.push({
      setNumber,
      cardName,
      rarity,
      price,
      originalPrice,
      imageUrl: imgSrc,
      inStock,
    });
  });

  return cards;
}
