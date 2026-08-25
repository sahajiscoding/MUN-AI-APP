"use client";

import { Check, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { formatPlanPrice, plans } from "@/lib/plans";

export function PricingClient() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleBuy(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create order");
      }

      // Redirect to UROpay checkout
      window.location.href = data.openUrl;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(null);
    }
  }

  return (
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
            onClick={() => handleBuy(plan.id)}
            disabled={loading !== null}
            className="button-primary mt-7 w-full px-4 py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading === plan.id ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              "Buy now"
            )}
          </button>
        </article>
      ))}
    </div>
  );
}
