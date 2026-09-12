import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { getEntitlement, grantEntitlement } from "@/lib/server/entitlements";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";

const GRANTABLE_PLANS = ["weekly-pass", "monthly-pass"] as const;

const DAY_MS = 86_400_000;
/** Mirrors the ceiling enforced inside grant_entitlement_atomic. */
const MAX_ACCESS_DAYS = 3650;

type GrantBody = {
  uid: string;
  planId?: string;
  /** A calendar date (YYYY-MM-DD). When set, the pass ends on that day. */
  expiresAt?: string;
};

/**
 * Reads a date input as the last moment of that calendar day (UTC), so a pass
 * set to end on the 30th covers the whole of the 30th.
 */
function parseExpiryDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const target = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  // Reject impossible dates such as 2026-02-31, which Date silently rolls over.
  if (
    target.getUTCFullYear() !== year ||
    target.getUTCMonth() !== month - 1 ||
    target.getUTCDate() !== day
  ) {
    return null;
  }

  return target;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminOwner();
    const body = await parseJson<GrantBody>(request);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.uid || "")) {
      throw new ApiError(400, "invalid_uid", "Provide a valid user UID to grant a subscription.");
    }

    let planId: string;
    let accessDays: number | undefined;

    if (body.expiresAt) {
      const target = parseExpiryDate(body.expiresAt);

      if (!target) {
        throw new ApiError(400, "invalid_expiry", "Enter the expiry as a calendar date (YYYY-MM-DD).");
      }

      if (target.getTime() <= Date.now()) {
        throw new ApiError(400, "expiry_in_past", "Choose an expiry date that has not already passed.");
      }

      // grant_entitlement_atomic extends a live pass rather than replacing it,
      // so measure from whichever date this grant will actually extend from —
      // otherwise the pass would drift past the date the owner picked.
      const current = await getEntitlement(body.uid);
      const liveExpiry = current.status === "active" && current.expiresAt ? new Date(current.expiresAt) : null;
      const base = liveExpiry && Number.isFinite(liveExpiry.getTime()) ? liveExpiry.getTime() : Date.now();

      accessDays = Math.floor((target.getTime() - base) / DAY_MS);

      if (accessDays < 1) {
        throw new ApiError(
          400,
          "expiry_not_beyond_current",
          liveExpiry
            ? `This pass already runs to ${liveExpiry.toISOString().slice(0, 10)}. Pick a later date, or revoke the pass first.`
            : "Pick an expiry date at least a day from now."
        );
      }

      if (accessDays > MAX_ACCESS_DAYS) {
        throw new ApiError(400, "expiry_too_far", "Pick an expiry date within ten years.");
      }

      // Duration is what the pass actually grants; the stored plan is only a
      // label, so record the preset that best matches how long it runs.
      planId = accessDays >= 28 ? "monthly-pass" : "weekly-pass";
    } else {
      const requested = body.planId;

      if (typeof requested !== "string" || !GRANTABLE_PLANS.includes(requested as (typeof GRANTABLE_PLANS)[number])) {
        throw new ApiError(400, "invalid_plan", "Choose a weekly or monthly subscription to grant.");
      }

      planId = requested;
    }

    // The grant runs through grant_entitlement_atomic — the same race-free RPC
    // that verified payments use — so a manual grant cannot double-write or
    // break the extend-on-renewal semantics. No payment id is attached, so the
    // same-payment guard never blocks a manual grant. accessDays is only set
    // for a custom expiry, measured so the pass lands on the chosen date.
    const entitlement = await grantEntitlement({
      uid: body.uid,
      planId,
      source: "admin_manual",
      accessDays,
    });

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "subscription_grant",
      targetUid: body.uid,
      metadata:
        accessDays === undefined
          ? { planId }
          : { planId, accessDays, requestedExpiry: body.expiresAt ?? null },
    });

    const plan = getPlan(planId);
    const grantedUntil = entitlement.expiresAt ? entitlement.expiresAt.slice(0, 10) : null;

    return Response.json({
      ok: true,
      message:
        accessDays === undefined || !grantedUntil
          ? `${plan?.name ?? "Subscription"} granted.`
          : `${plan?.name ?? "Subscription"} granted until ${grantedUntil}.`,
      entitlement,
    });
  } catch (error) {
    return jsonError(error);
  }
}