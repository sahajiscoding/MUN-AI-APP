import { ApiError, jsonError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isOwnerAdmin, requireAdmin } from "@/lib/server/admin-auth";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Mask an email for delegated (non-owner) administrators: support can still
 * roughly identify the account, but the full contact address is owner-only.
 */
function maskEmail(email: string | null): string | null {
  if (!email) return email;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!(await checkRateLimit(`admin-users:${admin.uid}`, 30, 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again later.");
    }
    const owner = await isOwnerAdmin(admin.uid);

    const url = new URL(request.url);
    const page = Math.max(0, Math.floor(Number(url.searchParams.get("page")) || 0));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)));

    const { data: users, error: usersError, count } = await supabaseAdmin()
      .from("users")
      .select("uid, display_name, email, last_seen_at", { count: "exact" })
      .order("last_seen_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (usersError) throw usersError;

    const pageUids = (users || []).map((u) => u.uid);
    const [{ data: entitlements }, { data: admins }, { data: partners, error: partnersError }] = await Promise.all([
      pageUids.length
        ? supabaseAdmin().from("entitlements").select("uid, status, plan_id, source, expires_at").in("uid", pageUids)
        : Promise.resolve({ data: [] as Array<{ uid: string; status: string; plan_id: string | null; source: string | null; expires_at: string | null }> }),
      supabaseAdmin().from("admin_users").select("uid"),
      supabaseAdmin().from("referral_partners").select("email, referral_code, status").limit(2000),
    ]);

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
        // Full contact addresses are owner-only; delegated admins get masked
        // values sufficient for day-to-day support.
        email: owner ? u.email : maskEmail(u.email),
        isAdmin: adminUids.has(u.uid),
        entitlement: entitlementMap.get(u.uid) || { status: "inactive", expires_at: null },
        referral: partner
          ? {
              code: partner.referral_code,
              status: partner.status,
              link: partner.status === "active"
                ? `${siteUrl}/login/referral-${encodeURIComponent(partner.referral_code)}`
                : null,
            }
          : null,
      };
    });

    return Response.json({ users: enrichedUsers, page, pageSize, total: count ?? enrichedUsers.length });
  } catch (error) {
    return jsonError(error);
  }
}
