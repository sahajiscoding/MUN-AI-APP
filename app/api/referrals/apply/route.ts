import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { applyReferralCodeToUser } from "@/lib/referrals";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(3).max(32),
}).strict();

/** POST /api/referrals/apply — applies a referral code to the authenticated user. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (!(await checkRateLimit(`referral-apply:${user.uid}`, 10, 60_000))) {
      throw new ApiError(429, "rate_limited", "Too many referral attempts. Please try again later.");
    }
    const parsed = schema.safeParse(await parseJson<unknown>(request));

    if (!parsed.success) {
      throw new ApiError(400, "invalid_referral_code", "Enter a valid referral code.");
    }

    const referral = await applyReferralCodeToUser(
      user.uid,
      parsed.data.code,
      user.email
    );

    if (!referral) {
      throw new ApiError(400, "invalid_referral_code", "That referral code is invalid, inactive, or cannot be used for this account.");
    }

    return Response.json({
      ok: true,
      referral: {
        code: referral.referral_code,
        status: referral.status,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
