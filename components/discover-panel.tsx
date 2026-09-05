"use client";

import { Globe, Landmark, Newspaper, RefreshCw, ShieldAlert, TrendingUp, Vote } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  category: string;
  imageUrl?: string;
  imageKind?: "article" | "publisher";
};

// These must match the categories served by /api/news.
const categoryConfig: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  diplomacy: { label: "Diplomacy", icon: Globe, color: "text-[var(--patina)]" },
  conflict: { label: "Conflict", icon: ShieldAlert, color: "text-[var(--oxblood)]" },
  economics: { label: "Economics", icon: TrendingUp, color: "text-[var(--brass)]" },
  elections: { label: "Elections", icon: Vote, color: "text-[var(--ink)]" },
  global: { label: "Global", icon: Landmark, color: "text-[var(--patina)]" },
};

export function DiscoverPanel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const fetchNews = useCallback((silent = false) => {
    if (!silent) setLoading(true);

    fetch("/api/news", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("News request failed");
        return res.json();
      })
      .then((data) => {
        setNews(Array.isArray(data.news) ? data.news : []);
      })
      .catch(() => {
        // Keep the current stories visible when a background refresh fails.
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchNews();
    const dailyRefresh = window.setInterval(() => fetchNews(true), 24 * 60 * 60 * 1000);

    return () => window.clearInterval(dailyRefresh);
  }, [fetchNews]);

  const filtered =
    activeCategory === "all"
      ? news
      : news.filter((item) => item.category === activeCategory);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-[var(--patina)]" />
          <h2 className="display-type text-xl">Discover</h2>
        </div>
        <button
          onClick={() => fetchNews()}
          className="p-2 rounded-lg hover:bg-black/5 transition text-[var(--muted)]"
          title="Refresh news"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 px-5 py-3 border-b border-[var(--line)]">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
            activeCategory === "all"
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "bg-black/5 text-[var(--muted)] hover:bg-black/10"
          }`}
        >
          All
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              activeCategory === key
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-black/5 text-[var(--muted)] hover:bg-black/10"
            }`}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--muted)]">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading news...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-[var(--muted)]">
            No news available right now.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, i) => {
              const config = categoryConfig[item.category] || categoryConfig.global;
              const Icon = config.icon;
              const timeAgo = getRelativeTime(item.pubDate);
              const itemKey = `${item.category}-${item.link || i}`;
              const showImage = Boolean(item.imageUrl) && !brokenImages[itemKey];

              return (
                <a
                  key={itemKey}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block surface overflow-hidden rounded-xl transition hover:-translate-y-0.5 group"
                >
                  <div className={`relative h-36 overflow-hidden bg-gradient-to-br from-[var(--ink)] via-[var(--patina)] to-[var(--oxblood)] ${item.imageKind === "publisher" ? "p-8" : ""}`}>
                    {showImage ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() => setBrokenImages((current) => ({ ...current, [itemKey]: true }))}
                        className={`h-full w-full ${item.imageKind === "publisher" ? "object-contain rounded-xl bg-white/90 p-6" : "object-cover"}`}
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-white/80">
                        <Icon className="h-12 w-12 opacity-80" aria-hidden="true" />
                      </div>
                    )}
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                      {config.label}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        <Icon className={`h-4 w-4 ${config.color}`} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-5 transition group-hover:text-[var(--patina)]">
                          {item.title}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                          <span>{item.source}</span>
                          {timeAgo && (
                            <>
                              <span>·</span>
                              <span>{timeAgo}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
