"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export function PartnerApplyForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/partner/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whatsapp: whatsapp || undefined, note: note || undefined, website: website || undefined }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not submit your application. Please try again.");

      setName("");
      setEmail("");
      setWhatsapp("");
      setNote("");
      setMessage({ type: "success", text: "Application received. The MUN Prep team will review it and reach out at the email or WhatsApp you provided." });
    } catch (caught) {
      setMessage({ type: "error", text: caught instanceof Error ? caught.message : "Could not submit your application. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface rounded-xl p-6 sm:p-8">
      <p className="label-text text-[var(--patina)]">Apply to become a partner</p>
      <h2 className="display-type mt-3 text-3xl">Tell us about yourself</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Applications are reviewed by the team. Once approved, you receive your personal referral link and a private dashboard that tracks your clicks, conversions, and commissions.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label-text">Full name</span>
          <input className="input-field mt-2" value={name} onChange={(event) => { setName(event.target.value); }} autoComplete="name" required />
        </label>
        <label className="block">
          <span className="label-text">Email</span>
          <input className="input-field mt-2" type="email" value={email} onChange={(event) => { setEmail(event.target.value); }} autoComplete="email" required />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="label-text">WhatsApp number <span className="font-normal normal-case text-[var(--muted)]">(optional, for faster replies)</span></span>
        <input className="input-field mt-2" value={whatsapp} onChange={(event) => { setWhatsapp(event.target.value); }} autoComplete="tel" maxLength={40} />
      </label>

      <label className="mt-4 block">
        <span className="label-text">Where will you share referrals?</span>
        <textarea className="input-field mt-2 min-h-24" value={note} onChange={(event) => { setNote(event.target.value); }} maxLength={2000} placeholder="e.g. MUN club at my school, conference WhatsApp groups, debate pages" />
      </label>

      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        value={website}
        onChange={(event) => { setWebsite(event.target.value); }}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      {message ? (
        <p className={`mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-[var(--patina)]/30 bg-[var(--patina)]/5 text-[var(--patina)]" : "border-red-900/20 bg-red-900/5 text-red-900"}`} role="status">
          {message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          {message.text}
        </p>
      ) : null}

      <button type="submit" disabled={busy || !name.trim() || !email.trim()} className="button-primary mt-6 inline-flex items-center gap-2 px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {busy ? "Sending…" : "Apply to become a partner"}
      </button>
    </form>
  );
}
