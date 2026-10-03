import { ApiError, jsonError } from "@/lib/api";
import { isOwnerAdmin, requireAdmin } from "@/lib/server/admin-auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

export const runtime = "nodejs";

/** GET /api/admin/referrals — returns partners, referrals, and commissions for admins. */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!(await checkRateLimit(`admin-referrals:${admin.uid}`, 30, 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again later.");
    }
    // Customer contact details are owner-only: delegated admins see names
    // and aggregates, never email addresses.
    const owner = await isOwnerAdmin(admin.uid);
    const db = supabaseAdmin();

    const [partnersResult, referralsResult, commissionsResult] = await Promise.all([
      db
        .from("referral_partners")
        .select("id, name, email, whatsapp, referral_code, status, commission_rate, notes, created_at, updated_at")
        .order("created_at", { ascending: false }),
      db
        .from("referrals")
        .select("id, partner_id, referred_uid, referral_code, status, first_payment_id, first_order_id, converted_at, created_at")
        .order("created_at", { ascending: false }),
      db
        .from("referral_commissions")
        .select("id, partner_id, referral_id, payment_id, order_id, plan_id, payment_amount, commission_rate, commission_amount, status, paid_at, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (partnersResult.error || referralsResult.error || commissionsResult.error) {
      logger.error("Referral dashboard query failed:", partnersResult.error?.message || referralsResult.error?.message || commissionsResult.error?.message);
      throw new ApiError(500, "referral_dashboard_unavailable", "Could not load referral data.");
    }

    const referrals = referralsResult.data ?? [];
    const commissions = commissionsResult.data ?? [];
    const customerUids = [...new Set(referrals.map((referral) => referral.referred_uid))];
    const paymentIds = [...new Set(commissions.map((commission) => commission.payment_id).filter((id): id is string => Boolean(id)))];

    const [{ data: customers, error: customersError }, { data: payments, error: paymentsError }] = await Promise.all([
      customerUids.length
        ? db.from("users").select("uid, display_name, email").in("uid", customerUids)
        : Promise.resolve({ data: [], error: null }),
      paymentIds.length
        ? db.from("payments").select("id, uid, order_ref, plan_id, amount, status, created_at").in("id", paymentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (customersError || paymentsError) {
      logger.error("Referral dashboard enrichment failed:", customersError?.message || paymentsError?.message);
      throw new ApiError(500, "referral_dashboard_unavailable", "Could not load referral data.");
    }

    const customerByUid = new Map((customers ?? []).map((customer) => [customer.uid, customer]));
    const paymentById = new Map((payments ?? []).map((payment) => [payment.id, payment]));
    const partnerById = new Map((partnersResult.data ?? []).map((partner) => [partner.id, partner]));
    const referralById = new Map(referrals.map((referral) => [referral.id, referral]));

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
    const partnerRows = (partnersResult.data ?? []).map((partner) => {
      const partnerReferrals = referrals.filter((referral) => referral.partner_id === partner.id);
      const partnerCommissions = commissions.filter((commission) => commission.partner_id === partner.id);
      // Partner contact details (email/whatsapp/notes) are owner-only.
      const { email, whatsapp, notes, ...partnerPublic } = partner;
      return {
        ...partnerPublic,
        ...(owner ? { email, whatsapp, notes } : { email: "", whatsapp: "", notes: "" }),
        successful_referrals: partnerReferrals.filter((referral) => referral.status === "converted").length,
        total_commission: sum(partnerCommissions.map((commission) => Number(commission.commission_amount))),
        unpaid_commission: sum(partnerCommissions.filter((commission) => commission.status === "unpaid").map((commission) => Number(commission.commission_amount))),
        paid_commission: sum(partnerCommissions.filter((commission) => commission.status === "paid").map((commission) => Number(commission.commission_amount))),
        referral_link: partner.status === "active"
          ? `${siteUrl}/${encodeURIComponent(partner.referral_code)}`
          : null,
      };
    });

    const commissionRows = commissions.map((commission) => {
      const referral = referralById.get(commission.referral_id);
      const customer = referral ? customerByUid.get(referral.referred_uid) : undefined;
      const payment = commission.payment_id ? paymentById.get(commission.payment_id) : undefined;
      const partner = partnerById.get(commission.partner_id);
      return {
        ...commission,
        partner_name: partner?.name ?? "Unknown partner",
        referral_code: referral?.referral_code ?? partner?.referral_code ?? "",
        customer_name: customer?.display_name || "Delegate",
        customer_email: owner ? customer?.email || "" : "",
        payment_status: payment?.status ?? "successful",
      };
    });

    return Response.json({
      summary: {
        total_partners: partnerRows.length,
        successful_referrals: referrals.filter((referral) => referral.status === "converted").length,
        unpaid_commission: sum(commissions.filter((commission) => commission.status === "unpaid").map((commission) => Number(commission.commission_amount))),
        paid_commission: sum(commissions.filter((commission) => commission.status === "paid").map((commission) => Number(commission.commission_amount))),
      },
      partners: partnerRows,
      referrals: referrals.map((referral) => ({
        ...referral,
        partner_name: partnerById.get(referral.partner_id)?.name ?? "Unknown partner",
        customer_name: customerByUid.get(referral.referred_uid)?.display_name || "Delegate",
        customer_email: owner ? customerByUid.get(referral.referred_uid)?.email || "" : "",
      })),
      commissions: commissionRows,
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** Sums finite numbers rounded to two decimals. */
function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0) * 100) / 100;
}
