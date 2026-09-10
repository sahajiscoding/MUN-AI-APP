"use client";

import { Landmark, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthFormProps = {
  mode: "login" | "signup";
  referralCode?: string;
};

export function AuthForm({ mode, referralCode: referralCodeProp }: AuthFormProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));
  const referralCode = referralCodeProp || searchParams.get("referral") || undefined;
  const callbackFailed = searchParams.get("error") === "oauth_callback_failed";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setConfirmationSent(false);

    try {
      await captureReferral(referralCode);

      if (mode === "signup") {
        const result = await signUpWithEmail(name, email, password);
        if (!result.sessionCreated) {
          setConfirmationSent(true);
          return;
        }
      } else {
        await signInWithEmail(email, password);
      }

      router.push(next);
    } catch (caught) {
      setError(formatAuthError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError("");

    try {
      await captureReferral(referralCode);
      await signInWithGoogle(next);
      // redirect happens via OAuth flow
    } catch (caught) {
      setError(formatAuthError(caught));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh min-w-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <section className="relative hidden min-w-0 overflow-hidden bg-[var(--inverse-panel)] text-[var(--panel-text)] lg:block">
        <div className="diplomatic-grid absolute inset-0 opacity-25" />
        <div className="relative grid min-h-dvh grid-rows-[auto_1fr_auto] p-8 lg:p-12">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-panel bg-[var(--paper)] text-[var(--ink)]">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="display-type text-2xl">MUN Prep</span>
            </Link>
            <ThemeToggle />
          </div>

          <div className="flex items-center py-16 lg:py-20">
            <div className="max-w-2xl">
              <p className="label-text text-[var(--brass)]">Delegate command center</p>
              <h1 className="display-type mt-5 text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
              Research, draft, and debate with a sharper brief.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">
                One account, one paid entitlement, one workspace for position papers,
                speeches, POIs, and resolution strategy.
              </p>
            </div>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-3 text-sm">
            {["Policy", "Speeches", "POIs"].map((item) => (
              <div key={item} className="rounded-panel border border-white/12 p-4">
                <span className="text-white/56">Briefing lane</span>
                <strong className="mt-2 block">{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="grid min-w-0 min-h-dvh place-items-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md min-w-0">
          <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
            <Link href="/" className="display-type text-3xl">MUN Prep</Link>
            <ThemeToggle />
          </div>

          <div className="surface rounded-panel p-6 sm:p-8">
            <p className="label-text">Secure access</p>
            <h2 className="display-type mt-3 text-4xl">
              {mode === "signup" ? "Create your delegate desk." : "Enter your delegate desk."}
            </h2>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="button-secondary mt-7 flex w-full items-center justify-center gap-3 px-4 font-semibold"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Sign in with Google
            </button>

            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--line)]" />
              or
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" ? (
                <label className="block">
                  <span className="label-text">Name</span>
                  <input
                    className="input-field mt-2"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="label-text">Email</span>
                <input
                  className="input-field mt-2"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="label-text">Password</span>
                <div className="relative mt-2">
                  <input
                    className="input-field pr-11"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={6}
                    required
                  />
                </div>
              </label>

              {mode === "login" ? <div className="-mt-2 text-right"><Link href="/auth/forgot-password" className="text-xs font-semibold text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)]">Forgot password?</Link></div> : null}

              {confirmationSent ? (
                <p className="rounded-panel border border-[var(--patina)]/30 bg-[var(--patina)]/10 px-3 py-3 text-sm text-[var(--ink)]" role="status" aria-live="polite">
                  Account created. Check your email to confirm your address, then return here to sign in.
                </p>
              ) : null}

              {(error || callbackFailed) ? (
                <p className="rounded-panel border border-red-900/20 bg-red-900/5 px-3 py-2 text-sm text-red-900" role="alert">
                  {error || "Google sign-in could not be completed. Please try again."}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="button-primary w-full px-4 font-semibold"
              >
                {busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--muted)]">
              {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
              <Link
                className="font-semibold text-[var(--ink)] underline decoration-[var(--brass)] underline-offset-4"
                href={withReferral(mode === "signup" ? "/auth/signin" : "/signup", referralCode)}
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

async function captureReferral(code?: string) {
  if (!code) return;

  const response = await fetch("/api/referrals/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error("Referral attribution could not be prepared. Please try again.");
  }
}

function withReferral(path: string, code?: string) {
  return code ? `${path}?referral=${encodeURIComponent(code)}` : path;
}

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }

  try {
    const target = new URL(value, window.location.origin);
    return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function formatAuthError(error: unknown) {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("invalid login credentials")) {
      return "Email or password is incorrect.";
    }
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return "That email already has an account.";
    }
    if (msg.includes("password")) {
      return error.message;
    }
  }

  return "Authentication failed. Please try again.";
}
