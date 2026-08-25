"use client";

import {
  BookOpen,
  FileText,
  Landmark,
  LogOut,
  MessageSquareQuote,
  PenLine,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Landmark },
  { href: "/profile", label: "Profile", icon: ShieldCheck },
  { href: "/pricing", label: "Access", icon: ReceiptText },
  { href: "/app/research", label: "Research", icon: BookOpen },
  { href: "/app/country-profile", label: "Country", icon: Target },
  { href: "/app/position-paper", label: "Paper", icon: FileText },
  { href: "/app/speech-builder", label: "Speech", icon: MessageSquareQuote },
  { href: "/app/poi-trainer", label: "POIs", icon: Sparkles },
  { href: "/app/resolution-builder", label: "Resolution", icon: PenLine },
  { href: "/app/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="surface fixed bottom-0 left-0 right-0 z-40 border-x-0 border-b-0 px-2 py-2 lg:sticky lg:top-0 lg:h-screen lg:border-y-0 lg:border-l-0 lg:px-4 lg:py-5">
        <div className="hidden lg:block">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-panel bg-[var(--ink)] text-[var(--paper)]">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="display-type block text-xl leading-none">MUN Prep</span>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Delegate Desk
              </span>
            </span>
          </Link>
        </div>

        <nav aria-label="Main navigation" className="mt-0 lg:mt-8">
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <li key={item.href} className="min-w-[4.7rem] lg:min-w-0">
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex min-h-12 flex-col items-center justify-center gap-1 rounded-panel px-2 text-xs font-semibold transition lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm",
                      active
                        ? "bg-[var(--ink)] text-[var(--paper-strong)]"
                        : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="absolute bottom-5 left-4 right-4 hidden lg:block">
          <div className="border-t border-[var(--line)] pt-4">
            <p className="truncate text-sm font-semibold">{user?.user_metadata?.full_name || "Delegate"}</p>
            <p className="truncate text-xs text-[var(--muted)]">{user?.email}</p>
            <button
              type="button"
              onClick={() => logout()}
              className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-panel border border-[var(--line)] text-sm font-semibold text-[var(--ink)] transition hover:bg-black/5"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10 lg:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}
