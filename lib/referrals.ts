import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";

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
  const { data: referral, error: referralError } = await supabaseAdmin()
    .from("referrals")
    .select("id, partner_id, referred_uid, status")
    .eq("referred_uid", input.uid)
    .maybeSingle();

  if (referralError) throw new Error("Referral lookup failed.");
  if (!referral) return { created: false, reason: "no_referral" as const };

  const paymentAmount = Math.round(input.paymentAmountPaise) / 100;
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error("Invalid verified payment amount.");

  const { data: partner, error: partnerError } = await supabaseAdmin()
    .from("referral_partners")
    .select("email, commission_rate")
    .eq("id", referral.partner_id)
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

  const commissionRate = Number(partner.commission_rate);
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) throw new Error("Invalid commission rate.");
  const commissionAmount = Math.round(paymentAmount * commissionRate) / 100;

  const { data: commission, error: commissionError } = await supabaseAdmin()
    .from("referral_commissions")
    .insert({
      partner_id: referral.partner_id,
      referral_id: referral.id,
      payment_id: input.paymentId,
      order_id: input.orderId,
      plan_id: input.planId,
      payment_amount: paymentAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: "unpaid",
    })
    .select("id, commission_amount")
    .single();

  if (commissionError) {
    if (commissionError.code === "23505") {
      await supabaseAdmin()
        .from("referrals")
        .update({ status: "converted", updated_at: new Date().toISOString() })
        .eq("id", referral.id)
        .eq("status", "registered");
      return { created: false, reason: "already_processed" as const };
    }
    throw new Error("Commission creation failed.");
  }

  const { error: conversionError } = await supabaseAdmin()
    .from("referrals")
    .update({
      status: "converted",
      first_payment_id: input.paymentId,
      first_order_id: input.orderId,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", referral.id)
    .eq("status", "registered");
  if (conversionError) console.error("Referral conversion update failed:", conversionError.message);

  return { created: true, commissionId: commission.id, commissionAmount };
}
