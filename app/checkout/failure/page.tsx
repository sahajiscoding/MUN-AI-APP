import { XCircle } from "lucide-react";
import Link from "next/link";
import { ProtectedAppShell } from "@/components/protected-app-shell";

export const metadata = {
  title: "Payment Not Verified"
};

export default function CheckoutFailurePage() {
  return (
    <ProtectedAppShell>
      <section className="surface mx-auto max-w-2xl rounded-panel p-6 text-center sm:p-8">
        <XCircle className="mx-auto h-10 w-10 text-[var(--oxblood)]" aria-hidden="true" />
        <h1 className="display-type mt-5 text-5xl">Payment not verified.</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          The account was not unlocked because verification failed or was cancelled. If money was
          deducted, the payment provider can still reconcile the order.
        </p>
        <Link className="button-primary mt-7 inline-flex items-center justify-center px-5 font-semibold" href="/pricing">
          Try again
        </Link>
      </section>
    </ProtectedAppShell>
  );
}
