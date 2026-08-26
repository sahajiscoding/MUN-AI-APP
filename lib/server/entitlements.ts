import { ApiError } from "@/lib/api";
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

export async function grantEntitlement(
  input: {
    uid: string;
    planId: string;
    source: string;
    paymentId?: string;
    orderId?: string;
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

  const admin =
    supabaseAdmin();

  // Find the user's current entitlement.
  const {
    data: existing,
    error: existingError,
  } = await admin
    .from("entitlements")
    .select(
      "uid, status, expires_at"
    )
    .eq(
      "uid",
      input.uid
    )
    .maybeSingle();

  if (existingError) {
    console.error(
      "Failed to read existing entitlement:",
      existingError
    );

    throw new ApiError(
      500,
      "entitlement_lookup_failed",
      "Could not determine the current Premium access."
    );
  }

  const now =
    new Date();

  let startDate =
    now;

  let baseDate =
    now;

  // If the user already has valid Premium,
  // extend from the existing expiry instead
  // of throwing away their remaining time.
  if (
    existing?.status ===
      "active" &&
    existing.expires_at
  ) {
    const existingExpiry =
      new Date(
        existing.expires_at
      );

    if (
      Number.isFinite(
        existingExpiry.getTime()
      ) &&
      existingExpiry.getTime() >
        now.getTime()
    ) {
      baseDate =
        existingExpiry;
    }
  }

  const expiresAt =
    new Date(
      baseDate.getTime() +
        plan.accessDays *
          24 *
          60 *
          60 *
          1000
    );

  const { error } =
    await admin
      .from("entitlements")
      .upsert(
        {
          uid: input.uid,
          status: "active",
          plan_id: plan.id,
          source: input.source,
          latest_payment_id:
            input.paymentId ??
            null,
          latest_order_id:
            input.orderId ??
            null,
          starts_at:
            startDate.toISOString(),
          expires_at:
            expiresAt.toISOString(),
          updated_at:
            now.toISOString(),
        },
        {
          onConflict: "uid",
        }
      );

  if (error) {
    console.error(
      "Entitlement grant failed:",
      error
    );

    throw new ApiError(
      500,
      "entitlement_grant_failed",
      "Could not grant Premium access."
    );
  }

  return getEntitlement(
    input.uid
  );
}
