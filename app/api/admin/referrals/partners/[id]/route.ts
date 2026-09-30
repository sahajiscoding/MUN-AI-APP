import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { recordAdminAction } from "@/lib/server/admin-audit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  email: z.string().trim().email().max(320).optional(),
  whatsapp: z.string().trim().max(40).nullable().optional(),
  status: z.enum(["pending", "active", "suspended"]).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminOwner();
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new ApiError(400, "invalid_partner_id", "That partner could not be updated.");
    const parsed = updateSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success || Object.keys(parsed.data).length === 0) throw new ApiError(400, "invalid_partner", "Enter valid partner details.");

    const values = parsed.data;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (values.name !== undefined) update.name = values.name;
    if (values.email !== undefined) update.email = values.email;
    if (values.whatsapp !== undefined) update.whatsapp = values.whatsapp;
    if (values.status !== undefined) update.status = values.status;
    if (values.commissionRate !== undefined) update.commission_rate = values.commissionRate;
    if (values.notes !== undefined) update.notes = values.notes;

    const { data, error } = await supabaseAdmin()
      .from("referral_partners")
      .update(update)
      .eq("id", id.data)
      .select("id, name, email, whatsapp, referral_code, status, commission_rate, notes, created_at, updated_at")
      .maybeSingle();
    if (error) {
      logger.error("Partner update failed:", error.message);
      throw new ApiError(500, "partner_update_failed", "Could not update partner.");
    }
    if (!data) throw new ApiError(404, "partner_not_found", "Partner not found.");

    await recordAdminAction({
      actorUid: admin.uid,
      actorEmail: admin.email,
      action: "partner_update",
      target: id.data,
      metadata: { changes: Object.keys(update) },
    });

    return Response.json({ partner: data });
  } catch (error) {
    return jsonError(error);
  }
}
