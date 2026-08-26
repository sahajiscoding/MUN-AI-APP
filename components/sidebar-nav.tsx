"use client";

import {
  BookMarked,
  BookOpen,
  MessageSquare,
  Newspaper,
  ReceiptText,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/app/discover", label: "Discover", icon: Newspaper, section: "discover" },
  { href: "/app/research", label: "Research", icon: MessageSquare, section: "workspace" },
  { href: "/app/courses", label: "Courses", icon: BookOpen, section: "learn" },
  { href: "/app/glossary", label: "Glossary", icon: BookMarked, section: "learn" },
  { href: "/profile", label: "Profile", icon: ShieldCheck, section: "account" },
  { href: "/pricing", label: "Pricing", icon: ReceiptText, section: "account" }
] as const;

function isItemActive(pathname: string, href: string) {
  if (href === "/app/courses") return pathname.startsWith("/app/courses");
  if (href === "/app/research") return pathname.startsWith("/app/research");
  return pathname === href;
}

export function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const sections = ["discover", "workspace", "learn", "account"] as const;

  return (
    <nav className="flex-1 overflow-y-auto p-2" aria-label="Workspace navigation">
      {sections.map((section) => {
        const items = navigationItems.filter((item) => item.section === section);
        if (items.length === 0) return null;

        return (
          <div key={section} className={cn(section !== "discover" && "mt-4")}>
            {!collapsed && section !== "discover" ? (
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {section === "workspace" ? "Workspace" : section === "learn" ? "Learn" : "Account"}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isItemActive(pathname, item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "text-[var(--muted)] hover:bg-black/5"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const mobileItems = navigationItems.filter((item) =>
    ["discover", "workspace", "learn", "account"].includes(item.section)
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--paper-strong)]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(23,20,18,0.1)] backdrop-blur-lg lg:hidden"
      aria-label="Mobile workspace navigation"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {mobileItems
          .filter((item) => item.href !== "/app/glossary")
          .map((item) => {
            const active = isItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.68rem] font-semibold transition",
                  active
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "text-[var(--muted)] hover:bg-black/5"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
