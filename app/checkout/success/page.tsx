import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ProtectedAppShell } from "@/components/protected-app-shell";

export const metadata = {
  title: "Payment Successful"
};

export default function CheckoutSuccessPage() {
  return (
    <ProtectedAppShell>
      <section className="surface mx-auto max-w-2xl rounded-panel p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--patina)]" aria-hidden="true" />
        <h1 className="display-type mt-5 text-5xl">Access unlocked.</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          Your Razorpay payment was verified and the entitlement is tied to this Supabase account.
        </p>
        <Link className="button-primary mt-7 inline-flex items-center justify-center px-5 font-semibold" href="/dashboard">
          Return to dashboard
        </Link>
      </section>
    </ProtectedAppShell>
  );
}
