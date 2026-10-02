"use client";

import {
  CheckCircle2,
  Clock3,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useSearchParams,
  useRouter,
} from "next/navigation";

import { ProtectedAppShell } from "@/components/protected-app-shell";
import { useAuth } from "@/components/auth-provider";
import { readJsonResponse } from "@/lib/http";

type PaymentStatus =
  | "checking"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "error";

type PaymentResponse = {
  ok?: boolean;
  status?: string;
  reason?: string;
  orderRef?: string;
  planId?: string;
  expiresAt?: string | null;
  error?: string;
};

export default function CheckoutSuccessPage() {
  const searchParams =
    useSearchParams();

  const router =
    useRouter();
  const { getIdToken } = useAuth();

  const orderRef =
    searchParams.get(
      "orderRef"
    );

  const [
    paymentStatus,
    setPaymentStatus,
  ] =
    useState<PaymentStatus>(
      "checking"
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const attemptsRef = useRef(0);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  useEffect(() => {
    if (!orderRef) {
      setPaymentStatus("error");
      setErrorMessage("We could not identify this payment. Please contact support if you were charged.");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const MAX_ATTEMPTS = 40;
    attemptsRef.current = 0;
    setPollTimedOut(false);

    const checkPayment = async () => {
      if (cancelled) return;

      try {
        const token = await getIdToken();
        const response = await fetch(
          `/api/payments/status?orderRef=${encodeURIComponent(orderRef)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = (await readJsonResponse<PaymentResponse & { error?: string }>(response)) ?? {};

        if (cancelled) return;

        if (response.status === 404) {
          setPaymentStatus("error");
          setErrorMessage("We could not find this payment. If you were charged, please contact support.");
          return;
        }

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Unable to check payment status.");
        }

        if (data.status === "paid") {
          setPaymentStatus("paid");
          return;
        }
        if (data.status === "failed") {
          setPaymentStatus("failed");
          return;
        }
        if (data.status === "expired") {
          setPaymentStatus("expired");
          return;
        }

        setPaymentStatus("pending");
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setPollTimedOut(true);
          return;
        }

        const delay = Math.min(3000 * 1.5 ** (attemptsRef.current - 1), 15000);
        timer = setTimeout(checkPayment, delay);
      } catch (error) {
        if (cancelled) return;
        console.error("Payment status check failed:", error instanceof Error ? error.message : "unknown error");
        setPaymentStatus("error");
        setErrorMessage("We could not check the payment status right now. Please try again.");
      }
    };

    void checkPayment();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [getIdToken, orderRef]);

  // --------------------------------------------------
  // SUCCESS
  // --------------------------------------------------

  if (
    paymentStatus ===
    "paid"
  ) {
    return (
      <ProtectedAppShell>
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--ink)]/5 p-4 text-sm leading-6 text-[var(--ink)]">
            <p className="font-semibold">Statement descriptor</p>
            <p className="mt-1">
              The charge on your card, netbanking or UPI statement appears as{" "}
              <strong>&quot;UroPay/UroPai&quot;</strong> — not this business name — because every payment is processed through UroPay&apos;s system.
            </p>
          </div>
        </div>
        <section className="surface mx-auto max-w-2xl rounded-panel p-6 text-center sm:p-8">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-[var(--patina)]"
            aria-hidden="true"
          />

          <h1 className="display-type mt-5 text-4xl">
            Access unlocked.
          </h1>

          <p className="mt-4 leading-7 text-[var(--muted)]">
            Your payment has been
            confirmed and Premium
            access is now active.
          </p>

          <Link
            className="button-primary mt-7 inline-flex items-center justify-center px-5 font-semibold"
            href="/dashboard"
          >
            Return to dashboard
          </Link>
        </section>
      </ProtectedAppShell>
    );
  }

  // --------------------------------------------------
  // FAILED
  // --------------------------------------------------

  if (
    paymentStatus ===
    "failed"
  ) {
    return (
      <ProtectedAppShell>
        <section className="surface mx-auto max-w-2xl rounded-panel p-6 text-center sm:p-8">
          <XCircle
            className="mx-auto h-12 w-12 text-red-600"
            aria-hidden="true"
          />

          <h1 className="display-type mt-5 text-4xl sm:text-5xl">
            Payment failed
          </h1>

          <p className="mt-4 leading-7 text-[var(--muted)]">
            We could not confirm
            this payment, so Premium
            access has not been
            unlocked.
          </p>

          <div className="mt-5 rounded-lg border border-[var(--line)] p-4 text-sm leading-6 text-[var(--muted)]">
            If your bank account
            was debited despite the
            payment failing, the
            amount will be reversed
            or refunded according
            to UroPay and your
            bank&apos;s payment
            process.
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              className="button-primary inline-flex items-center justify-center px-5 font-semibold"
              href="/pricing"
            >
              Try again
            </Link>

            <Link
              className="button-secondary inline-flex items-center justify-center px-5 font-semibold"
              href="/dashboard"
            >
              Return to dashboard
            </Link>
          </div>
        </section>
      </ProtectedAppShell>
    );
  }

  // --------------------------------------------------
  // EXPIRED
  // --------------------------------------------------

  if (
    paymentStatus ===
    "expired"
  ) {
    return (
      <ProtectedAppShell>
        <section className="surface mx-auto max-w-2xl rounded-panel p-6 text-center sm:p-8">
          <Clock3
            className="mx-auto h-12 w-12 text-[var(--muted)]"
            aria-hidden="true"
          />

          <h1 className="display-type mt-5 text-4xl sm:text-5xl">
            Payment expired
          </h1>

          <p className="mt-4 leading-7 text-[var(--muted)]">
            This payment session
            expired before the
            payment could be
            confirmed.
          </p>

          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            If your bank account
            was debited, the amount
            will be handled according
            to UroPay and your
            bank&apos;s payment
            process.
          </p>

          <Link
            className="button-primary mt-7 inline-flex items-center justify-center px-5 font-semibold"
            href="/pricing"
          >
            Try again
          </Link>
        </section>
      </ProtectedAppShell>
    );
  }

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (
    paymentStatus ===
    "error"
  ) {
    return (
      <ProtectedAppShell>
        <section className="surface mx-auto max-w-2xl rounded-panel p-6 text-center sm:p-8">
          <XCircle
            className="mx-auto h-12 w-12 text-[var(--muted)]"
            aria-hidden="true"
          />

          <h1 className="display-type mt-5 text-4xl sm:text-5xl">
            We&apos;re checking
            your payment
          </h1>

          <p className="mt-4 leading-7 text-[var(--muted)]">
            {errorMessage ||
              "We could not confirm the payment status right now."}
          </p>

          <button
            type="button"
            className="button-primary mt-7 inline-flex items-center justify-center gap-2 px-5 font-semibold"
            onClick={() =>
              { router.refresh(); }
            }
          >
            <RefreshCw
              className="h-4 w-4"
              aria-hidden="true"
            />
            Check again
          </button>
        </section>
      </ProtectedAppShell>
    );
  }

  // --------------------------------------------------
  // PENDING / CHECKING
  // --------------------------------------------------

  return (
      <ProtectedAppShell>
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--ink)]/5 p-4 text-sm leading-6 text-[var(--ink)]">
            <p className="font-semibold">Statement descriptor</p>
            <p className="mt-1">
              The charge on your card, netbanking or UPI statement appears as{" "}
              <strong>&quot;UroPay/UroPai&quot;</strong> — not this business name — because every payment is processed through UroPay&apos;s system.
            </p>
          </div>
        </div>
        <section className="surface mx-auto max-w-2xl rounded-panel p-6 text-center sm:p-8">
        <Loader2
          className="mx-auto h-12 w-12 animate-spin text-[var(--patina)]"
          aria-hidden="true"
        />

        <h1 className="display-type mt-5 text-4xl sm:text-5xl">
          Payment in progress
        </h1>

        <p className="mt-4 leading-7 text-[var(--muted)]">
          We are waiting for
          UroPay to confirm your
          payment.
        </p>

        <div className="mt-6 rounded-lg border border-[var(--line)] p-5 text-left">
          <p className="font-semibold">
            Please don&apos;t pay again.
          </p>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Your payment may take a
            little while to be
            confirmed. This page
            checks the payment status
            automatically.
          </p>
        </div>

        <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
          If the payment ultimately
          fails and your bank account
          was debited, the amount will
          be reversed or refunded
          according to UroPay and your
          bank&apos;s payment process.
        </p>

        <p className="mt-5 text-xs text-[var(--muted)]">
          Payment reference:
          <br />
          <span className="font-mono">
            {orderRef ||
              "Unavailable"}
          </span>
        </p>

        {pollTimedOut && (
          <div className="mt-6 rounded-lg border border-[var(--line)] p-4 text-sm leading-6 text-[var(--muted)]">
            Your payment is taking
            longer than usual to
            confirm. You can safely
            leave this page. We will
            continue processing the
            payment on the server.
          </div>
        )}
      </section>
        </div>
    </ProtectedAppShell>
  );
}
