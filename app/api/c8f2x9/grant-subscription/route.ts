import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { grantEntitlement } from "@/lib/server/entitlements";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";

const GRANTABLE_PLANS = ["weekly-pass", "monthly-pass"] as const;

type GrantBody = {
  uid: string;
  planId: string;
};

export async function POST(request: Request) {
  try {
    const admin = await requireAdminOwner();
    const body = await parseJson<GrantBody>(request);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.uid || "")) {
      throw new ApiError(400, "invalid_uid", "Provide a valid user UID to grant a subscription.");
    }

    if (!GRANTABLE_PLANS.includes(body.planId as (typeof GRANTABLE_PLANS)[number])) {
      throw new ApiError(400, "invalid_plan", "Choose a weekly or monthly subscription to grant.");
    }

    // The grant runs through grant_entitlement_atomic — the same race-free RPC
    // that verified payments use — so a manual grant cannot double-write or
    // break the extend-on-renewal semantics. No payment id is attached, so the
    // same-payment guard never blocks a manual grant.
    const entitlement = await grantEntitlement({
      uid: body.uid,
      planId: body.planId,
      source: "admin_manual",
    });

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "subscription_grant",
      targetUid: body.uid,
      metadata: { planId: body.planId },
    });

    const plan = getPlan(body.planId);

    return Response.json({
      ok: true,
      message: `${plan?.name ?? "Subscription"} granted.`,
      entitlement,
    });
  } catch (error) {
    return jsonError(error);
  }
}