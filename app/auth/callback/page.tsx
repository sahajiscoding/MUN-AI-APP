"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.exchangeCodeForSession(window.location.search).then(() => {
      router.replace("/dashboard");
    });
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="surface flex items-center gap-3 rounded-panel px-5 py-4 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Completing sign-in…
      </div>
    </main>
  );
}
