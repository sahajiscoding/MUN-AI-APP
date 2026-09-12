"use client";

import { Check, LockKeyhole, X } from "lucide-react";
import Link from "next/link";
import { plans, formatPlanPrice } from "@/lib/plans";

type PaywallModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PaywallModal({ open, onClose }: PaywallModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative surface rounded-xl border border-[var(--line)] shadow-2xl w-full max-w-lg mx-4 p-5">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-black/5 transition text-[var(--muted)]"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] mb-4">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h2 className="display-type text-2xl">Unlock AI Tools</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Choose a plan to access AI-powered MUN preparation tools.
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl border border-[var(--line)] p-4 flex flex-col"
            >
              <p className="text-xs font-semibold text-[var(--brass)] uppercase tracking-wider">
                {plan.accessDays} days
              </p>
              <h3 className="display-type text-xl mt-1">{plan.name}</h3>
              <p className="text-xs text-[var(--muted)] mt-1">{plan.description}</p>

              <p className="text-2xl font-black mt-3">{formatPlanPrice(plan)}</p>

              <ul className="mt-3 space-y-1.5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs">
                    <Check className="h-3 w-3 mt-0.5 shrink-0 text-[var(--patina)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/pricing"
            className="button-primary w-full flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-xl"
            onClick={onClose}
          >
            View all plans & checkout
          </Link>
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-[var(--muted)] hover:text-[var(--ink)] transition py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
