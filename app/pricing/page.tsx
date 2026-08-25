import { EntitlementBanner } from "@/components/entitlement-banner";
import { PricingClient } from "@/components/pricing-client";
import { ProtectedAppShell } from "@/components/protected-app-shell";

export const metadata = {
  title: "Access"
};

export default function PricingPage() {
  return (
    <ProtectedAppShell>
      <div className="space-y-6">
        <header>
          <p className="label-text text-[var(--oxblood)]">One payment, one account</p>
          <h1 className="display-type mt-3 text-5xl">Unlock MUN Prep</h1>
          <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
            Razorpay checkout creates an order tied to your Supabase account. Access is granted
            only after server-side signature verification or a verified webhook.
          </p>
        </header>
        <EntitlementBanner />
        <PricingClient />
      </div>
    </ProtectedAppShell>
  );
}
