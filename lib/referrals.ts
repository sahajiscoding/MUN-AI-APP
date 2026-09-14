import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans";

export const REFERRAL_COOKIE_NAME = "mun_referral_code";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const DEFAULT_COMMISSION_RATE = 16.72;

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export type ReferralPartner = {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  status: "pending" | "active" | "suspended";
  commission_rate: number;
};

function normalizeCode(value: string) {
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export async function getReferralPartner(referralCode: string): Promise<ReferralPartner | null> {
  const code = normalizeCode(referralCode);
  if (!code) return null;

  const { data, error } = await supabaseAdmin()
    .from("referral_partners")
    .select("id, name, email, referral_code, status, commission_rate")
    .eq("referral_code", code)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("Referral partner lookup failed:", error.message);
    return null;
  }

  return data ? { ...data, commission_rate: Number(data.commission_rate) || DEFAULT_COMMISSION_RATE } : null;
}

export async function getReferralCodeFromCookie() {
  return (await cookies()).get(REFERRAL_COOKIE_NAME)?.value ?? null;
}

export async function setReferralCookie(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  const cookieStore = await cookies();
  if (cookieStore.get(REFERRAL_COOKIE_NAME)?.value) return true;
  cookieStore.set(REFERRAL_COOKIE_NAME, normalized, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
  });
  return true;
}

export type ReferralAttribution = {
  id: string;
  partner_id: string;
  referred_uid: string;
  referral_code: string;
  status: "registered" | "converted" | "cancelled";
};

export async function attachReferralToUser(uid: string) {
  const code = await getReferralCodeFromCookie();
  if (!code) return null;
  return applyReferralCodeToUser(uid, code);
}

export async function applyReferralCodeToUser(uid: string, referralCode: string, verifiedEmail?: string): Promise<ReferralAttribution | null> {
  const partner = await getReferralPartner(referralCode);
  if (!partner) return null;

  const { data: existing, error: existingError } = await supabaseAdmin()
    .from("referrals")
    .select("id, partner_id, referred_uid, referral_code, status")
    .eq("referred_uid", uid)
    .maybeSingle();

  if (existingError) {
    console.error("Existing referral lookup failed:", existingError.message);
    return null;
  }
  if (existing) return existing as ReferralAttribution;

  const { data: userData, error: userError } = await supabaseAdmin()
    .from("users")
    .select("email")
    .eq("uid", uid)
    .maybeSingle();
  if (userError) {
    console.error("Referral self-check lookup failed:", userError.message);
    return null;
  }
  const customerEmail = verifiedEmail?.trim() || userData?.email?.trim() || "";
  if (customerEmail && customerEmail.toLowerCase() === partner.email.trim().toLowerCase()) return null;

  const { data, error } = await supabaseAdmin()
    .from("referrals")
    .insert({
      partner_id: partner.id,
      referred_uid: uid,
      referral_code: partner.referral_code,
      status: "registered",
    })
    .select("id, partner_id, referred_uid, referral_code, status")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: firstTouch } = await supabaseAdmin()
        .from("referrals")
        .select("id, partner_id, referred_uid, referral_code, status")
        .eq("referred_uid", uid)
        .maybeSingle();
      return (firstTouch as ReferralAttribution | null) ?? null;
    }
    console.error("Referral creation failed:", error.message);
    return null;
  }

  return data as ReferralAttribution;
}

export async function processReferralCommission(input: {
  uid: string;
  paymentId: string;
  orderId: string;
  planId: string;
  paymentAmountPaise: number;
}) {
  const paymentAmount = Math.round(input.paymentAmountPaise) / 100;
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error("Invalid verified payment amount.");

  const { data: partnerReferral, error: referralError } = await supabaseAdmin()
    .from("referrals")
    .select("id, partner_id, referred_uid, status, created_at")
    .eq("referred_uid", input.uid)
    .maybeSingle();

  if (referralError) throw new Error("Referral lookup failed.");
  if (!partnerReferral) return { created: false, reason: "no_referral" as const };

  // A partner may only earn on payments made after their code was attached.
  // Without this guard, a payment that predates the referral (e.g. a customer
  // who bought, then typed a code later) could be retroactively commissioned
  // by the status/reconciliation fallbacks below.
  const { data: payment, error: paymentLookupError } = await supabaseAdmin()
    .from("payments")
    .select("created_at")
    .eq("id", input.paymentId)
    .eq("uid", input.uid)
    .maybeSingle();
  if (paymentLookupError || !payment) throw new Error("Payment lookup failed.");

  const referralCreatedAt = partnerReferral.created_at ? new Date(partnerReferral.created_at).getTime() : 0;
  const paymentCreatedAt = payment.created_at ? new Date(payment.created_at).getTime() : 0;
  if (paymentCreatedAt > 0 && referralCreatedAt > 0 && paymentCreatedAt < referralCreatedAt) {
    return { created: false, reason: "not_referred_yet" as const };
  }

  const { data: partner, error: partnerError } = await supabaseAdmin()
    .from("referral_partners")
    .select("email")
    .eq("id", partnerReferral.partner_id)
    .maybeSingle();
  if (partnerError || !partner) throw new Error("Referral partner lookup failed.");

  const { data: customer } = await supabaseAdmin()
    .from("users")
    .select("email")
    .eq("uid", input.uid)
    .maybeSingle();
  if (customer?.email && customer.email.trim().toLowerCase() === partner.email.trim().toLowerCase()) {
    return { created: false, reason: "self_referral" as const };
  }

  const { data: result, error: commissionError } = await supabaseAdmin().rpc("create_first_referral_commission", {
    p_uid: input.uid,
    p_payment_id: input.paymentId,
    p_order_id: input.orderId,
  });

  if (commissionError) throw new Error("Commission creation failed.");

  const outcome = Array.isArray(result) ? result[0] : result;
  if (!outcome || outcome.reason === "no_referral") {
    return { created: false, reason: "no_referral" as const };
  }
  if (outcome.reason === "already_converted") {
    return { created: false, reason: "already_converted" as const };
  }
  if (outcome.reason === "already_processed") {
    return { created: false, reason: "already_processed" as const };
  }
  if (outcome.reason === "self_referral") {
    return { created: false, reason: "self_referral" as const };
  }

  return {
    created: outcome.created === true,
    reason: outcome.reason,
    commissionId: outcome.commission_id ?? undefined,
    commissionAmount: outcome.commission_amount == null ? undefined : Number(outcome.commission_amount),
  };
}

// ---------------------------------------------------------------------------
// Partner dashboard (private, token-based)
// ---------------------------------------------------------------------------

const DASHBOARD_TOKEN_PATTERN = /^[a-f0-9]{48}$/;

/** Bearer dashboard links live this long from issuance/rotation. */
const DASHBOARD_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** Random, unguessable token that opens only this partner's dashboard. */
export function createPartnerDashboardToken() {
  return randomBytes(24).toString("hex");
}

/**
 * One-way hash of a dashboard token for storage. Tokens are 192-bit CSPRNG
 * output, so plain SHA-256 is sufficient — there is nothing to dictionary
 * attack. The database must never hold a usable bearer token: a DB/backup
 * read must not impersonate every partner.
 */
export function hashDashboardToken(rawToken: string) {
  return createHash("sha256").update(rawToken.trim().toLowerCase()).digest("hex");
}

export function dashboardTokenExpiryDate(from: Date = new Date()) {
  return new Date(from.getTime() + DASHBOARD_TOKEN_TTL_MS).toISOString();
}

/**
 * Mint a fresh dashboard token for a partner, invalidating any previous
 * link. Always rotates (the stored value is a hash, so a previous raw token
 * is unrecoverable by design). Returns the raw token exactly once — the
 * caller must deliver it to the partner, it can never be read back.
 */
export async function mintPartnerDashboardToken(partnerId: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const rawToken = createPartnerDashboardToken();

  const { error } = await admin
    .from("referral_partners")
    .update({
      dashboard_token: hashDashboardToken(rawToken),
      dashboard_token_expires_at: dashboardTokenExpiryDate(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);

  if (error) {
    console.error("Dashboard token minting failed:", error.message);
    return null;
  }
  return rawToken;
}

/**
 * Best-effort click counter for the partner dashboard. Increments on every
 * referral-link capture. Never throws: the signup/capture flow must not break
 * because click tracking is unavailable.
 */
export async function recordReferralClick(partnerId: string) {
  const admin = supabaseAdmin();
  try {
    const { data } = await admin
      .from("referral_partners")
      .select("click_count")
      .eq("id", partnerId)
      .maybeSingle();
    if (!data) return;
    await admin
      .from("referral_partners")
      .update({
        click_count: (Number(data.click_count) || 0) + 1,
        last_clicked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", partnerId);
  } catch (error) {
    console.error("Referral click tracking failed:", error);
  }
}

export type PartnerDashboardReferral = {
  id: string;
  status: "registered" | "converted" | "cancelled";
  created_at: string;
  converted_at: string | null;
};

export type PartnerDashboardCommission = {
  id: string;
  planLabel: string;
  paymentAmount: number;
  commissionAmount: number;
  status: "unpaid" | "paid" | "cancelled";
  paid_at: string | null;
  created_at: string;
};

export type PartnerDashboard = {
  partner: {
    id: string;
    name: string;
    referralCode: string;
    status: "pending" | "active" | "suspended";
    commissionRate: number;
    clickCount: number;
    lastClickedAt: string | null;
  };
  summary: {
    clicks: number;
    referrals: number;
    conversions: number;
    unpaidCount: number;
    unpaidTotal: number;
    paidTotal: number;
  };
  recentReferrals: PartnerDashboardReferral[];
  commissions: PartnerDashboardCommission[];
};

/** Load the complete data set shown on a partner's own private dashboard. */
export async function getPartnerDashboard(token: string): Promise<PartnerDashboard | null> {
  const normalized = token.trim().toLowerCase();
  if (!DASHBOARD_TOKEN_PATTERN.test(normalized)) return null;

  const admin = supabaseAdmin();
  const { data: partner, error: partnerError } = await admin
    .from("referral_partners")
    .select("id, name, referral_code, status, commission_rate, click_count, last_clicked_at, dashboard_token_expires_at")
    .eq("dashboard_token", hashDashboardToken(normalized))
    .maybeSingle();
  if (partnerError) {
    console.error("Partner dashboard lookup failed:", partnerError.message);
    return null;
  }
  if (!partner) return null;
  // A dashboard link is a bearer credential: suspended/pending partners and
  // expired links open nothing. Previously the page merely bannered while
  // still rendering the ledger.
  if (partner.status !== "active") return null;
  if (partner.dashboard_token_expires_at && new Date(partner.dashboard_token_expires_at).getTime() <= Date.now()) {
    return null;
  }

  const [referralsResult, commissionsResult] = await Promise.all([
    admin
      .from("referrals")
      .select("id, status, created_at, converted_at")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("referral_commissions")
      .select("id, plan_id, payment_amount, commission_amount, status, paid_at, created_at")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (referralsResult.error || commissionsResult.error) {
    console.error(
      "Partner dashboard data load failed:",
      referralsResult.error?.message || commissionsResult.error?.message
    );
    return null;
  }

  const referrals = (referralsResult.data ?? []) as unknown as PartnerDashboardReferral[];
  const commissionRows = (commissionsResult.data ?? []) as unknown as {
    id: string;
    plan_id: string;
    payment_amount: number;
    commission_amount: number;
    status: "unpaid" | "paid" | "cancelled";
    paid_at: string | null;
    created_at: string;
  }[];

  const unpaidRows = commissionRows.filter((row) => row.status === "unpaid");
  const unpaidTotal = Math.round(
    unpaidRows.reduce((sum, row) => sum + (Number(row.commission_amount) || 0), 0) * 100
  ) / 100;
  const paidTotal = Math.round(
    commissionRows
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + (Number(row.commission_amount) || 0), 0) * 100
  ) / 100;

  return {
    partner: {
      id: partner.id,
      name: partner.name,
      referralCode: partner.referral_code,
      status: partner.status,
      commissionRate: Number(partner.commission_rate) || 16.72,
      clickCount: Number(partner.click_count) || 0,
      lastClickedAt: partner.last_clicked_at ?? null,
    },
    summary: {
      clicks: Number(partner.click_count) || 0,
      referrals: referrals.length,
      conversions: referrals.filter((referral) => referral.status === "converted").length,
      unpaidCount: unpaidRows.length,
      unpaidTotal,
      paidTotal,
    },
    recentReferrals: referrals,
    commissions: commissionRows.map((row) => ({
      id: row.id,
      planLabel: getPlan(row.plan_id)?.name ?? row.plan_id,
      paymentAmount: Number(row.payment_amount) || 0,
      commissionAmount: Number(row.commission_amount) || 0,
      status: row.status,
      paid_at: row.paid_at ?? null,
      created_at: row.created_at,
    })),
  };
}
