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

    supabase.auth
      .exchangeCodeForSession(window.location.search)
      .then(() => {
        router.replace("/dashboard");
      })
      .catch((err) => {
        console.error("Auth callback error:", err);
        // Fallback: try to extract session from URL hash (implicit flow)
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            router.replace("/dashboard");
          } else {
            setError("Sign-in failed. Please try again.");
          }
        });
      });
  }, [router]);

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="surface flex flex-col items-center gap-4 rounded-panel px-8 py-8 text-center">
          <p className="text-sm text-red-900">{error}</p>
          <Link
            href="/login"
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
