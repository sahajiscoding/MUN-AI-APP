"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabase();

    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      setError("The sign-in link is missing its authorization code. Please try again.");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) throw exchangeError;
      router.replace("/dashboard");
    }).catch((err) => {
      console.error("Auth callback error:", err instanceof Error ? err.message : "unknown error");
      setError("Sign-in could not be completed. Please return to sign in and try again.");
    });
  }, [router]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="surface flex flex-col items-center gap-4 rounded-panel px-8 py-8 text-center">
          <p className="text-sm text-red-900" role="alert">{error}</p>
          <Link
            href="/auth/signin"
            className="button-primary inline-flex items-center justify-center px-5 font-semibold"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="surface flex items-center gap-3 rounded-panel px-5 py-4 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Completing sign-in…
      </div>
    </main>
  );
}
