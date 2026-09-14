"use client";

import { Landmark, Loader2, Lock, Mail, ShieldCheck, X } from "lucide-react";
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
  // that identity into an admin session immediately.
  //
  // If the account is an admin but MFA is not enrolled, the API returns
  // admin_mfa_required and this page opens the MFA setup popup. If MFA is
  // already enrolled, the same response opens the verification popup instead.
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
        const supa = getSupabase();
        const { data: factorsData, error: factorsError } = await supa.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        const verified = (factorsData?.all ?? []).find(
          (factor) => factor.status === "verified" && factor.factor_type === "totp"
        );

        if (verified) {
          const { data: challengeData, error: challengeError } = await supa.auth.mfa.challenge({
            factorId: verified.id,
          });
          if (challengeError || !challengeData) {
            throw challengeError || new Error("Could not start MFA verification.");
          }

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
        if (enrollError || !enrollData?.totp) {
          throw enrollError || new Error("Could not start MFA setup.");
        }

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
   * Submit the MFA code for either first-time enrollment or normal
   * administrator step-up verification.
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

        const { error } = await supa.auth.mfa.verify({
          factorId: mfaFactorId,
          challengeId: mfaChallengeId,
          code,
        });
        if (error) throw error;
      } else {
        // Enrollment: challenge the newly enrolled factor, then verify the
        // code to complete enrollment.
        const { data: challengeData, error: challengeError } = await supa.auth.mfa.challenge({
          factorId: mfaFactorId,
        });
        if (challengeError || !challengeData) {
          throw challengeError || new Error("Could not verify the code. Start again.");
        }

        const { error } = await supa.auth.mfa.verify({
          factorId: mfaFactorId,
          challengeId: challengeData.id,
          code,
        });
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
      // Best effort. Without an admin session the panel remains locked.
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || loading) return;

    setLoading(true);
    setError("");

    try {
      await signInWithEmail(email.trim(), password);
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
      setLoading(false);
    } catch {
      setError("Google sign-in could not be started. Try again.");
      setLoading(false);
    }
  }

  const showMfaPopup = mfaMode !== "none";
  const isEnrollment = mfaMode === "enroll";

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--inverse-panel)] px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin email"
              disabled={loading || showMfaPopup}
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading || showMfaPopup}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10 text-[var(--paper)] placeholder:text-white/40 text-sm focus:outline-none focus:border-[var(--brass)]/50 disabled:opacity-50"
            />
          </div>

          {error && !showMfaPopup && (
            <p className="text-sm text-red-400 text-center" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || showMfaPopup || !email.trim() || !password}
            className="w-full py-3 rounded-xl bg-[var(--brass)] text-[#171412] font-semibold text-sm hover:brightness-110 transition disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Sign in"}
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
          disabled={loading || showMfaPopup}
          className="w-full py-3 rounded-xl bg-white text-[#171412] font-semibold text-sm hover:bg-white/90 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Continue with Google"}
        </button>
      </div>

      {showMfaPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-mfa-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#211d1a] p-6 shadow-2xl">
            <button
              type="button"
              onClick={cancelMfa}
              disabled={mfaBusy}
              aria-label="Close MFA dialog"
              className="absolute right-4 top-4 rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white transition disabled:opacity-30"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center pr-6">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-[var(--brass)] mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <h2 id="admin-mfa-title" className="text-lg font-semibold text-[var(--paper)]">
                {isEnrollment ? "Secure your administrator account" : "Verify your administrator account"}
              </h2>

              <p className="text-sm text-white/55 mt-2 leading-relaxed">
                {isEnrollment
                  ? "Two-factor authentication is required for administrator access. Add this account to your authenticator app, then enter the code below."
                  : "Enter the current six-digit code from your authenticator app to continue to the administrator panel."}
              </p>
            </div>

            {isEnrollment && mfaSecret ? (
              <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                <p className="text-xs text-white/60">Manual setup key</p>
                <p className="text-sm font-mono break-all text-[var(--paper)] select-all">{mfaSecret}</p>
                {mfaUri ? (
                  <p className="text-[11px] font-mono break-all text-white/35 select-all">{mfaUri}</p>
                ) : null}
                <p className="text-[11px] text-white/40 pt-1">
                  Keep this setup key private. It is only for configuring your authenticator.
                </p>
              </div>
            ) : null}

            <form onSubmit={submitMfaCode} className="mt-5 space-y-4">
              <div>
                <label htmlFor="admin-mfa-code" className="sr-only">
                  Six-digit authentication code
                </label>
                <input
                  id="admin-mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  disabled={mfaBusy}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-[var(--paper)] placeholder:text-white/40 text-sm text-center tracking-[0.35em] focus:outline-none focus:border-[var(--brass)]/50 disabled:opacity-50"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 text-center" role="alert">{error}</p>
              )}

              <button
                type="submit"
                disabled={mfaBusy || mfaCode.length !== 6}
                className="w-full py-3 rounded-xl bg-[var(--brass)] text-[#171412] font-semibold text-sm hover:brightness-110 transition disabled:opacity-40"
              >
                {mfaBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : isEnrollment ? (
                  "Finish setup and sign in"
                ) : (
                  "Verify and sign in"
                )}
              </button>

              <button
                type="button"
                onClick={cancelMfa}
                disabled={mfaBusy}
                className="w-full py-2 text-xs text-white/45 hover:text-white/80 transition disabled:opacity-50"
              >
                Use a different account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
