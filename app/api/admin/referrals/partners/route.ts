import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const partnerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  whatsapp: z.string().trim().max(40).nullable().optional(),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/),
  status: z.enum(["pending", "active", "suspended"]).default("pending"),
  commissionRate: z.number().min(0).max(100).default(16.72),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = partnerSchema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) throw new ApiError(400, "invalid_partner", "Enter valid partner details.");

    const values = parsed.data;
    const { data, error } = await supabaseAdmin()
      .from("referral_partners")
      .insert({
        name: values.name,
        email: values.email,
        whatsapp: values.whatsapp ?? null,
        referral_code: values.referralCode,
        status: values.status,
        commission_rate: values.commissionRate,
        notes: values.notes ?? null,
      })
      .select("id, name, email, whatsapp, referral_code, status, commission_rate, notes, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") throw new ApiError(409, "referral_code_taken", "That referral code is already in use.");
      console.error("Partner creation failed:", error.message);
      throw new ApiError(500, "partner_create_failed", "Could not create partner.");
    }
    return Response.json({ partner: data }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
