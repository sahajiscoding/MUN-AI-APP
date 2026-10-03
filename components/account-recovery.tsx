"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/client";

/** Forgot-password form requesting a reset link for the given email. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Submits the recovery email to the reset-request API. */
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email }),
    });
    if (!response.ok) setError("We could not start password recovery. Check the email and try again.");
    else setMessage("If an account exists for that email, a reset link has been sent.");
    setBusy(false);
  }
  return <form onSubmit={submit} className="surface rounded-xl p-6 sm:p-8"><label className="block text-sm font-semibold">Email<input className="input-field mt-2" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); }} required /></label>{message ? <p className="mt-4 rounded-xl border border-[var(--patina)]/30 bg-[var(--patina)]/5 px-3 py-3 text-sm" role="status">{message}</p> : null}{error ? <p className="mt-4 rounded-xl border border-red-900/20 bg-red-900/5 px-3 py-3 text-sm text-red-900" role="alert">{error}</p> : null}<button className="button-primary mt-5 w-full px-4 font-semibold" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button><Link href="/login" className="mt-5 block text-center text-sm font-semibold underline underline-offset-4">Back to sign in</Link></form>;
}

/** Reset-password form setting a new password from a valid session. */
export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Submits the new password using the recovery session token. */
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("This reset link may have expired. Request a new one and try again.");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    if (!response.ok) setError("This reset link may have expired. Request a new one and try again.");
    else {
      await getSupabase().auth.signOut();
      setMessage("Your password has been updated. You can now sign in with it.");
    }
    setBusy(false);
  }
  return <form onSubmit={submit} className="surface rounded-xl p-6 sm:p-8"><label className="block text-sm font-semibold">New password<input className="input-field mt-2" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => { setPassword(event.target.value); }} required /></label>{message ? <p className="mt-4 rounded-xl border border-[var(--patina)]/30 bg-[var(--patina)]/5 px-3 py-3 text-sm" role="status">{message} <Link className="font-bold underline" href="/login">Sign in</Link></p> : null}{error ? <p className="mt-4 rounded-xl border border-red-900/20 bg-red-900/5 px-3 py-3 text-sm text-red-900" role="alert">{error}</p> : null}<button className="button-primary mt-5 w-full px-4 font-semibold" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form>;
}
