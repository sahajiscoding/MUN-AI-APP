"use client";

import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/http";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Row ids come from the admin API as UUIDs (each route enforces
// z.string().uuid()). Refuse anything else before it reaches a URL path so a
// malformed id can never escape its route segment.
function adminResourcePath(segment: string, id: string, suffix = ""): string {
  if (!UUID_PATTERN.test(id)) throw new Error("That record could not be updated.");
  return `/api/admin/referrals/${segment}/${id}${suffix}`;
}

type Partner = {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  status: "pending" | "active" | "suspended";
  commission_rate: number;
  successful_referrals: number;
  total_commission: number;
  unpaid_commission: number;
  paid_commission: number;
  referral_link: string | null;
};

type Referral = {
  id: string;
  partner_name: string;
  referral_code: string;
  customer_name: string;
  customer_email: string;
  status: "registered" | "converted" | "cancelled";
  converted_at: string | null;
  created_at: string;
};

type Commission = {
  id: string;
  partner_name: string;
  referral_code: string;
  customer_name: string;
  customer_email: string;
  plan_id: string;
  payment_amount: number;
  commission_amount: number;
  payment_status: string;
  status: "unpaid" | "paid" | "cancelled";
  paid_at: string | null;
  created_at: string;
};

type Application = {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  note: string | null;
  created_at: string;
};

type DashboardData = {
  summary: {
    total_partners: number;
    successful_referrals: number;
    unpaid_commission: number;
    paid_commission: number;
  };
  partners: Partner[];
  referrals: Referral[];
  commissions: Commission[];
};

const emptyForm = {
  name: "",
  email: "",
  whatsapp: "",
  referralCode: "",
  status: "pending" as const,
  commissionRate: "16.72",
  notes: "",
};

export function ReferralAdminPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [copiedPartnerId, setCopiedPartnerId] = useState<string | null>(null);
  const [copiedDashboardId, setCopiedDashboardId] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/referrals", { cache: "no-store" });
      const body = (await readJsonResponse<DashboardData & { error?: string }>(response)) ?? ({} as DashboardData & { error?: string });
      if (!response.ok) throw new Error(body.error || "Could not load referral data.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load referral data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadApplications();
  }, [load]);

  async function addPartner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/referrals/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, commissionRate: Number(form.commissionRate) }),
      });
      const body = (await readJsonResponse<{ error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(body.error || "Could not create partner.");
      setForm(emptyForm);
      setMessage("Partner created successfully.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create partner.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(partner: Partner, status: Partner["status"]) {
    setBusyId(partner.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(adminResourcePath("partners", partner.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await readJsonResponse<{ error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(body.error || "Could not update partner.");
      setMessage(`${partner.name} is now ${status}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update partner.");
    } finally {
      setBusyId("");
    }
  }

  async function copyReferralLink(partner: Partner) {
    if (!partner.referral_link) return;

    try {
      await navigator.clipboard.writeText(partner.referral_link);
      setCopiedPartnerId(partner.id);
      window.setTimeout(() => { setCopiedPartnerId((current) => current === partner.id ? null : current); }, 1800);
    } catch {
      setError("Could not copy the referral link. Please open the link and copy it manually.");
    }
  }

  async function copyDashboardLink(partner: Partner) {
    setBusyId(partner.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(adminResourcePath("partners", partner.id, "/dashboard-link"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await readJsonResponse<{ error?: string; link?: string }>(response)) ?? {};
      if (!response.ok || !body.link) throw new Error(body.error || "Could not prepare the dashboard link.");
      await navigator.clipboard.writeText(body.link);
      setCopiedDashboardId(partner.id);
      setMessage("Partner dashboard link copied. Send it privately — never post it publicly.");
      window.setTimeout(() => { setCopiedDashboardId((current) => current === partner.id ? null : current); }, 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not copy the dashboard link.");
    } finally {
      setBusyId("");
    }
  }

  async function loadApplications() {
    try {
      const response = await fetch("/api/admin/referrals/applications", { cache: "no-store" });
      const body = (await readJsonResponse<{ applications?: Application[]; error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(body.error || "Could not load applications.");
      setApplications(body.applications ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load applications.");
    }
  }

  function loadIntoForm(application: Application) {
    setForm({
      name: application.name,
      email: application.email,
      whatsapp: application.whatsapp ?? "",
      referralCode: "",
      status: "pending",
      commissionRate: "16.72",
      notes: application.note ? `From application: ${application.note}` : "From partner application",
    });
    setMessage(`Application from ${application.name} loaded into the form above — pick a referral code and create the partner.`);
  }

  async function dismissApplication(application: Application) {
    setBusyId(application.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(adminResourcePath("applications", application.id), { method: "DELETE" });
      const body = (await readJsonResponse<{ error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(body.error || "Could not dismiss the application.");
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setMessage(`Application from ${application.name} dismissed.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not dismiss the application.");
    } finally {
      setBusyId("");
    }
  }

  async function markPaid(commission: Commission) {
    setBusyId(commission.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(adminResourcePath("commissions", commission.id, "/pay"), { method: "POST" });
      const body = (await readJsonResponse<{ error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(body.error || "Could not mark commission as paid.");
      setMessage("Commission marked as paid. No automatic transfer was made.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark commission as paid.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-8 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div>
            <Link href="/c8f2x9/k7m3" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">← Admin dashboard</Link>
            <p className="label-text mt-5 text-[var(--oxblood)]">Partner operations</p>
            <h1 className="display-type mt-2 text-4xl">Referrals & commissions</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">Referral commissions are created only from verified successful payments and remain unpaid until you manually settle them.</p>
          </div>
          <button type="button" onClick={() => void load()} className="button-secondary px-4 py-2 text-sm font-semibold" disabled={loading}>Refresh data</button>
        </div>

        {(error || message) ? <p className={`mt-5 rounded-lg border px-4 py-3 text-sm ${error ? "border-[var(--oxblood)]/30 text-[var(--oxblood)]" : "border-[var(--patina)]/30 text-[var(--patina)]"}`} role="status">{error || message}</p> : null}

        {loading && !data ? <p className="py-10 text-sm text-[var(--muted)]" aria-live="polite">Loading referral data…</p> : null}
        {data ? (
          <>
            <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Referral summary">
              <Summary label="Total partners" value={String(data.summary.total_partners)} />
              <Summary label="Successful referrals" value={String(data.summary.successful_referrals)} />
              <Summary label="Unpaid commission" value={money.format(data.summary.unpaid_commission)} />
              <Summary label="Paid commission" value={money.format(data.summary.paid_commission)} />
            </section>

            <section className="mt-10 grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
              <form onSubmit={addPartner} className="surface rounded-panel p-5">
                <h2 className="display-type text-2xl">Add partner</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Create a partner only after reviewing the application. Active partners receive valid referral URLs.</p>
                <div className="mt-5 grid gap-3">
                  <Field label="Name" value={form.name} onChange={(value) => { setForm({ ...form, name: value }); }} required />
                  <Field label="Email" type="email" value={form.email} onChange={(value) => { setForm({ ...form, email: value }); }} required />
                  <Field label="WhatsApp" value={form.whatsapp} onChange={(value) => { setForm({ ...form, whatsapp: value }); }} />
                  <Field label="Referral code" value={form.referralCode} onChange={(value) => { setForm({ ...form, referralCode: value.toUpperCase() }); }} placeholder="MUNRAHUL01" required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold">Status<select value={form.status} onChange={(event) => { setForm({ ...form, status: event.target.value as typeof form.status }); }} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 font-normal"><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
                    <Field label="Commission rate %" type="number" value={form.commissionRate} onChange={(value) => { setForm({ ...form, commissionRate: value }); }} min="0" max="100" step="0.01" required />
                  </div>
                  <label className="text-sm font-semibold">Notes<textarea value={form.notes} onChange={(event) => { setForm({ ...form, notes: event.target.value }); }} rows={3} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 font-normal" /></label>
                  <button type="submit" disabled={saving} className="button-primary mt-2 px-4 py-2 text-sm font-semibold">{saving ? "Creating…" : "Create partner"}</button>
                </div>
              </form>

              <section>
                <h2 className="display-type text-2xl">Partners</h2>
                <div className="mt-4 overflow-x-auto rounded-panel border border-[var(--line)]">
                  <table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-black/[0.03] text-xs uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Referral link</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Referrals</th><th className="px-4 py-3">Unpaid</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{data.partners.map((partner) => <tr key={partner.id} className="border-t border-[var(--line)]"><td className="px-4 py-3"><div className="font-semibold">{partner.name}</div><div className="text-xs text-[var(--muted)]">{partner.email}</div></td><td className="px-4 py-3 font-mono text-xs">{partner.referral_code}</td><td className="max-w-[270px] px-4 py-3">{partner.referral_link ? <div className="flex items-center gap-2"><a href={partner.referral_link} target="_blank" rel="noreferrer" className="min-w-0 truncate text-xs font-semibold text-[var(--patina)] underline decoration-[var(--patina)]/30 underline-offset-2 hover:text-[var(--oxblood)]" title={partner.referral_link}>/{partner.referral_code}</a><button type="button" onClick={() => void copyReferralLink(partner)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-xs font-bold text-[var(--muted)] transition hover:border-[var(--patina)]/40 hover:text-[var(--patina)]" aria-label={`Copy referral link for ${partner.name}`} title="Copy referral link">{copiedPartnerId === partner.id ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}<span className="sr-only">{copiedPartnerId === partner.id ? "Copied" : "Copy"}</span></button></div> : <span className="text-xs text-[var(--muted)]">Available when active</span>}</td><td className="px-4 py-3 capitalize">{partner.status}</td><td className="px-4 py-3">{partner.successful_referrals}</td><td className="px-4 py-3">{money.format(partner.unpaid_commission)}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><select aria-label={`Change status for ${partner.name}`} disabled={busyId === partner.id} value={partner.status} onChange={(event) => void changeStatus(partner, event.target.value as Partner["status"])} className="rounded border border-[var(--line)] bg-transparent px-2 py-1 text-xs"><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select><button type="button" disabled={busyId === partner.id} onClick={() => void copyDashboardLink(partner)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-xs font-bold text-[var(--muted)] transition hover:border-[var(--patina)]/40 hover:text-[var(--patina)]" title="Copy this partner's private dashboard link" aria-label={`Copy private dashboard link for ${partner.name}`}>{busyId === partner.id ? "…" : copiedDashboardId === partner.id ? "Copied!" : "Dashboard"}</button></div></td></tr>)}</tbody></table>
                </div>
              </section>
            </section>

            <section className="mt-10" aria-labelledby="applications-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="label-text text-[var(--brass)]">Awaiting review</p>
                  <h2 id="applications-heading" className="display-type text-2xl">Partner applications</h2>
                </div>
                <button type="button" onClick={() => void loadApplications()} className="button-secondary px-3 py-1.5 text-xs font-semibold">Refresh</button>
              </div>
              {applications.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-white/30 px-4 py-6 text-center text-sm text-[var(--muted)]">No new applications. Submissions from the public Become a partner page appear here.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {applications.map((application) => (
                    <div key={application.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/40 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">{application.name} <span className="font-normal text-[var(--muted)]">· {new Date(application.created_at).toLocaleDateString("en-IN")}</span></p>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">{application.email}{application.whatsapp ? ` · WhatsApp: ${application.whatsapp}` : ""}</p>
                        {application.note ? <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{application.note}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" disabled={busyId === application.id} onClick={() => void loadIntoForm(application)} className="button-secondary px-3 py-1.5 text-xs font-semibold">Load into form</button>
                        <button type="button" disabled={busyId === application.id} onClick={() => void dismissApplication(application)} className="rounded-lg border border-[var(--oxblood)]/25 px-3 py-1.5 text-xs font-bold text-[var(--oxblood)] transition hover:bg-[var(--oxblood)]/5">Dismiss</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="display-type text-2xl">Successful referrals</h2>
              <div className="mt-4 overflow-x-auto rounded-panel border border-[var(--line)]"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-black/[0.03] text-xs uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Referral code</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Converted</th></tr></thead><tbody>{data.referrals.filter((referral) => referral.status === "converted").map((referral) => <tr key={referral.id} className="border-t border-[var(--line)]"><td className="px-4 py-3"><div className="font-semibold">{referral.customer_name}</div><div className="text-xs text-[var(--muted)]">{referral.customer_email}</div></td><td className="px-4 py-3">{referral.partner_name}</td><td className="px-4 py-3 font-mono text-xs">{referral.referral_code}</td><td className="px-4 py-3 capitalize">{referral.status}</td><td className="px-4 py-3 text-xs text-[var(--muted)]">{referral.converted_at ? new Date(referral.converted_at).toLocaleDateString("en-IN") : "—"}</td></tr>)}</tbody></table></div>
            </section>

            <section className="mt-10">
              <h2 className="display-type text-2xl">Commission ledger</h2>
              <div className="mt-4 overflow-x-auto rounded-panel border border-[var(--line)]"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-black/[0.03] text-xs uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{data.commissions.map((commission) => <tr key={commission.id} className="border-t border-[var(--line)]"><td className="px-4 py-3"><div className="font-semibold">{commission.customer_name}</div><div className="text-xs text-[var(--muted)]">{commission.customer_email}</div></td><td className="px-4 py-3"><div>{commission.partner_name}</div><div className="font-mono text-xs text-[var(--muted)]">{commission.referral_code}</div></td><td className="px-4 py-3">{commission.plan_id}</td><td className="px-4 py-3">{money.format(Number(commission.payment_amount))}</td><td className="px-4 py-3">{money.format(Number(commission.commission_amount))}</td><td className="px-4 py-3 capitalize">{commission.status}</td><td className="px-4 py-3">{commission.status === "unpaid" ? <button type="button" disabled={busyId === commission.id} onClick={() => void markPaid(commission)} className="button-secondary whitespace-nowrap px-3 py-1.5 text-xs font-semibold">{busyId === commission.id ? "Saving…" : "Mark as Paid"}</button> : <span className="text-xs text-[var(--muted)]">{commission.paid_at ? new Date(commission.paid_at).toLocaleDateString("en-IN") : "Settled"}</span>}</td></tr>)}</tbody></table></div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="surface rounded-panel p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="display-type mt-2 text-2xl">{value}</p></div>; }
function Field({ label, value, onChange, type = "text", placeholder, min, max, step, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; min?: string; max?: string; step?: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}<input type={type} value={value} onChange={(event) => { onChange(event.target.value); }} placeholder={placeholder} min={min} max={max} step={step} required={required} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 font-normal" /></label>; }
