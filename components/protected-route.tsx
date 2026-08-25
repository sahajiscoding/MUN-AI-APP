"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="surface flex items-center gap-3 rounded-panel px-5 py-4 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Securing the briefing room
        </div>
      </main>
    );
  }

  return children;
}
