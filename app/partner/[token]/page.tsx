import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";
import { getPartnerDashboard } from "@/lib/referrals";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Partner dashboard",
  robots: { index: false, follow: false },
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default async function PartnerDashboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPartnerDashboard(token);

  if (!data) notFound();

  const { partner, summary, recentReferrals, commissions } = data;
  const shareLink = `/login/referral-${partner.referralCode}`;
  const suspended = partner.status === "suspended";
  const pending = partner.status === "pending";

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-8 text-[var(--ink)] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ink)] text-[var(--paper)]">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="label-text text-[var(--patina)]">Partner dashboard</p>
              <h1 className="display-type mt-0.5 text-2xl sm:text-3xl">{partner.name}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Your code</p>
            <p className="font-mono text-lg font-bold tracking-wide text-[var(--brass)]">{partner.referralCode}</p>
          </div>
        </header>

        {pending || suspended ? (
          <p
            className="mt-6 rounded-xl border border-[var(--oxblood)]/25 bg-[var(--oxblood)]/5 px-4 py-3 text-sm font-semibold text-[var(--oxblood)]"
            role="status"
          >
            {pending
              ? "Your partner account is awaiting activation. Your referral link goes live once it is approved."
              : "Your partner account is currently suspended. Contact support if you believe this is a mistake."}
          </p>
        ) : null}

        <section className="mt-8 rounded-2xl border border-[var(--line)] bg-white/40 p-5" aria-label="Your referral link">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Share this link to earn</p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-[var(--patina)] sm:text-base">
            {process.env.NEXT_PUBLIC_SITE_URL || "https://mun-ai-app.vercel.app"}
            {shareLink}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            You earn {partner.commissionRate}% of each paid plan purchased by someone who signs up through your link.
            Commissions are marked here once a payment is verified, and settled by the MUN Prep team.
          </p>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your totals">
          <Stat label="Link clicks" value={String(summary.clicks)} />
          <Stat label="People referred" value={String(summary.referrals)} />
          <Stat label="Purchases" value={String(summary.conversions)} />
          <Stat label="Earned (unpaid)" value={money.format(summary.unpaidTotal)} accent />
        </section>

        <section className="mt-10" aria-labelledby="commission-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-text text-[var(--brass)]">Paid on verified purchases</p>
              <h2 id="commission-heading" className="display-type mt-1 text-2xl">Your commissions</h2>
            </div>
            <p className="text-sm font-semibold text-[var(--muted)]">
              {summary.unpaidCount} unpaid · {money.format(summary.unpaidTotal)} due · {money.format(summary.paidTotal)} paid
            </p>
          </div>

          {commissions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-white/30 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--ink)]">No commissions yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                Share your link above. When someone signs up through it and buys a plan, the verified commission will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/40">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-black/[0.03] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Purchase</th>
                    <th className="px-4 py-3">Commission</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3 text-[var(--muted)]">{formatDate(commission.created_at)}</td>
                      <td className="px-4 py-3 font-semibold">{commission.planLabel}</td>
                      <td className="px-4 py-3">{money.format(commission.paymentAmount)}</td>
                      <td className="px-4 py-3 font-bold">{money.format(commission.commissionAmount)}</td>
                      <td className="px-4 py-3">
                        {commission.status === "paid" ? (
                          <span className="rounded-full bg-[var(--patina)]/10 px-2.5 py-1 text-xs font-bold text-[var(--patina)]">
                            Paid · {formatDate(commission.paid_at)}
                          </span>
                        ) : commission.status === "cancelled" ? (
                          <span className="text-xs font-semibold text-[var(--muted)]">Cancelled</span>
                        ) : (
                          <span className="rounded-full bg-[var(--brass)]/15 px-2.5 py-1 text-xs font-bold text-[var(--brass)]">
                            Unpaid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {recentReferrals.length > 0 ? (
          <section className="mt-10" aria-labelledby="referrals-heading">
            <div>
              <p className="label-text text-[var(--patina)]">Who came through your link</p>
              <h2 id="referrals-heading" className="display-type mt-1 text-2xl">Recent signups</h2>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white/40">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-black/[0.03] text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Signed up</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReferrals.slice(0, 20).map((referral) => (
                    <tr key={referral.id} className="border-t border-[var(--line)]">
                      <td className="px-4 py-3 text-[var(--muted)]">{formatDate(referral.created_at)}</td>
                      <td className="px-4 py-3">
                        {referral.status === "converted" ? (
                          <span className="text-sm font-semibold text-[var(--patina)]">Purchased</span>
                        ) : referral.status === "cancelled" ? (
                          <span className="text-sm text-[var(--muted)]">Cancelled</span>
                        ) : (
                          <span className="text-sm font-semibold text-[var(--muted)]">Registered</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <footer className="mt-12 border-t border-[var(--line)] py-6 text-center">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Keep this dashboard link private — anyone with it can see these numbers.
            <br />
            <Link href="/" className="font-semibold text-[var(--ink)] underline decoration-[var(--brass)] underline-offset-4">
              MUN Prep
            </Link>{" "}
            · questions? Write to support with your partner name.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-black sm:text-3xl ${accent ? "text-[var(--brass)]" : "text-[var(--ink)]"}`}>{value}</p>
    </div>
  );
}
