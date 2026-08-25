"use client";

import { Globe, Newspaper, RefreshCw, Trophy, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  category: string;
};

const categoryConfig: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  national: { label: "National", icon: Zap, color: "text-[var(--oxblood)]" },
  international: { label: "World", icon: Globe, color: "text-[var(--patina)]" },
  sports: { label: "Sports", icon: Trophy, color: "text-[var(--brass)]" },
};

export function DiscoverPanel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  function fetchNews() {
    setLoading(true);
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => {
        setNews(data.news || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchNews();
  }, []);

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
          onClick={fetchNews}
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
              const config = categoryConfig[item.category] || categoryConfig.national;
              const Icon = config.icon;
              const timeAgo = getRelativeTime(item.pubDate);

              return (
                <a
                  key={`${item.category}-${i}`}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block surface rounded-xl p-4 hover:-translate-y-0.5 transition group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-5 group-hover:text-[var(--patina)] transition line-clamp-2">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-[var(--muted)]">
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
