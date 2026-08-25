import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  category: string;
};

const FEEDS: Record<string, string> = {
  national:
    "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en",
  international:
    "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXigAQE?hl=en-US&gl=US&ceid=US:en",
  sports:
    "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRmdQZUhFU0FtVnVHZ0pWVXigAQE?hl=en-US&gl=US&ceid=US:en",
};

function parseRSS(xml: string, category: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const source = extractTag(block, "source") || extractTag(block, "dc:creator") || "Google News";
    const pubDate = extractTag(block, "pubDate") || "";

    if (title && link) {
      items.push({ title, link, source, pubDate, category });
    }
  }

  return items;
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, "s");
  const match = block.match(regex);
  return match?.[1]?.trim() ?? "";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as keyof typeof FEEDS | null;

    const categories = category && FEEDS[category] ? [category] : Object.keys(FEEDS);
    const allItems: NewsItem[] = [];

    const results = await Promise.allSettled(
      categories.map(async (cat) => {
        const res = await fetch(FEEDS[cat], {
          headers: { "User-Agent": "MUNPrepApp/1.0" },
          next: { revalidate: 900 },
        });
        if (!res.ok) throw new Error(`Feed ${cat} returned ${res.status}`);
        const xml = await res.text();
        return parseRSS(xml, cat);
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value);
      }
    }

    return NextResponse.json({ news: allItems });
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json({ news: [], error: "Failed to fetch news" }, { status: 500 });
  }
}
