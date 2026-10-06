import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { reconcilePaidPayments } from "@/lib/server/payment-reconciliation";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns a JSON response with private no-store headers. */
function privateJson(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

/** POST /api/admin/reconcile-payments — repairs paid payments missing entitlements. */
export async function POST(request: Request) {
  try {
    // Authenticate first, throttle second. The previous order (IP bucket before
    // auth) let unauthenticated requests burn the owner's bucket (self-DoS
    // behind shared NAT) while IP rotation bypassed the throttle entirely.
    // The bucket is keyed by the verified owner identity, with a looser
    // per-IP bucket retained as a second layer. Kept inside the try so a
    // rejected caller gets a proper 401/403 instead of an unhandled 500.
    const admin = await requireAdminOwner();

    const ip = getClientIp(request);
    if (
      !(await checkRateLimit(`admin-reconcile:${admin.uid}`, 5, 60_000, { failClosed: true })) ||
      !(await checkRateLimit(`admin-reconcile-ip:${ip}`, 10, 60_000, { failClosed: true }))
    ) {
      return privateJson(
        { ok: false, error: "Too many reconciliation requests. Try again later." },
        429,
        { "Retry-After": "60" },
      );
    }

    const results = await reconcilePaidPayments(50);
    return privateJson({
      ok: true,
      processed: results.length,
      failed: results.filter((result) => !result.repaired && !result.reason.startsWith("Entitlement already")).length,
    });
  } catch (error) {
    const response = jsonError(error);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
}
