"use client";

import { Crown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { readJsonResponse } from "@/lib/http";
import { isTrialPlanId } from "@/lib/plans";

type EntitlementData = {
  status: "inactive" | "active" | "expired";
  planId?: string;
  expiresAt?: string;
  source?: string;
};

/** Whole days left before `expiresAt`, floored at zero. */
function daysLeft(expiresAt?: string) {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(remaining)) return null;
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

type EntitlementResponse = {
  entitlement?: EntitlementData;
  error?: string;
};

/** Banner showing paid workspace status with an unlock action. */
export function EntitlementBanner() {
  const { user, getIdToken } = useAuth();
  const [data, setData] = useState<EntitlementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    /** Loads the current entitlement for the signed-in user. */
    async function load() {
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }

      try {
        const token = await getIdToken();
        const response = await fetch("/api/me/entitlement", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const json = (await readJsonResponse<EntitlementResponse>(response)) ?? {};

        if (!cancelled) {
          setData(json.entitlement ?? null);
        }
      } catch {
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, user]);

  if (loading) {
    return (
      <div className="surface flex items-center gap-3 rounded-panel px-4 py-3 text-sm text-[var(--muted)]" role="status" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking access
      </div>
    );
  }

  const active = data?.status === "active";
  const trial = active && isTrialPlanId(data?.planId);
  const remaining = trial ? daysLeft(data?.expiresAt) : null;

  return (
    <div className="surface flex flex-col gap-4 rounded-panel px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-panel bg-[var(--ink)] text-[var(--paper)]">
          <Crown className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">
            {trial
              ? "Free trial active"
              : active
                ? "Paid workspace active"
                : "Paid tools locked"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {trial
              ? `Everything is unlocked until ${data.expiresAt ? new Date(data.expiresAt).toLocaleDateString("en-IN") : "your trial ends"}${
                  remaining === null
                    ? "."
                    : remaining <= 1
                      ? " — last day."
                      : ` — ${remaining} days left.`
                } Keep it by choosing a plan.`
              : active && data.expiresAt
                ? `Access expires ${new Date(data.expiresAt).toLocaleDateString("en-IN")}.`
                : "Unlock AI research, speeches, POIs, and resolution drafting for this account."}
          </p>
        </div>
      </div>

      {!active || trial ? (
        <Link className="button-primary inline-flex items-center justify-center px-4 text-sm font-semibold" href="/pricing">
          {trial ? "Choose a plan" : "Unlock access"}
        </Link>
      ) : null}
    </div>
  );
}
