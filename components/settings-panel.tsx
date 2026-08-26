"use client";

import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function SettingsPanel() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      await logout();
      router.replace("/auth/signin");
    } catch {
      setError("We could not sign you out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="surface rounded-panel p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-panel bg-[var(--ink)] text-[var(--paper)]">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="label-text">Account</p>
            <h2 className="display-type mt-2 text-3xl">Delegate identity</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{user?.email || "Signed-in delegate"}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/profile" className="button-secondary inline-flex items-center justify-center px-4 font-semibold">
            Edit profile
          </Link>
          <Link href="/pricing" className="button-secondary inline-flex items-center justify-center px-4 font-semibold">
            View access
          </Link>
        </div>
      </section>

      <section className="surface rounded-panel p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-panel bg-[var(--patina)]/15 text-[var(--patina)]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="label-text">Session</p>
            <h2 className="display-type mt-2 text-3xl">Secure access</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Sign out from this browser when you are finished using your delegate desk.
            </p>
          </div>
        </div>
        {error ? <p className="mt-4 text-sm text-red-900" role="alert">{error}</p> : null}
        <button
          type="button"
          className="button-primary mt-6 inline-flex items-center justify-center gap-2 px-4 font-semibold"
          onClick={handleLogout}
          disabled={busy}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </section>
    </div>
  );
}
