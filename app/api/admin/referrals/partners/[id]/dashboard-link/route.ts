import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { ensurePartnerDashboardToken } from "@/lib/referrals";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

/**
 * Owner-only: return (creating if needed) the partner's private dashboard
 * link. The owner shares it directly with the partner — it must never appear
 * on any public page.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminOwner();
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new ApiError(400, "invalid_partner_id", "That partner could not be found.");

    const token = await ensurePartnerDashboardToken(id.data);
    if (!token) throw new ApiError(500, "dashboard_link_failed", "Could not prepare the partner dashboard link.");

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
    return Response.json({
      ok: true,
      link: `${siteUrl}/partner/${token}`,
    });
  } catch (error) {
    return jsonError(error);
  }
}
