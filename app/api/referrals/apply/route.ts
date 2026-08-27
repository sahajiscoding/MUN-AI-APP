import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { applyReferralCodeToUser } from "@/lib/referrals";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(3).max(32),
}).strict();

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
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
