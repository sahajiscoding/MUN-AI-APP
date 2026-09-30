import { ApiError, jsonError } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdminOwner();

    const { data, error } = await supabaseAdmin()
      .from("partner_applications")
      .select("id, name, email, whatsapp, note, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      logger.error("Partner applications lookup failed:", error.message);
      throw new ApiError(500, "applications_unavailable", "Could not load partner applications.");
    }

    return Response.json({ applications: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}
