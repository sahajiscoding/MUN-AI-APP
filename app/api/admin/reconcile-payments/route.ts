import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { requireAdminOwner } from "@/lib/server/admin-auth";
import { reconcilePaidPayments } from "@/lib/server/payment-reconciliation";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`admin-reconcile:${ip}`, 5, 60_000))) {
    return privateJson(
      { ok: false, error: "Too many reconciliation requests. Try again later." },
      429,
      { "Retry-After": "60" },
    );
  }

  try {
    await requireAdminOwner();

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
