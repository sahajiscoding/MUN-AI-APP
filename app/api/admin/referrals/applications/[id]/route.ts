import { z } from "zod";
import { ApiError, jsonError } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

/** DELETE /api/admin/referrals/applications/[id] — dismisses a partner application. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminOwner();
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new ApiError(400, "invalid_application_id", "That application could not be found.");

    const { error } = await supabaseAdmin()
      .from("partner_applications")
      .delete()
      .eq("id", id.data);

    if (error) {
      logger.error("Partner application delete failed:", error.message);
      throw new ApiError(500, "application_delete_failed", "Could not dismiss that application.");
    }

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "partner_application_dismissed",
      target: id.data,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
