import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await parseJson<{ uid: string }>(request);

    if (!body.uid) {
      throw new ApiError(400, "missing_uid", "Provide a user UID to approve.");
    }

    // Add to admin_users table
    const { error } = await supabaseAdmin().from("admin_users").upsert(
      {
        uid: body.uid,
        approved_at: new Date().toISOString(),
        approved_by: admin.email,
      },
      { onConflict: "uid" }
    );

    if (error) throw error;

    // Also grant active entitlement so they bypass paywall
    await supabaseAdmin().from("entitlements").upsert(
      {
        uid: body.uid,
        status: "active",
        plan_id: "admin",
        source: "admin",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "uid" }
    );

    return Response.json({ ok: true, message: "User approved as admin." });
  } catch (error) {
    return jsonError(error);
  }
}
