"use client";

import { Check, LockKeyhole } from "lucide-react";
import { formatPlanPrice, plans } from "@/lib/plans";

export function PricingClient() {
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
            className="button-primary mt-7 w-full px-4 font-semibold"
            type="button"
            disabled
          >
            Coming soon
          </button>
        </article>
      ))}
    </div>
  );
}
