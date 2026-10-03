import { ApiError } from "@/lib/api";
import { logger } from "@/lib/server/secure-logger";
import { supabaseAdmin } from "@/lib/supabase/server";
import { canonicalPlanId, getPlan } from "@/lib/plans";
import { isUserAdmin } from "@/lib/server/admin-auth";

export type EntitlementStatus =
  | "inactive"
  | "active"
  | "expired";

export type Entitlement = {
  status: EntitlementStatus;
  planId?: string;
  expiresAt?: string;
  source?: string;
};

/** Load a user's premium entitlement, treating admins as always active. */
export async function getEntitlement(
  uid: string
): Promise<Entitlement> {
  // Admin users always have access.
  if (await isUserAdmin(uid)) {
    return {
      status: "active",
      planId: "admin",
      source: "admin",
    };
  }

  const { data, error } =
    await supabaseAdmin()
      .from("entitlements")
      .select("uid, status, plan_id, source, starts_at, expires_at, latest_payment_id, latest_order_id, updated_at")
      .eq("uid", uid)
      .maybeSingle();

  if (error || !data) {
    return {
      status: "inactive",
    };
  }

  const expiresAtDate =
    data.expires_at
      ? new Date(data.expires_at)
      : null;

  // No valid expiry means the entitlement cannot be considered active.
  if (!expiresAtDate || !Number.isFinite(expiresAtDate.getTime())) {
    return {
      status: data.status === "expired" ? "expired" : "inactive",
      planId: canonicalPlanId(data.plan_id) ?? data.plan_id ?? undefined,
      source: data.source,
    };
  }

  // Expired entitlements are never treated as active.
  if (
    expiresAtDate.getTime() <=
    Date.now()
  ) {
    return {
      status: "expired",
      planId: canonicalPlanId(data.plan_id) ?? data.plan_id ?? undefined,
      expiresAt:
        expiresAtDate.toISOString(),
      source: data.source,
    };
  }

  return {
    status:
      data.status === "active"
        ? "active"
        : "inactive",
    planId: data.plan_id,
    expiresAt:
      expiresAtDate.toISOString(),
    source: data.source,
  };
}

/** Require active paid access for a user, throwing 402 otherwise. */
export async function assertPaidAccess(
  uid: string
) {
  const entitlement =
    await getEntitlement(uid);

  if (
    entitlement.status !==
    "active"
  ) {
    throw new ApiError(
      402,
      "paid_access_required",
      "This tool is part of the paid MUN prep workspace."
    );
  }

  return entitlement;
}

/** Grant premium access for a plan via an atomic database update. */
export async function grantEntitlement(
  input: {
    uid: string;
    planId: string;
    source: string;
    paymentId?: string;
    orderId?: string;
    /**
     * Overrides the plan's usual duration. Owner-initiated grants use this to
     * end a pass on a chosen date instead of a fixed weekly/monthly window.
     */
    accessDays?: number;
  }
) {
  const plan = getPlan(
    input.planId
  );

  if (!plan) {
    throw new ApiError(
      400,
      "invalid_plan",
      "The selected plan does not exist."
    );
  }

  const { error } = await supabaseAdmin().rpc("grant_entitlement_atomic", {
    p_uid: input.uid,
    p_plan_id: plan.id,
    p_source: input.source,
    p_access_days: input.accessDays ?? plan.accessDays,
    p_payment_id: input.paymentId ?? null,
    p_order_id: input.orderId ?? null,
  });

  if (error) {
    logger.error("Atomic entitlement grant failed:", error.message);

    throw new ApiError(
      500,
      "entitlement_grant_failed",
      "Could not grant Premium access."
    );
  }

  return getEntitlement(input.uid);
}
