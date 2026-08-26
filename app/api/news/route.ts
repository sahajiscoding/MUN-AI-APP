import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  category: string;
  description: string;
  imageUrl?: string;
};

const FEEDS: Record<string, { url: string; label: string }> = {
  diplomacy: {
    url: "https://news.google.com/rss/search?q=diplomacy+OR+diplomatic+OR+treaty+OR+negotiations&hl=en-US&gl=US&ceid=US:en",
    label: "Diplomacy",
  },
  conflict: {
    url: "https://news.google.com/rss/search?q=conflict+OR+war+OR+security+council+OR+ceasefire&hl=en-US&gl=US&ceid=US:en",
    label: "Conflict",
  },
  economics: {
    url: "https://news.google.com/rss/search?q=economics+OR+trade+OR+development+OR+IMF+OR+World+Bank&hl=en-US&gl=US&ceid=US:en",
    label: "Economics",
  },
  elections: {
    url: "https://news.google.com/rss/search?q=elections+OR+voting+OR+democracy+OR+political+reform&hl=en-US&gl=US&ceid=US:en",
    label: "Elections",
  },
  global: {
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXigAQE?hl=en-US&gl=US&ceid=US:en",
    label: "Global",
  },
};

function parseRSS(xml: string, category: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const source = extractTag(block, "source") || extractTag(block, "dc:creator") || "Google News";
    const pubDate = extractTag(block, "pubDate") || "";
    const description = extractTag(block, "description") || "";

    if (title && link) {
      items.push({
        title: cleanText(title),
        link,
        source,
        pubDate,
        category,
        description: cleanDescription(description),
      });
    }
  }

  return items;
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, "s");
  const match = block.match(regex);
  return match?.[1]?.trim() ?? "";
}

function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function cleanDescription(html: string): string {
  return cleanText(html).slice(0, 280);
}

function cleanText(value: string): string {
  return decodeHTMLEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const categories = category && FEEDS[category] ? [category] : Object.keys(FEEDS);
    const allItems: NewsItem[] = [];

    const results = await Promise.allSettled(
      categories.map(async (cat) => {
        const feed = FEEDS[cat];
        const res = await fetch(feed.url, {
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
