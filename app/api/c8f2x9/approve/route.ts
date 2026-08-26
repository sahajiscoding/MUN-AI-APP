import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await parseJson<{ uid: string }>(request);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.uid || "")) {
      throw new ApiError(400, "invalid_uid", "Provide a valid user UID to approve.");
    }

    const { error } = await supabaseAdmin().from("admin_users").upsert(
      {
        uid: body.uid,
        approved_at: new Date().toISOString(),
        approved_by: admin.email,
      },
      { onConflict: "uid" }
    );

    if (error) throw error;

    const { error: entitlementError } = await supabaseAdmin().from("entitlements").upsert(
      {
        uid: body.uid,
        status: "active",
        plan_id: "admin",
        source: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "uid" }
    );
    if (entitlementError) throw entitlementError;

    return Response.json({ ok: true, message: "User approved as admin." });
  } catch (error) {
    return jsonError(error);
  }
}
