"use client";

import {
  Bookmark,
  Clock,
  Compass,
  ExternalLink,
  Globe,
  HelpCircle,
  Heart,
  RefreshCw,
  Search,
  Share2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { NewsItem } from "@/app/api/news/route";

const TABS = [
  { key: "all", label: "For you" },
  { key: "global", label: "Global" },
  { key: "saved", label: "Saved" },
  { key: "diplomacy", label: "Diplomacy" },
  { key: "conflict", label: "Conflict" },
  { key: "economics", label: "Economics" },
  { key: "elections", label: "Elections" },
];

const CATEGORY_META: Record<string, { color: string; label: string }> = {
  diplomacy: { color: "var(--patina)", label: "DIPLOMACY" },
  conflict: { color: "var(--oxblood)", label: "CONFLICT, SECURITY" },
  economics: { color: "var(--brass)", label: "POLITICS, ECONOMICS" },
  elections: { color: "#6b46c1", label: "ELECTIONS, DEMOCRACY" },
  global: { color: "var(--patina)", label: "GLOBAL AFFAIRS" },
  national: { color: "var(--oxblood)", label: "NATIONAL" },
  sports: { color: "var(--brass)", label: "SPORTS" },
};

const TOPICS_TO_FOLLOW = [
  { name: "Economy", abbr: "EC", color: "var(--patina)" },
  { name: "Security", abbr: "SE", color: "var(--oxblood)" },
  { name: "Diplomacy", abbr: "DR", color: "var(--brass)" },
];

export default function DiscoverPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());

  function fetchNews(category?: string) {
    setLoading(true);
    const url = category && category !== "all" && category !== "saved"
      ? `/api/news?category=${category}`
      : "/api/news";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setNews(data.news || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchNews(activeTab === "all" || activeTab === "saved" ? undefined : activeTab);
  }, [activeTab]);

  const filtered = searchQuery
    ? news.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeTab === "saved"
      ? news.filter((item) => saved.has(item.link))
      : news;

  const featured = filtered[0];
  const rest = filtered.slice(1);

  function toggleSave(link: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link);
      else next.add(link);
      return next;
    });
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
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  return (
    <div className="min-h-screen bg-[var(--ink)]">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[var(--ink)]">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo */}
            <div className="flex items-center gap-3">
              <Compass className="h-5 w-5 text-[var(--brass)]" />
              <span className="display-type text-lg text-[var(--paper)]">Discover</span>
            </div>

            {/* Center: Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-[var(--paper)] text-[var(--ink)]"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Right: Search */}
            <div className="flex items-center gap-3">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search the record"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-52 rounded-lg bg-white/10 border border-white/10 text-sm text-[var(--paper)] placeholder:text-white/40 focus:outline-none focus:border-[var(--brass)]/50"
                />
              </div>
              <button className="p-2 rounded-lg hover:bg-white/10 text-white/60 transition">
                <HelpCircle className="h-4 w-4" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/10 text-white/60 transition">
                <Users className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="flex md:hidden gap-1 pb-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  activeTab === tab.key
                    ? "bg-[var(--paper)] text-[var(--ink)]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex gap-6">
          {/* Main feed */}
          <div className="flex-1 min-w-0 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 text-white/40 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-white/40">
                <Compass className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">
                  {activeTab === "saved"
                    ? "No saved articles yet. Bookmark articles to read later."
                    : "No articles found."}
                </p>
              </div>
            ) : (
              <>
                {/* Featured article */}
                {featured && (
                  <FeaturedCard
                    item={featured}
                    isSaved={saved.has(featured.link)}
                    onToggleSave={() => toggleSave(featured.link)}
                    getRelativeTime={getRelativeTime}
                  />
                )}

                {/* Rest of articles */}
                <div className="space-y-4">
                  {rest.map((item, i) => (
                    <ArticleCard
                      key={`${item.category}-${i}`}
                      item={item}
                      isSaved={saved.has(item.link)}
                      onToggleSave={() => toggleSave(item.link)}
                      getRelativeTime={getRelativeTime}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="hidden lg:block w-80 shrink-0 space-y-5">
            {/* Indicators */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-[var(--brass)]" />
                <h3 className="text-sm font-bold text-[var(--paper)]">INDICATORS</h3>
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-bold text-[var(--paper)]">16</span>
                <span className="flex items-center gap-1 text-xs text-red-400 mb-1">
                  <TrendingUp className="h-3 w-3" />
                  +1
                </span>
              </div>
              <p className="text-xs text-white/50 mb-4">Global Tension Index · 7-day</p>
              {/* Mini sparkline */}
              <div className="flex items-end gap-1 h-10">
                {[8, 10, 9, 12, 11, 14, 13, 15, 14, 16].map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-[var(--brass)]/30"
                    style={{ height: `${(v / 20) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Who to Follow */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-sm font-bold text-[var(--paper)] mb-4">WHO TO FOLLOW</h3>
              <div className="space-y-3">
                {TOPICS_TO_FOLLOW.map((topic) => (
                  <div key={topic.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-[var(--paper)]"
                        style={{ background: topic.color }}
                      >
                        {topic.abbr}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--paper)]">{topic.name}</p>
                        <p className="text-xs text-white/40">TOPIC</p>
                      </div>
                    </div>
                    <button className="px-3 py-1 rounded-full border border-[var(--brass)] text-[var(--brass)] text-xs font-semibold hover:bg-[var(--brass)] hover:text-[var(--ink)] transition">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
              <button className="mt-4 text-sm text-[var(--brass)] hover:underline">
                Manage all follows
              </button>
            </div>

            {/* Footer */}
            <div className="text-xs text-white/30 px-1">
              <p>Model Diplomat · Discover</p>
              <p>The reading room&apos;s front page.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------- Featured Card ---------- */
function FeaturedCard({
  item,
  isSaved,
  onToggleSave,
  getRelativeTime,
}: {
  item: NewsItem;
  isSaved: boolean;
  onToggleSave: () => void;
  getRelativeTime: (d: string) => string;
}) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.global;

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition group"
    >
      <div className="flex flex-col md:flex-row">
        {/* Image placeholder */}
        <div className="md:w-3/5 h-64 md:h-auto bg-gradient-to-br from-white/5 to-white/10 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="h-16 w-16 text-white/10" />
          </div>
        </div>

        {/* Content */}
        <div className="md:w-2/5 p-6 flex flex-col justify-between">
          <div>
            <span
              className="inline-block text-xs font-bold tracking-wider mb-3"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
            <h2 className="display-type text-2xl font-bold text-[var(--paper)] leading-tight mb-3 group-hover:text-[var(--brass)] transition line-clamp-3">
              {item.title}
            </h2>
            {item.description && (
              <p className="text-sm text-white/50 line-clamp-3 mb-4">{item.description}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span>{item.source}</span>
              {item.pubDate && (
                <>
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  <span>{getRelativeTime(item.pubDate)}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onToggleSave();
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <Bookmark
                  className={`h-4 w-4 ${isSaved ? "fill-[var(--brass)] text-[var(--brass)]" : "text-white/40"}`}
                />
              </button>
              <button
                onClick={(e) => e.preventDefault()}
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <Share2 className="h-4 w-4 text-white/40" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

/* ---------- Article Card ---------- */
function ArticleCard({
  item,
  isSaved,
  onToggleSave,
  getRelativeTime,
}: {
  item: NewsItem;
  isSaved: boolean;
  onToggleSave: () => void;
  getRelativeTime: (d: string) => string;
}) {
  const meta = CATEGORY_META[item.category] || CATEGORY_META.global;

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition group"
    >
      {/* Text content */}
      <div className="flex-1 min-w-0">
        <span
          className="text-xs font-bold tracking-wider"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
        <h3 className="display-type text-lg font-bold text-[var(--paper)] leading-snug mt-1 mb-2 group-hover:text-[var(--brass)] transition line-clamp-2">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-sm text-white/40 line-clamp-2 mb-3">{item.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span>{item.source}</span>
          {item.pubDate && (
            <>
              <span>·</span>
              <span>{getRelativeTime(item.pubDate)}</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleSave();
              }}
              className="p-1 rounded hover:bg-white/10 transition"
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${isSaved ? "fill-[var(--brass)] text-[var(--brass)]" : "text-white/40"}`}
              />
            </button>
            <button
              onClick={(e) => e.preventDefault()}
              className="p-1 rounded hover:bg-white/10 transition"
            >
              <Share2 className="h-3.5 w-3.5 text-white/40" />
            </button>
          </div>
        </div>
      </div>

      {/* Thumbnail placeholder */}
      <div className="hidden sm:block w-28 h-28 shrink-0 rounded-lg bg-white/5 flex items-center justify-center">
        <ExternalLink className="h-5 w-5 text-white/15" />
      </div>
    </a>
  );
}
