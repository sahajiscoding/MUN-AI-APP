"use client";

import { Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

/** Public navigation bar with sign-in and get-started actions. */
export function PublicNav({ variant = "default" }: { variant?: "default" | "onDark" }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const onDark = variant === "onDark";

  /** Navigates to the dashboard or login page for sign-in. */
  function handleSignIn() {
    if (loading) return;
    router.push(user ? "/dashboard" : "/login");
  }

  /** Navigates to the dashboard or signup page to get started. */
  function handleGetStarted() {
    if (loading) return;
    router.push(user ? "/dashboard" : "/signup");
  }

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Public navigation">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-panel bg-[#f7f3ea] text-[#171412] shadow-lg">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className={`display-type text-2xl ${onDark ? "text-white" : "text-[var(--ink)]"}`}>MUN Prep</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          aria-busy={loading}
          className={
            onDark
              ? "rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60 sm:px-5"
              : "rounded-xl border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-black/5 disabled:cursor-wait disabled:opacity-60"
          }
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={handleGetStarted}
          disabled={loading}
          aria-busy={loading}
          className={
            onDark
              ? "rounded-xl bg-[#f7f3ea] px-4 py-2.5 text-sm font-semibold text-[#171412] shadow-lg transition hover:bg-white disabled:cursor-wait disabled:opacity-60 sm:px-5"
              : "rounded-xl bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-[var(--paper)] transition hover:bg-[var(--ink)]/80 disabled:cursor-wait disabled:opacity-60"
          }
        >
          Get started
        </button>
      </div>
    </nav>
  );
}
