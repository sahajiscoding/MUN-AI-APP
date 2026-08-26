import { ApiError, jsonError, parseJson } from "@/lib/api";
import { getReferralPartner, setReferralCookie } from "@/lib/referrals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await parseJson<unknown>(request);
    const code = body && typeof body === "object" && "code" in body
      ? (body as { code?: unknown }).code
      : null;
    if (typeof code !== "string" || code.length > 64) {
      throw new ApiError(400, "invalid_referral_code", "That referral code is invalid.");
    }

    const partner = await getReferralPartner(code);
    if (!partner) {
      throw new ApiError(404, "referral_not_found", "That referral code is not active.");
    }

    await setReferralCookie(partner.referral_code);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
