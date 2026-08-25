import { NextResponse } from "next/server";

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

  return suppliedSecret ===
    configuredSecret;
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

    const results =
      await reconcilePaidPayments(
        50
      );

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
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
