"use client";

import { Check, Crown, Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { formatPlanPrice, plans } from "@/lib/plans";

type EntitlementData = {
  status: "inactive" | "active" | "expired";
  planId?: string;
  expiresAt?: string;
};

type EntitlementResponse = {
  entitlement?: EntitlementData;
};

export function PricingClient() {
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementData | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [entitlementError, setEntitlementError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEntitlement() {
      if (!user) {
        if (!cancelled) {
          setEntitlement(null);
          setEntitlementLoading(false);
        }
        return;
      }

      setEntitlementLoading(true);
      setEntitlementError(false);

      try {
        const token = await getIdToken();
        const response = await fetch("/api/me/entitlement", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error("Could not verify access");
        }

        const json = (await response.json()) as EntitlementResponse;

        if (!cancelled) {
          setEntitlement(json.entitlement ?? null);
        }
      } catch {
        if (!cancelled) {
          setEntitlement(null);
          setEntitlementError(true);
        }
      } finally {
        if (!cancelled) {
          setEntitlementLoading(false);
        }
      }
    }

    loadEntitlement();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, user]);

  const hasActiveAccess = entitlement?.status === "active";
  const hasAdminAccess = hasActiveAccess && entitlement?.planId === "admin";
  const currentPlan = hasActiveAccess
    ? plans.find((plan) => plan.id === entitlement?.planId)
    : undefined;

  async function handleBuy(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create order");
      }

      if (!data.openUrl) {
        throw new Error("Checkout is unavailable right now. Please try again.");
      }

      window.location.assign(data.openUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {entitlementLoading ? (
        <div className="surface flex items-center gap-3 rounded-panel px-4 py-3 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking your current access
        </div>
      ) : hasActiveAccess ? (
        <div className="surface flex flex-col gap-3 rounded-panel px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-panel bg-[var(--ink)] text-[var(--paper)]">
              <Crown className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">
                {hasAdminAccess
                  ? "Admin access is active"
                  : currentPlan
                    ? `${currentPlan.name} is active`
                    : "Paid workspace is active"}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {hasAdminAccess
                  ? "All paid tools are included for this account."
                  : entitlement?.expiresAt
                    ? `Access expires ${new Date(entitlement.expiresAt).toLocaleDateString("en-IN")}. Buy another pass to extend your access.`
                    : "Your paid workspace is ready to use."}
              </p>
            </div>
          </div>
        </div>
      ) : entitlementError ? (
        <div className="surface rounded-panel px-4 py-3 text-sm text-[var(--muted)]">
          We could not verify your current access. Refresh the page before starting checkout.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const isCurrentPlan = hasActiveAccess && entitlement?.planId === plan.id;
          const disabled =
            loading !== null || entitlementLoading || entitlementError || isCurrentPlan || hasAdminAccess;

          return (
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
                disabled={disabled}
                className="button-primary mt-7 flex w-full items-center justify-center gap-2 px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === plan.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : entitlementLoading ? (
                  "Checking access..."
                ) : entitlementError ? (
                  "Access check unavailable"
                ) : hasAdminAccess ? (
                  "Included with admin access"
                ) : isCurrentPlan ? (
                  "Current plan"
                ) : hasActiveAccess ? (
                  "Extend access"
                ) : (
                  "Buy now"
                )}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
