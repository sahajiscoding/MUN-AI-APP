"use client";

import { Check, Crown, Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { canonicalPlanId, formatPlanPrice, getPlan, plans } from "@/lib/plans";

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
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);
  const [referralMessage, setReferralMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);

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

  useEffect(() => {
    const queryCode = new URLSearchParams(window.location.search).get("referral");
    if (queryCode) setReferralCode(queryCode);
  }, []);

  const hasActiveAccess = entitlement?.status === "active";
  const hasAdminAccess = hasActiveAccess && entitlement?.planId === "admin";
  const currentPlan = hasActiveAccess ? getPlan(entitlement?.planId) : undefined;

  async function applyReferralCodeValue(code: string) {
    if (!user) {
      throw new Error("Sign in before applying a referral code.");
    }

    const token = await getIdToken();
    const response = await fetch("/api/referrals/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "That referral code could not be applied.");
    }

    const appliedCode = data.referral?.code || code.trim().toUpperCase();
    setReferralCode(appliedCode);
    setAppliedReferralCode(appliedCode);
    setReferralMessage({ type: "success", text: `Referral code ${appliedCode} is attached to this account.` });
  }

  async function handleApplyReferral() {
    if (!referralCode.trim() || referralBusy) return;
    setReferralBusy(true);
    setReferralMessage(null);
    try {
      await applyReferralCodeValue(referralCode.trim());
    } catch (err) {
      setReferralMessage({ type: "error", text: err instanceof Error ? err.message : "That referral code could not be applied." });
    } finally {
      setReferralBusy(false);
    }
  }

  async function handleBuy(planId: string) {
    setLoading(planId);
    try {
      if (referralCode.trim()) {
        await applyReferralCodeValue(referralCode.trim());
      }

      const token = await getIdToken();
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Failed to create order"
        );
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
                  ? "You have admin access"
                  : `You have ${currentPlan?.name ?? "an active plan"}`}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {hasAdminAccess
                  ? "All paid tools are included for this account."
                  : entitlement?.expiresAt
                    ? `Expires ${new Date(entitlement.expiresAt).toLocaleDateString("en-IN")}.`
                    : "Your paid access is ready to use."}
              </p>
            </div>
          </div>
        </div>
      ) : entitlementError ? (
        <div className="surface rounded-panel px-4 py-3 text-sm text-[var(--muted)]">
          We could not verify your current access. Refresh the page before starting checkout.
        </div>
      ) : null}

      {!entitlementLoading && !hasActiveAccess ? (
        <>
          <section className="surface rounded-panel p-4 sm:p-5" aria-labelledby="referral-code-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label-text">Partner attribution</p>
                <h2 id="referral-code-heading" className="display-type mt-2 text-2xl">Have a referral code?</h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--muted)]">Enter it before checkout. Once verified, the first valid referral is attached to your account and remains linked to the purchase.</p>
              </div>
              <div className="flex w-full gap-2 sm:max-w-md">
                <label htmlFor="pricing-referral-code" className="sr-only">Referral code</label>
                <input
                  id="pricing-referral-code"
                  value={referralCode}
                  onChange={(event) => {
                    setReferralCode(event.target.value.toUpperCase());
                    setAppliedReferralCode(null);
                    setReferralMessage(null);
                  }}
                  placeholder="e.g. MUNRAHUL01"
                  className="input-field"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" onClick={() => void handleApplyReferral()} disabled={referralBusy || !referralCode.trim() || !user} className="button-secondary shrink-0 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                  {referralBusy ? "Checking…" : appliedReferralCode === referralCode.trim().toUpperCase() ? "Applied" : "Apply"}
                </button>
              </div>
            </div>
            {!user ? <p className="mt-3 text-xs text-[var(--muted)]">Sign in to apply a referral code before purchasing.</p> : null}
            {referralMessage ? <p className={`mt-3 text-sm ${referralMessage.type === "success" ? "text-[var(--patina)]" : "text-[var(--oxblood)]"}`} role="status">{referralMessage.text}</p> : null}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => {
          const isCurrentPlan = hasActiveAccess && canonicalPlanId(entitlement?.planId) === plan.id;
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
        </>
      ) : null}
    </div>
  );
}
