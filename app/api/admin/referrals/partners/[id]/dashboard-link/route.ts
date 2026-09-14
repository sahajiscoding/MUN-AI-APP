import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { mintPartnerDashboardToken } from "@/lib/referrals";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

/**
 * Owner-only: mint a fresh private dashboard link for a partner.
 * Rotation semantics: minting invalidates any previously issued link (the
 * stored value is a hash, so old links cannot be recovered — only replaced).
 * The raw token is returned exactly once and must be shared privately; it
 * must never appear on any public page.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminOwner();
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new ApiError(400, "invalid_partner_id", "That partner could not be found.");

    const token = await mintPartnerDashboardToken(id.data);
    if (!token) throw new ApiError(500, "dashboard_link_failed", "Could not prepare the partner dashboard link.");

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "partner_dashboard_link_mint",
      target: id.data,
    });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
    return Response.json({
      ok: true,
      link: `${siteUrl}/partner/${token}`,
      rotated: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
