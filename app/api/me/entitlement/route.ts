import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { resolveEntitlementWithTrial } from "@/lib/server/trial";

export const runtime = "nodejs";

/** GET /api/me/entitlement — returns the authenticated user's entitlement. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    // The trial starts on the first authenticated read, so an account that has
    // just confirmed its email sees access immediately rather than waiting for
    // a background job. Idempotent: a second call changes nothing, and an
    // account that already has access never reaches the grant RPC at all.
    const entitlement = await resolveEntitlementWithTrial(user.uid);

    return Response.json({ entitlement });
  } catch (error) {
    return jsonError(error);
  }
}
