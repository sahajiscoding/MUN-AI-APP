import { z } from "zod";
import { ApiError, jsonError, methodNotAllowed, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { attachReferralToUser } from "@/lib/referrals";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  displayName: z.string().trim().max(160).default(""),
}).strict();

/** PUT /api/me — upserts the authenticated user's display name and attaches referral. */
export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) {
      throw new ApiError(400, "invalid_profile", "The profile name is invalid.");
    }

    const { error } = await supabaseAdmin().from("users").upsert(
      {
        uid: user.uid,
        display_name: parsed.data.displayName,
        email: user.email ?? "",
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "uid" }
    );
    if (error) throw error;

    // First-touch attribution is attached only after a verified Supabase UID
    // exists. Existing referrals are never overwritten.
    await attachReferralToUser(user.uid);

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

/** GET /api/me — rejects unsupported method with 405 (PUT only). */
export async function GET() {
  return methodNotAllowed(["PUT"]);
}

/** POST /api/me — rejects unsupported method with 405 (PUT only). */
export async function POST() {
  return methodNotAllowed(["PUT"]);
}

/** PATCH /api/me — rejects unsupported method with 405 (PUT only). */
export async function PATCH() {
  return methodNotAllowed(["PUT"]);
}

/** DELETE /api/me — rejects unsupported method with 405 (PUT only). */
export async function DELETE() {
  return methodNotAllowed(["PUT"]);
}
