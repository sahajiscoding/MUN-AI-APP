"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { formatPlanPrice, plans } from "@/lib/plans";

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string | null;
    email?: string | null;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayCheckoutResponse) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export function PricingClient() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function startCheckout(planId: string) {
    setError("");

    if (!user) {
      router.push("/login?next=/pricing");
      return;
    }

    if (!window.Razorpay) {
      setError("Razorpay checkout is still loading. Try again in a moment.");
      return;
    }

    setBusyPlan(planId);

    try {
      const token = await getIdToken();
      const orderResponse = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ planId })
      });

      const order = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(order.error ?? "Could not create payment order.");
      }

      const checkout = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: "MUN Prep App",
        description: order.description,
        order_id: order.razorpayOrderId,
        prefill: {
          name: user.user_metadata?.full_name,
          email: user.email
        },
        notes: {
          uid: user.id,
          planId
        },
        theme: {
          color: "#171412"
        },
        handler: async (response) => {
          const verification = await fetch("/api/payments/verify", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              planId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })
          });

          if (verification.ok) {
            router.push("/checkout/success");
          } else {
            router.push("/checkout/failure");
          }
        }
      });

      checkout.open();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start checkout.");
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="surface rounded-panel p-5 sm:p-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="label-text">{plan.accessDays} days</p>
                <h2 className="display-type mt-3 text-4xl">{plan.name}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{plan.description}</p>
              </div>
              <LockKeyhole className="h-5 w-5 text-[var(--oxblood)]" aria-hidden="true" />
            </div>

            <p className="mt-7 text-4xl font-black">{formatPlanPrice(plan)}</p>

            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--patina)]" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              className="button-primary mt-7 w-full px-4 font-semibold"
              type="button"
              onClick={() => startCheckout(plan.id)}
              disabled={busyPlan === plan.id}
            >
              {busyPlan === plan.id ? "Opening checkout..." : "Unlock this account"}
            </button>
          </article>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-panel border border-red-900/20 bg-red-900/5 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
    </>
  );
}
