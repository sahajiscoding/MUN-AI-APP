import { NextResponse } from "next/server";

import { XMLParser } from "fast-xml-parser";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  category: string;
  description: string;
  imageUrl?: string;
  imageKind?: "article" | "publisher";
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

const rssParser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: "__cdata",
  trimValues: true,
  processEntities: false,
});

function asText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.__cdata === "string") return record.__cdata;
    if (typeof record["#text"] === "string") return record["#text"];
    if (typeof record["@_href"] === "string") return record["@_href"];
  }
  return "";
}

type NewsImage = {
  url: string;
  kind: "article" | "publisher";
};

function getHttpsUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function getSourceUrl(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return getHttpsUrl(record["@_url"] ?? record.url ?? record.href);
}

function extractImage(item: Record<string, unknown>): NewsImage | undefined {
  // Only Google-controlled favicon URLs are allowed. Publisher media URLs
  // from the feed are intentionally dropped so the browser never fetches
  // arbitrary third-party hosts (which could fingerprint or track readers).
  const sourceUrl = getSourceUrl(item.source);
  if (!sourceUrl) return undefined;

  try {
    const hostname = new URL(sourceUrl).hostname;
    return {
      url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`,
      kind: "publisher",
    };
  } catch {
    return undefined;
  }
}

function parseRSS(xml: string, category: string): NewsItem[] {
  const parsed = rssParser.parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const rawItems = channel?.item ?? (parsed.feed as Record<string, unknown> | undefined)?.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.slice(0, 8).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const title = cleanText(asText(item.title));
    const link = asText(item.link).trim();
    const source = cleanText(asText(item.source) || asText(item["dc:creator"]) || "Google News");
    const description = cleanDescription(asText(item.description) || asText(item.summary) || "", title, source);
    const image = extractImage(item);
    if (!title || !/^https?:\/\//i.test(link)) return [];
    return [{
      title,
      link,
      source,
      pubDate: asText(item.pubDate) || asText(item.published) || "",
      category,
      description,
      imageUrl: image?.url,
      imageKind: image?.kind,
    }];
  });
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

function newsResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=900, stale-while-revalidate=1800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// Upstream feed bodies are attacker-influenceable in size (compromised feed,
// compression bomb over the wire inflating in memory). Cap what we buffer.
const MAX_FEED_BYTES = 2_000_000;

async function readCappedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > MAX_FEED_BYTES) throw new Error("Feed body exceeds size cap.");
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`news:${ip}`, 30, 60_000))) {
    return newsResponse(
      { news: [], error: "Too many news requests. Please try again later." },
      429,
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedCategory = searchParams.get("category");

    if (requestedCategory && !FEEDS[requestedCategory]) {
      return newsResponse({ news: [], error: "Unknown news category." }, 400);
    }

    const categories = requestedCategory ? [requestedCategory] : Object.keys(FEEDS);
    const allItems: NewsItem[] = [];

    const results = await Promise.allSettled(
      categories.map(async (cat) => {
        const feed = FEEDS[cat];
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "MUNPrepApp/1.0" },
          next: { revalidate: 900 },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Feed ${cat} returned ${res.status}`);
        const xml = await readCappedText(res);
        return parseRSS(xml, cat);
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value);
      }
    }

    const failedFeeds = results.filter((result) => result.status === "rejected").length;
    return newsResponse({
      news: allItems,
      partial: failedFeeds > 0,
      message: allItems.length === 0 ? "News is temporarily unavailable. Please try again." : undefined,
    });
  } catch (error) {
    console.error("News fetch error:", error instanceof Error ? error.message : "unknown error");
    return newsResponse({ news: [], error: "Failed to fetch news" }, 500);
  }
}
