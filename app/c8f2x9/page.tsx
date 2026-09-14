"use client";

import { Landmark, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getSupabase } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

type MfaMode = "none" | "verify" | "enroll";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithEmail, signInWithGoogle, logout, getIdToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaMode, setMfaMode] = useState<MfaMode>("none");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUri, setMfaUri] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  // If the browser is already signed in to a Supabase account, try to turn
  // that identity into an admin session immediately (works for Google-only
  // accounts, which have no password).
  //
  // Deliberately does NOT depend on the local `loading` state: flipping it
  // would tear down this effect mid-flight (cleanup sets `cancelled`), which
  // previously left the page frozen with both buttons stuck on spinners.
  //
  // Administrator sessions additionally require a verified MFA factor
  // (server-enforced). A 403/admin_mfa_required here routes into the
  // enrollment or step-up verification flow below instead of erroring out.
  const promoteSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/c8f2x9/login", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push("/c8f2x9/k7m3");
        return true;
      }
      if (data.code === "admin_mfa_required") {
        // Decide between step-up verification (account already has a
        // verified TOTP factor) and first-time enrollment, then prepare it.
        const supa = getSupabase();
        const { data: factorsData, error: factorsError } = await supa.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        const verified = (factorsData?.all ?? []).find(
          (factor) => factor.status === "verified" && factor.factor_type === "totp"
        );

        if (verified) {
          const { data: challengeData, error: challengeError } = await supa.auth.mfa.challenge({ factorId: verified.id });
          if (challengeError || !challengeData) throw challengeError || new Error("Could not start verification.");
          setMfaFactorId(verified.id);
          setMfaChallengeId(challengeData.id);
          setMfaCode("");
          setMfaMode("verify");
          return false;
        }

        const { data: enrollData, error: enrollError } = await supa.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "MUN Prep Admin",
        });
        if (enrollError || !enrollData?.totp) throw enrollError || new Error("Could not start enrollment.");
        setMfaFactorId(enrollData.id);
        setMfaSecret(enrollData.totp.secret);
        setMfaUri(enrollData.totp.uri);
        setMfaCode("");
        setMfaMode("enroll");
        return false;
      }
      setError(data.error || "This account is not approved for administrator access.");
      return false;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify this account. Try signing in again.");
      return false;
    } finally {
      // Always release the buttons so a rejected account can try another
      // sign-in instead of being stranded on a spinner.
      setLoading(false);
    }
  }, [getIdToken, router]);

  useEffect(() => {
    if (authLoading || !user || mfaMode !== "none") return;
    let cancelled = false;

    void (async () => {
      if (cancelled) return;
      await promoteSession();
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, mfaMode, promoteSession, user]);

  /**
   * Submit the MFA code for either step-up verification or first-time
   * enrollment, then retry the admin session promotion.
   */
  async function submitMfaCode(e: FormEvent) {
    e.preventDefault();
    const code = mfaCode.trim();
    if (!code || !mfaFactorId || mfaBusy) return;

    setMfaBusy(true);
    setError("");
    try {
      const supa = getSupabase();
      if (mfaMode === "verify") {
        if (!mfaChallengeId) throw new Error("Verification session expired. Start again.");
        const { error } = await supa.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code });
        if (error) throw error;
      } else {
        // Enrollment: challenge the freshly-enrolled factor, then verify the
        // code against that challenge to complete enrollment.
        const { data: challengeData, error: challengeError } = await supa.auth.mfa.challenge({ factorId: mfaFactorId });
        if (challengeError || !challengeData) throw challengeError || new Error("Could not verify the code. Start again.");
        const { error } = await supa.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challengeData.id, code });
        if (error) throw error;
      }
      setMfaMode("none");
      setMfaCode("");
      setMfaSecret("");
      setMfaUri("");
      setMfaChallengeId("");
      await promoteSession();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code was not accepted. Try again.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function cancelMfa() {
    setMfaMode("none");
    setMfaCode("");
    setMfaSecret("");
    setMfaUri("");
    setMfaChallengeId("");
    setMfaFactorId("");
    setError("");
    try {
      await logout();
    } catch {
      // Best effort: the Supabase session is harmless without an admin
      // session, the panel simply stays locked.
    }
  }

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

        {mfaMode !== "none" ? (
          <form onSubmit={submitMfaCode} className="space-y-4">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-[var(--brass)] mb-3">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-[var(--paper)]">
                {mfaMode === "verify" ? "Enter your two-factor code" : "Set up two-factor authentication"}
              </p>
              <p className="text-xs text-white/50 mt-1">
                {mfaMode === "verify"
                  ? "Administrator access requires your authenticator code."
                  : "Administrator access requires two-factor authentication. Add this account to your authenticator app, then enter the code it shows."}
              </p>
            </div>

            {mfaMode === "enroll" && mfaSecret ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                <p className="text-xs text-white/60">Manual setup key (paste into your authenticator app):</p>
                <p className="text-xs font-mono break-all text-[var(--paper)] select-all">{mfaSecret}</p>
                {mfaUri ? (
                  <p className="text-[11px] font-mono break-all text-white/40 select-all">{mfaUri}</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label htmlFor="admin-mfa-code" className="sr-only">Six-digit authentication code</label>
              <input
                id="admin-mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => { setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 8)); }}
                placeholder="6-digit code"
                disabled={mfaBusy}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-[var(--paper)] placeholder:text-white/40 text-sm text-center tracking-[0.3em] focus:outline-none focus:border-[var(--brass)]/50 disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 text-center" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={mfaBusy || !mfaCode.trim()}
              className="w-full py-3 rounded-xl bg-[var(--brass)] text-[#171412] font-semibold text-sm hover:brightness-110 transition disabled:opacity-40"
            >
              {mfaBusy ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                mfaMode === "verify" ? "Verify and sign in" : "Confirm setup and sign in"
              )}
            </button>

            <button
              type="button"
              onClick={cancelMfa}
              disabled={mfaBusy}
              className="w-full py-2 text-xs text-white/50 hover:text-white/80 transition disabled:opacity-50"
            >
              Use a different account
            </button>
          </form>
        ) : (
        <>
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
        </>
        )}
      </div>
    </div>
  );
}
