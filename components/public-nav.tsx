"use client";

import { Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function PublicNav() {
  const router = useRouter();
  const { user, loading } = useAuth();

  function handleSignIn() {
    if (loading) return;
    router.push(user ? "/dashboard" : "/login");
  }

  function handleGetStarted() {
    if (loading) return;
    router.push(user ? "/dashboard" : "/signup");
  }

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Public navigation">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-panel bg-[var(--ink)] text-[var(--paper)]">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="display-type text-2xl">MUN Prep</span>
      </Link>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          aria-busy={loading}
          className="rounded-full border border-[var(--line)] px-5 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-black/5 disabled:cursor-wait disabled:opacity-60"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={handleGetStarted}
          disabled={loading}
          aria-busy={loading}
          className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-[var(--paper)] transition hover:bg-[var(--ink)]/80 disabled:cursor-wait disabled:opacity-60"
        >
          Get started
        </button>
      </div>
    </nav>
  );
}
