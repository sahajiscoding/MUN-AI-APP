import { NextResponse } from "next/server";

import { timingSafeEqual } from "node:crypto";
import { reconcilePaidPayments } from "@/lib/server/payment-reconciliation";

export const runtime = "nodejs";

function isAuthorized(
  request: Request
): boolean {
  const configuredSecret =
    process.env.PAYMENT_RECONCILIATION_SECRET;

  if (!configuredSecret) {
    console.error(
      "PAYMENT_RECONCILIATION_SECRET is not configured."
    );

    return false;
  }

  const suppliedSecret =
    request.headers.get(
      "x-reconciliation-secret"
    );

  if (!suppliedSecret) {
    return false;
  }

  const supplied = Buffer.from(suppliedSecret);
  const configured = Buffer.from(configuredSecret);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

export async function POST(
  request: Request
) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const results = await reconcilePaidPayments(50);

    return NextResponse.json({
      ok: true,
      processed: results.length,
      failed: results.filter((result) => !result.repaired && !result.reason.startsWith("Entitlement already")).length,
    });
  } catch (error) {
    console.error(
      "Payment reconciliation failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "reconciliation_failed",
      },
      {
        status: 500,
      }
    );
  }
}
