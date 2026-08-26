"use client";

import { Landmark, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth-provider";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (mode === "signup") {
        await signUpWithEmail(name, email, password);
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
      await signInWithGoogle();
      // redirect happens via OAuth flow
    } catch (caught) {
      setError(formatAuthError(caught));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[var(--ink)] text-[var(--paper)] lg:block">
        <div className="diplomatic-grid absolute inset-0 opacity-25" />
        <div className="briefing-map absolute right-[-9rem] top-12 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-panel bg-[var(--paper)] text-[var(--ink)]">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="display-type text-2xl">MUN Prep</span>
          </Link>

          <div className="max-w-2xl">
            <p className="label-text text-[var(--brass)]">Delegate command center</p>
            <h1 className="display-type mt-5 text-6xl leading-[0.96]">
              Research, draft, and debate with a sharper brief.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">
              One account, one paid entitlement, one workspace for position papers,
              speeches, POIs, and resolution strategy.
            </p>
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

      <main className="grid place-items-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="display-type text-3xl">MUN Prep</Link>
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

              {error ? (
                <p className="rounded-panel border border-red-900/20 bg-red-900/5 px-3 py-2 text-sm text-red-900">
                  {error}
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
                href={mode === "signup" ? "/auth/signin" : "/signup"}
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
