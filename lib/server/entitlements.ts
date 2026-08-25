import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans";
import { isUserAdmin } from "@/lib/server/admin-auth";

export type EntitlementStatus = "inactive" | "active" | "expired";

export type Entitlement = {
  status: EntitlementStatus;
  planId?: string;
  expiresAt?: string;
  source?: string;
};

export async function getEntitlement(uid: string): Promise<Entitlement> {
  // Admin users bypass all entitlement checks
  if (await isUserAdmin(uid)) {
    return { status: "active", planId: "admin", source: "admin" };
  }

  const { data, error } = await supabaseAdmin()
    .from("entitlements")
    .select("*")
    .eq("uid", uid)
    .single();

  if (error || !data) {
    return { status: "inactive" };
  }

  const expiresAtDate = data.expires_at ? new Date(data.expires_at) : null;

  if (expiresAtDate && expiresAtDate.getTime() < Date.now()) {
    return {
      status: "expired",
      planId: data.plan_id,
      expiresAt: expiresAtDate.toISOString(),
      source: data.source,
    };
  }

  return {
    status: data.status === "active" ? "active" : "inactive",
    planId: data.plan_id,
    expiresAt: expiresAtDate?.toISOString(),
    source: data.source,
  };
}

export async function assertPaidAccess(uid: string) {
  const entitlement = await getEntitlement(uid);

  if (entitlement.status !== "active") {
    throw new ApiError(402, "paid_access_required", "This tool is part of the paid MUN prep workspace.");
  }

  return entitlement;
}

export async function grantEntitlement(input: {
  uid: string;
  planId: string;
  source: "razorpay";
  paymentId?: string;
  orderId?: string;
}) {
  const plan = getPlan(input.planId);

  if (!plan) {
    throw new ApiError(400, "invalid_plan", "The selected plan does not exist.");
  }

  const expiresAt = new Date(Date.now() + plan.accessDays * 24 * 60 * 60 * 1000);

  const { error } = await supabaseAdmin().from("entitlements").upsert(
    {
      uid: input.uid,
      status: "active",
      plan_id: input.planId,
      source: input.source,
      latest_payment_id: input.paymentId ?? null,
      latest_order_id: input.orderId ?? null,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "uid" }
  );

  if (error) {
    throw new ApiError(500, "entitlement_grant_failed", "Could not grant access. Please try again.");
  }

  return getEntitlement(input.uid);
}
