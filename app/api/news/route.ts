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

    const rawTitle = extractTag(block, "title");
    const link = extractTag(block, "link");
    const rawSource = extractTag(block, "source") || extractTag(block, "dc:creator") || "Google News";
    const pubDate = extractTag(block, "pubDate") || "";
    const rawDescription = extractTag(block, "description") || "";
    const normalizedTitle = cleanText(rawTitle);
    const normalizedSource = cleanText(rawSource);

    if (normalizedTitle && link) {
      items.push({
        title: normalizedTitle,
        link,
        source: normalizedSource,
        pubDate,
        category,
        description: cleanDescription(rawDescription, normalizedTitle, normalizedSource),
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
  let decoded = str;

  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;|&#x27;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCharCode(Number(decimal)));

    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function cleanDescription(html: string, title: string, source: string): string {
  let description = cleanText(html);
  const titleKey = normalizeForComparison(title);
  const sourceKey = normalizeForComparison(source);
  const descriptionKey = normalizeForComparison(description);

  if (!description || descriptionKey === titleKey) return "";

  if (descriptionKey.startsWith(titleKey)) {
    description = description.slice(title.length).replace(/^[\s|•·:;,–—-]+/, "").trim();
  }

  if (sourceKey && normalizeForComparison(description).endsWith(sourceKey)) {
    description = description.slice(0, -source.length).replace(/[\s|•·:;,–—-]+$/, "").trim();
  }

  if (!description || normalizeForComparison(description) === titleKey) return "";
  return description.slice(0, 280);
}

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
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
