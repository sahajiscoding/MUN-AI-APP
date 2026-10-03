import { ApiError, jsonError, parseJson } from "@/lib/api";
import { getReferralCodeFromCookie, getReferralPartner, recordReferralClick, setReferralCookie } from "@/lib/referrals";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/** POST /api/referrals/capture — captures a referral click for a valid active code. */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`referral-capture:${ip}`, 30, 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again later.");
    }
    const body = await parseJson<unknown>(request);
    const code = body && typeof body === "object" && "code" in body
      ? (body as { code?: unknown }).code
      : null;
    const normalizedCode = typeof code === "string" ? code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizedCode)) {
      throw new ApiError(400, "invalid_referral_code", "That referral code is invalid.");
    }

    const partner = await getReferralPartner(normalizedCode);
    if (!partner) {
      throw new ApiError(404, "referral_not_found", "That referral code is not active.");
    }

    // Only a fresh capture counts as a click: first-touch attribution is
    // immutable, so repeat visits and other partners' links must not inflate
    // (or overwrite) the count.
    const existingCode = await getReferralCodeFromCookie();
    if (!existingCode) {
      await setReferralCookie(partner.referral_code);

      // Best-effort click counter for the partner dashboard. Never fails the
      // capture even if the tracking columns are not present yet.
      await recordReferralClick(partner.id);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
