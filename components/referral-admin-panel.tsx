"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/referrals", { cache: "no-store" });
      const body = (await response.json()) as DashboardData & { error?: string };
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
      const body = (await response.json()) as { error?: string };
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
      const response = await fetch(`/api/admin/referrals/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not update partner.");
      setMessage(`${partner.name} is now ${status}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update partner.");
    } finally {
      setBusyId("");
    }
  }

  async function markPaid(commission: Commission) {
    setBusyId(commission.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/referrals/commissions/${commission.id}/pay`, { method: "POST" });
      const body = (await response.json()) as { error?: string };
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
                  <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
                  <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
                  <Field label="WhatsApp" value={form.whatsapp} onChange={(value) => setForm({ ...form, whatsapp: value })} />
                  <Field label="Referral code" value={form.referralCode} onChange={(value) => setForm({ ...form, referralCode: value.toUpperCase() })} placeholder="MUNRAHUL01" required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 font-normal"><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
                    <Field label="Commission rate %" type="number" value={form.commissionRate} onChange={(value) => setForm({ ...form, commissionRate: value })} min="0" max="100" step="0.01" required />
                  </div>
                  <label className="text-sm font-semibold">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 font-normal" /></label>
                  <button type="submit" disabled={saving} className="button-primary mt-2 px-4 py-2 text-sm font-semibold">{saving ? "Creating…" : "Create partner"}</button>
                </div>
              </form>

              <section>
                <h2 className="display-type text-2xl">Partners</h2>
                <div className="mt-4 overflow-x-auto rounded-panel border border-[var(--line)]">
                  <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-black/[0.03] text-xs uppercase tracking-wider text-[var(--muted)]"><tr><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Referrals</th><th className="px-4 py-3">Unpaid</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{data.partners.map((partner) => <tr key={partner.id} className="border-t border-[var(--line)]"><td className="px-4 py-3"><div className="font-semibold">{partner.name}</div><div className="text-xs text-[var(--muted)]">{partner.email}</div></td><td className="px-4 py-3 font-mono text-xs">{partner.referral_code}</td><td className="px-4 py-3 capitalize">{partner.status}</td><td className="px-4 py-3">{partner.successful_referrals}</td><td className="px-4 py-3">{money.format(partner.unpaid_commission)}</td><td className="px-4 py-3"><select aria-label={`Change status for ${partner.name}`} disabled={busyId === partner.id} value={partner.status} onChange={(event) => void changeStatus(partner, event.target.value as Partner["status"])} className="rounded border border-[var(--line)] bg-transparent px-2 py-1 text-xs"><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select></td></tr>)}</tbody></table>
                </div>
              </section>
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
function Field({ label, value, onChange, type = "text", placeholder, min, max, step, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; min?: string; max?: string; step?: string; required?: boolean }) { return <label className="text-sm font-semibold">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={min} max={max} step={step} required={required} className="mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 font-normal" /></label>; }
