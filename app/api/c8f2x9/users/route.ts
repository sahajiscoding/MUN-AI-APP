import { jsonError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { data: users, error: usersError } = await supabaseAdmin()
      .from("users")
      .select("uid, display_name, email, last_seen_at")
      .order("last_seen_at", { ascending: false });

    if (usersError) throw usersError;

    const { data: entitlements } = await supabaseAdmin()
      .from("entitlements")
      .select("uid, status, plan_id, expires_at");

    const { data: admins } = await supabaseAdmin()
      .from("admin_users")
      .select("uid");

    const { data: partners, error: partnersError } = await supabaseAdmin()
      .from("referral_partners")
      .select("email, referral_code, status");

    if (partnersError) {
      // Referral setup is supplemental to user management. Keep the admin
      // dashboard usable if an older database has not applied referral tables.
      console.error("Referral partner lookup failed:", partnersError.message);
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
    const adminUids = new Set((admins || []).map((a) => a.uid));
    const partnerByEmail = new Map(
      (partners || []).map((partner) => [partner.email.trim().toLowerCase(), partner])
    );
    const entitlementMap = new Map(
      (entitlements || []).map((e) => [e.uid, e])
    );

    const enrichedUsers = (users || []).map((u) => {
      const partner = u.email ? partnerByEmail.get(u.email.trim().toLowerCase()) : undefined;
      return {
        ...u,
        isAdmin: adminUids.has(u.uid),
        entitlement: entitlementMap.get(u.uid) || { status: "inactive" },
        referral: partner
          ? {
              code: partner.referral_code,
              status: partner.status,
              link: partner.status === "active"
                ? `${siteUrl}/${encodeURIComponent(partner.referral_code)}`
                : null,
            }
          : null,
      };
    });

    return Response.json({ users: enrichedUsers });
  } catch (error) {
    return jsonError(error);
  }
}
