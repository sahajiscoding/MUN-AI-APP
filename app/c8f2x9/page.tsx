"use client";

import { Landmark, Loader2, Lock, Mail } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithEmail, signInWithGoogle, getIdToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If the browser is already signed in to a Supabase account, try to turn
  // that identity into an admin session immediately (works for Google-only
  // accounts, which have no password).
  //
  // Deliberately does NOT depend on the local `loading` state: flipping it
  // would tear down this effect mid-flight (cleanup sets `cancelled`), which
  // previously left the page frozen with both buttons stuck on spinners.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    async function promoteSession() {
      setLoading(true);
      setError("");
      try {
        const token = await getIdToken();
        const res = await fetch("/api/c8f2x9/login", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.ok) {
          router.push("/c8f2x9/k7m3");
          return;
        }
        setError(data.error || "This account is not approved for administrator access.");
      } catch {
        if (!cancelled) setError("Could not verify this account. Try signing in again.");
      } finally {
        // Always release the buttons so a rejected account can try another
        // sign-in instead of being stranded on a spinner.
        if (!cancelled) setLoading(false);
      }
    }

    void promoteSession();
    return () => {
      cancelled = true;
    };
  }, [authLoading, getIdToken, router, user]);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;

    setLoading(true);
    setError("");

    try {
      await signInWithEmail(email.trim(), password);
      // Release the loading guard so the effect above can promote the
      // session with the now-authenticated identity.
      setLoading(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(message || "Sign-in failed. Use an administrator account to continue.");
      setLoading(false);
    }
  }

  async function handleGoogleSubmit() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle("/c8f2x9");
      // If the browser returns without redirecting (e.g. popup blocked),
      // release the loading guard so the user can retry.
      setLoading(false);
    } catch {
      setError("Google sign-in could not be started. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--inverse-panel)] px-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--patina)] text-white mb-4">
            <Landmark className="h-7 w-7" />
          </div>
          <h1 className="display-type text-3xl text-[var(--panel-text)]">Panel</h1>
          <p className="text-sm text-white/50 mt-2">Sign in with an administrator account</p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <label htmlFor="admin-email" className="sr-only">Administrator email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => { setEmail(e.target.value); }}
              placeholder="Admin email"
              disabled={loading}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10 text-[var(--paper)] placeholder:text-white/40 text-sm focus:outline-none focus:border-[var(--brass)]/50 disabled:opacity-50"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <label htmlFor="admin-password" className="sr-only">Account password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              placeholder="Password"
              disabled={loading}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10 text-[var(--paper)] placeholder:text-white/40 text-sm focus:outline-none focus:border-[var(--brass)]/50 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full py-3 rounded-xl bg-[var(--brass)] text-[#171412] font-semibold text-sm hover:brightness-110 transition disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/15" />
          <span className="text-xs uppercase tracking-wider text-white/40">or</span>
          <div className="h-px flex-1 bg-white/15" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-white text-[#171412] font-semibold text-sm hover:bg-white/90 transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            "Continue with Google"
          )}
        </button>
      </div>
    </div>
  );
}
