"use client";

import {
  Landmark,
  LogOut,
  Plus,
  Settings,
  ShieldCheck,
  MessageSquare,
  PenLine,
  ReceiptText,
  Loader2,
  Newspaper,
  BookOpen,
  BookMarked,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase/client";
import { DiscoverPanel } from "@/components/discover-panel";

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
  "country-profile": ShieldCheck,
  "position-paper": PenLine,
  speech: MessageSquare,
  poi: MessageSquare,
  resolution: PenLine,
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [showDiscover, setShowDiscover] = useState(false);

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabase();

    supabase
      .from("ai_generations")
      .select("id, tool, input_summary, created_at")
      .eq("uid", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setChats(data as ChatHistoryItem[]);
        setLoadingChats(false);
      });
  }, [user]);

  function getChatTitle(chat: ChatHistoryItem) {
    const summary = chat.input_summary;
    if (summary?.committee && summary?.country) {
      return `${summary.committee} / ${summary.country}`;
    }
    return chat.tool.replace(/-/g, " ");
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-[var(--line)] bg-[var(--surface)] flex flex-col h-screen sticky top-0">
        {/* Logo + New Chat */}
        <div className="p-3 border-b border-[var(--line)]">
          <Link href="/dashboard" className="flex items-center gap-3 mb-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--ink)] text-[var(--paper)]">
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="display-type text-lg">MUN Prep</span>
          </Link>
          <Link
            href="/app/research"
            className="flex items-center gap-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-black/5 transition"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Link>
        </div>

        {/* Discover toggle */}
        <div className="px-2 pt-2">
          <button
            onClick={() => setShowDiscover(!showDiscover)}
            className={cn(
              "flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm font-semibold transition",
              showDiscover
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:bg-black/5"
            )}
          >
            <Newspaper className="h-4 w-4" />
            Discover
          </button>
        </div>

        {/* Chat History or Discover Panel */}
        {showDiscover ? (
          <div className="flex-1 overflow-hidden">
            <DiscoverPanel />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Recent chats
            </p>

            {loadingChats ? (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-[var(--muted)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>
            ) : chats.length === 0 ? (
              <p className="px-2 py-3 text-xs text-[var(--muted)]">
                No chats yet. Start a new one!
              </p>
            ) : (
              <nav className="space-y-0.5">
                {chats.map((chat) => {
                  const Icon = toolIcons[chat.tool] || MessageSquare;
                  return (
                    <Link
                      key={chat.id}
                      href="/app/research"
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--muted)] hover:bg-black/5 transition truncate"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{getChatTitle(chat)}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        )}

        {/* Learn section */}
        <div className="px-2 pt-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Learn
          </p>
          <Link
            href="/app/courses"
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
              pathname.startsWith("/app/courses")
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:bg-black/5"
            )}
          >
            <BookOpen className="h-4 w-4" />
            Courses
          </Link>
          <Link
            href="/app/glossary"
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
              pathname === "/app/glossary"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:bg-black/5"
            )}
          >
            <BookMarked className="h-4 w-4" />
            Glossary
          </Link>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-[var(--line)] p-2 space-y-0.5">
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
              pathname === "/profile"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:bg-black/5"
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            Profile
          </Link>
          <Link
            href="/pricing"
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
              pathname === "/pricing"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:bg-black/5"
            )}
          >
            <ReceiptText className="h-4 w-4" />
            Pricing
          </Link>
          <Link
            href="/app/settings"
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
              pathname === "/app/settings"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:bg-black/5"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>

        {/* User info + logout */}
        <div className="border-t border-[var(--line)] p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {user?.user_metadata?.full_name || "Delegate"}
              </p>
              <p className="truncate text-xs text-[var(--muted)]">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="shrink-0 p-2 rounded-lg hover:bg-black/5 transition text-[var(--muted)]"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
