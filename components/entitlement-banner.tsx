"use client";

import { Crown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

type EntitlementData = {
  status: "inactive" | "active" | "expired";
  planId?: string;
  expiresAt?: string;
};

type EntitlementResponse = {
  entitlement?: EntitlementData;
  error?: string;
};

export function EntitlementBanner() {
  const { user, getIdToken } = useAuth();
  const [data, setData] = useState<EntitlementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        return;
      }

      try {
        const token = await getIdToken();
        const response = await fetch("/api/me/entitlement", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const json = (await response.json()) as EntitlementResponse;

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

    load();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, user]);

  if (loading) {
    return (
      <div className="surface flex items-center gap-3 rounded-panel px-4 py-3 text-sm text-[var(--muted)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking access
      </div>
    );
  }

  const active = data?.status === "active";

  return (
    <div className="surface flex flex-col gap-4 rounded-panel px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-panel bg-[var(--ink)] text-[var(--paper)]">
          <Crown className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">
            {active ? "Paid workspace active" : "Paid tools locked"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {active && data?.expiresAt
              ? `Access expires ${new Date(data.expiresAt).toLocaleDateString("en-IN")}.`
              : "Unlock AI research, speeches, POIs, and resolution drafting for this account."}
          </p>
        </div>
      </div>

      {!active ? (
        <Link className="button-primary inline-flex items-center justify-center px-4 text-sm font-semibold" href="/pricing">
          Unlock access
        </Link>
      ) : null}
    </div>
  );
}
