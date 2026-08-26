"use client";

import {
  Landmark,
  Loader2,
  LogOut,
  MessageSquare,
  PenLine,
  Plus,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { MobileNav, SidebarNav } from "@/components/sidebar-nav";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { cn } from "@/lib/utils";

type ChatHistoryItem = {
  id: string;
  tool: string;
  input_summary: {
    committee?: string;
    country?: string;
    agenda?: string;
  };
  created_at: string;
};

const toolIcons: Record<string, typeof MessageSquare> = {
  "mun-research": MessageSquare,
  research: MessageSquare,
  "country-profile": ShieldCheck,
  "position-paper": PenLine,
  speech: MessageSquare,
  poi: MessageSquare,
  resolution: PenLine
};

const SIDEBAR_COLLAPSED_KEY = "mun-prep-sidebar-collapsed";

const toolRoutes: Record<string, string> = {
  "mun-research": "/app/research",
  research: "/app/research",
  "country-profile": "/app/country-profile",
  "position-paper": "/app/position-paper",
  speech: "/app/speech-builder",
  poi: "/app/poi-trainer",
  resolution: "/app/resolution-builder",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, getIdToken } = useAuth();
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatError, setChatError] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (storedPreference === "true" || storedPreference === "false") {
      setCollapsed(storedPreference === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    let cancelled = false;

    async function loadChats() {
      if (!user) {
        if (!cancelled) {
          setChats([]);
          setChatError("");
          setLoadingChats(false);
        }
        return;
      }

      setLoadingChats(true);
      setChatError("");
      try {
        const token = await getIdToken();
        const response = await fetch("/api/chats?limit=50", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as { chats?: ChatHistoryItem[]; error?: string };

        if (!cancelled) {
          setChats(response.ok ? data.chats ?? [] : []);
          setChatError(response.ok ? "" : data.error || "Could not load your saved chats.");
        }
      } catch {
        if (!cancelled) {
          setChats([]);
          setChatError("Could not load your saved chats.");
        }
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    }

    void loadChats();

    const refreshChats = () => {
      void loadChats();
      window.setTimeout(() => void loadChats(), 700);
    };
    window.addEventListener("mun:chat-created", refreshChats);
    window.addEventListener("mun:chat-history-refresh", refreshChats);

    return () => {
      cancelled = true;
      window.removeEventListener("mun:chat-created", refreshChats);
      window.removeEventListener("mun:chat-history-refresh", refreshChats);
    };
  }, [getIdToken, user]);

  function getChatTitle(chat: ChatHistoryItem) {
    const summary = chat.input_summary;
    const agenda = summary?.agenda?.replace(/\s+/g, " ").trim();
    if (agenda) {
      const title = agenda.split("Tool focus:")[0]?.trim();
      if (title) return title.length > 56 ? `${title.slice(0, 56)}…` : title;
    }
    if (summary?.committee && summary?.country) {
      return `${summary.committee} / ${summary.country}`;
    }
    return chat.tool.replace(/-/g, " ");
  }

  function getChatHref(chat: ChatHistoryItem) {
    const route = toolRoutes[chat.tool] || "/app/research";
    return `${route}?chat=${encodeURIComponent(chat.id)}`;
  }

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--ink)] text-[var(--paper)]">
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="display-type text-lg">MUN Prep</span>
          </Link>
          <Link
            href="/profile"
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-black/5"
            aria-label="Open profile"
          >
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </Link>
        </header>

        <aside
          aria-label="Desktop workspace navigation"
          className={cn(
            "hidden shrink-0 border-r border-[var(--line)] bg-[var(--surface)] lg:flex lg:h-screen lg:flex-col lg:transition-[width] lg:duration-300",
            collapsed ? "lg:w-[68px]" : "lg:w-64"
          )}
        >
          <div className="border-b border-[var(--line)] p-3">
            <div
              className={cn(
                "flex",
                collapsed ? "justify-center" : "items-center justify-between gap-2"
              )}
            >
              <Link
                href="/dashboard"
                className={cn(
                  "flex min-w-0 items-center gap-3",
                  collapsed && "justify-center"
                )}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--ink)] text-[var(--paper)]">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </span>
                {!collapsed && <span className="display-type truncate text-lg">MUN Prep</span>}
              </Link>
              {!collapsed && (
                <SidebarToggle
                  collapsed={collapsed}
                  onToggle={() => setCollapsed((value) => !value)}
                />
              )}
            </div>

            {collapsed ? (
              <div className="mt-2 flex justify-center">
                <SidebarToggle
                  collapsed={collapsed}
                  onToggle={() => setCollapsed((value) => !value)}
                />
              </div>
            ) : null}

            <Link
              href="/app/research"
              className={cn(
                "mt-3 flex w-full items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold transition hover:bg-black/5",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? "New chat" : undefined}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span>New chat</span>}
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav collapsed={collapsed} />

            <div className="border-t border-[var(--line)] p-2">
              {!collapsed && (
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Recent chats
                </p>
              )}

              {loadingChats ? (
                <div
                  className={cn(
                    "flex items-center gap-2 px-2 py-3 text-xs text-[var(--muted)]",
                    collapsed && "justify-center"
                  )}
                >
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {!collapsed && <span>Loading chats...</span>}
                </div>
              ) : chatError ? (
                !collapsed && (
                  <div className="px-2 py-3">
                    <p className="text-xs leading-5 text-[var(--muted)]">{chatError}</p>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new Event("mun:chat-history-refresh"))}
                      className="mt-2 text-xs font-semibold text-[var(--patina)] hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                )
              ) : chats.length === 0 ? (
                !collapsed && (
                  <p className="px-2 py-3 text-xs text-[var(--muted)]">
                    No chats yet. Start a new one!
                  </p>
                )
              ) : (
                <nav className="space-y-0.5" aria-label="Recent chats">
                  {chats.map((chat) => {
                    const Icon = toolIcons[chat.tool] || MessageSquare;
                    return (
                      <Link
                        key={chat.id}
                        href={getChatHref(chat)}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("mun:open-chat", { detail: { id: chat.id } }));
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--muted)] transition hover:bg-black/5",
                          collapsed && "justify-center px-0"
                        )}
                        title={getChatTitle(chat)}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && (
                          <span className="truncate">{getChatTitle(chat)}</span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--line)] p-3">
            <div className={cn("flex items-center justify-between", collapsed && "justify-center")}>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user?.user_metadata?.full_name || "Delegate"}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">{user?.email}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => logout()}
                className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition hover:bg-black/5"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden pb-20 lg:pb-0">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
