import type { ReactNode } from "react";
import { CheckCircle2, Share2, Trophy } from "lucide-react";
import { PublicPage } from "@/components/site-pages";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PartnerApplyForm } from "@/components/partner-apply-form";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata({
  title: "Become a partner",
  description:
    "Join MUN Prep as a referral partner: share your link with delegates and earn 16.72% of every paid plan they buy.",
  path: "/become-a-partner",
});

/** Public partner-recruitment page with the application form. */
export default function BecomePartnerPage() {
  return (
    <PublicPage>
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Become a partner", path: "/become-a-partner" }]} />
        <div className="mt-6 grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="label-text text-[var(--oxblood)]">Referral partners</p>
            <h1 className="display-type mt-3 text-4xl sm:text-5xl">Turn your MUN circle into income.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
              MUN Prep helps delegates research, draft, and debate with a sharper brief. Share your personal link with
              students, teachers, and conference organizers — and earn 16.72% of every paid plan they buy.
            </p>

            <div className="mt-8 space-y-4">
              <Step
                icon={<Share2 className="h-5 w-5" aria-hidden="true" />}
                title="Share your link"
                body="Once approved, you get a personal referral link. Post it in MUN clubs, conference groups, and conversations — it stays yours."
              />
              <Step
                icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
                title="Earn on verified purchases"
                body="When someone signs up through your link and buys the Weekly (₹199) or Monthly (₹299) pass, a commission is created automatically — up to ₹50 per buyer, and again on renewals."
              />
              <Step
                icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                title="Track everything privately"
                body="Your private dashboard shows link clicks, signups, purchases, and unpaid commissions. The team settles verified commissions after each payment."
              />
            </div>

            <p className="mt-10 max-w-xl rounded-xl border border-[var(--line)] bg-white/40 p-5 text-sm leading-6 text-[var(--muted)]">
              <strong className="text-[var(--ink)]">Good to know:</strong> referral partners are vetted — we approve
              people who can genuinely introduce MUN Prep to new delegates. Applications are reviewed by the team and
              partners receive their link only after approval.
            </p>
          </div>

          <div className="lg:sticky lg:top-8">
            <PartnerApplyForm />
          </div>
        </div>
      </section>
    </PublicPage>
  );
}

/** Renders one numbered referral benefit step with icon and copy. */
function Step({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-[var(--line)] bg-white/40 p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--patina)]/10 text-[var(--patina)]">{icon}</span>
      <div>
        <h2 className="font-bold text-[var(--ink)]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
      </div>
    </div>
  );
}
