import {
  verifyWebhookSignature,
  getOrderStatus,
} from "@/lib/payments/uropay";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans";
import { grantEntitlement } from "@/lib/server/entitlements";

export const runtime = "nodejs";

type UroPayWebhookEvent = {
  eventId?: string;
  orderId?: string;
  tenantOrderRef?: string;
  status?: string;

  amount_captured?: number | string | null;
  commission?: number | string | null;
  transaction_fee?: number | string | null;
  tax?: number | string | null;
  net_amount?: number | string | null;

  environment?: string | null;
};

function normalizeStatus(
  value: unknown
): "paid" | "failed" | "expired" | null {
  if (typeof value !== "string") {
    return null;
  }

  const status = value.trim().toUpperCase();

  switch (status) {
    case "PAID":
      return "paid";

    case "FAILED":
      return "failed";

    case "EXPIRED":
      return "expired";

    default:
      return null;
  }
}

function toNumberOrNull(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

/**
 * UroPay webhook endpoint.
 *
 * Important:
 * 1. Verify signature before trusting payload.
 * 2. Find our payment using tenantOrderRef.
 * 3. Verify the order amount.
 * 4. Ask UroPay for authoritative order status.
 * 5. Process PAID exactly once.
 * 6. Only then grant Premium.
 */
export async function POST(
  request: Request
) {
  try {
    // --------------------------------------------------
    // 1. Read RAW body.
    // --------------------------------------------------

    const rawBody = await request.text();

    // --------------------------------------------------
    // 2. Collect headers.
    // --------------------------------------------------

    const headers: Record<string, string> = {};

    request.headers.forEach(
      (value, key) => {
        headers[key.toLowerCase()] = value;
      }
    );

    // --------------------------------------------------
    // 3. Verify HMAC signature BEFORE parsing.
    // --------------------------------------------------

    if (
      !verifyWebhookSignature(
        headers,
        rawBody
      )
    ) {
      console.error(
        "UroPay webhook rejected: invalid signature."
      );

      return Response.json(
        {
          ok: false,
          error: "invalid_signature",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 4. Parse the verified payload.
    // --------------------------------------------------

    let event: UroPayWebhookEvent;

    try {
      event = JSON.parse(
        rawBody
      ) as UroPayWebhookEvent;
    } catch {
      return Response.json(
        {
          ok: false,
          error: "invalid_json",
        },
        { status: 400 }
      );
    }

    const eventId =
      typeof event.eventId === "string"
        ? event.eventId.trim()
        : "";

    const orderId =
      typeof event.orderId === "string"
        ? event.orderId.trim()
        : "";

    const tenantOrderRef =
      typeof event.tenantOrderRef ===
      "string"
        ? event.tenantOrderRef.trim()
        : "";

    const webhookStatus =
      normalizeStatus(event.status);

    // --------------------------------------------------
    // 5. Validate required fields.
    // --------------------------------------------------

    if (
      !eventId ||
      !orderId ||
      !tenantOrderRef ||
      !webhookStatus
    ) {
      console.error(
        "UroPay webhook rejected: missing or invalid fields."
      );

      return Response.json(
        {
          ok: false,
          error: "invalid_webhook_payload",
        },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // --------------------------------------------------
    // 6. Find our payment.
    // --------------------------------------------------

    const {
      data: payment,
      error: paymentLookupError,
    } = await admin
      .from("payments")
      .select("*")
      .eq(
        "order_ref",
        tenantOrderRef
      )
      .maybeSingle();

    if (paymentLookupError) {
      console.error(
        "Payment lookup failed:",
        paymentLookupError
      );

      return Response.json(
        {
          ok: false,
          error: "database_error",
        },
        { status: 500 }
      );
    }

    if (!payment) {
      console.error(
        "UroPay webhook: unknown order reference:",
        tenantOrderRef
      );

      // The webhook is authentic, but it doesn't belong
      // to a payment created by our application.
      return Response.json(
        {
          ok: false,
          error: "payment_not_found",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 7. Verify the UroPay order ID matches our record.
    // --------------------------------------------------

    if (
      payment.uropay_order_id &&
      payment.uropay_order_id !== orderId
    ) {
      console.error(
        "UroPay webhook rejected: order ID mismatch.",
        {
          expected: payment.uropay_order_id,
          received: orderId,
        }
      );

      return Response.json(
        {
          ok: false,
          error: "order_id_mismatch",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // 8. Idempotency:
    //    If this exact event was already stored,
    //    acknowledge it and do nothing.
    // --------------------------------------------------

    const {
      data: existingEvent,
      error: existingEventError,
    } = await admin
      .from("payments")
      .select("id, status, event_id")
      .eq(
        "event_id",
        eventId
      )
      .maybeSingle();

    if (existingEventError) {
      console.error(
        "Event lookup failed:",
        existingEventError
      );

      return Response.json(
        {
          ok: false,
          error: "database_error",
        },
        { status: 500 }
      );
    }

    if (existingEvent) {
      return Response.json({
        ok: true,
        already_processed: true,
      });
    }

    // --------------------------------------------------
    // 9. If this payment is already paid,
    //    don't grant Premium again.
    // --------------------------------------------------

    if (payment.status === "paid") {
      return Response.json({
        ok: true,
        already_processed: true,
      });
    }

    // --------------------------------------------------
    // 10. Environment check.
    // --------------------------------------------------

    if (
      payment.environment &&
      event.environment &&
      String(
        payment.environment
      ).toLowerCase() !==
        String(
          event.environment
        ).toLowerCase()
    ) {
      console.error(
        "UroPay webhook rejected: environment mismatch."
      );

      return Response.json(
        {
          ok: false,
          error: "environment_mismatch",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // 11. Get the authoritative order status from UroPay.
    // --------------------------------------------------

    const authoritativeOrder =
      await getOrderStatus(
        orderId
      );

    if (!authoritativeOrder) {
      console.error(
        "UroPay authoritative order lookup returned no data."
      );

      return Response.json(
        {
          ok: false,
          error: "order_status_unavailable",
        },
        { status: 502 }
      );
    }

    const authoritativeStatus =
      normalizeStatus(
        authoritativeOrder.status
      );

    if (!authoritativeStatus) {
      console.error(
        "Unknown UroPay authoritative status:",
        authoritativeOrder.status
      );

      return Response.json(
        {
          ok: false,
          error: "unknown_order_status",
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 12. Never trust the webhook status over the
    //     authoritative order status.
    // --------------------------------------------------

    if (
      authoritativeStatus !==
      webhookStatus
    ) {
      console.error(
        "UroPay status mismatch.",
        {
          webhookStatus,
          authoritativeStatus,
        }
      );

      // Do not grant anything.
      return Response.json(
        {
          ok: false,
          error: "status_mismatch",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // 13. Verify the expected amount.
    //
    // Our DB amount is stored in paise:
    // weekly  = 19900
    // monthly = 29900
    //
    // UroPay amount is expected in rupees.
    // --------------------------------------------------

    const authoritativeAmount =
      Number(
        authoritativeOrder.amount
      );

    if (
      !Number.isFinite(
        authoritativeAmount
      )
    ) {
      console.error(
        "UroPay order has invalid amount."
      );

      return Response.json(
        {
          ok: false,
          error: "invalid_order_amount",
        },
        { status: 502 }
      );
    }

    const expectedAmountRupees =
      Number(payment.amount) / 100;

    if (
      authoritativeAmount !==
      expectedAmountRupees
    ) {
      console.error(
        "UroPay amount mismatch.",
        {
          expectedAmountRupees,
          authoritativeAmount,
        }
      );

      return Response.json(
        {
          ok: false,
          error: "amount_mismatch",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // 14. If the authoritative result isn't PAID,
    //     record the final state but DO NOT grant Premium.
    // --------------------------------------------------

    if (
      authoritativeStatus !==
      "paid"
    ) {
      const { error: updateError } =
        await admin
          .from("payments")
          .update({
            status: authoritativeStatus,
            amount_captured:
              toNumberOrNull(
                event.amount_captured
              ),
            commission:
              toNumberOrNull(
                event.commission
              ),
            transaction_fee:
              toNumberOrNull(
                event.transaction_fee
              ),
            tax:
              toNumberOrNull(
                event.tax
              ),
            net_amount:
              toNumberOrNull(
                event.net_amount
              ),
            environment:
              event.environment ??
              payment.environment ??
              null,
            event_id: eventId,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            payment.id
          );

      if (updateError) {
        console.error(
          "Failed to update non-paid payment:",
          updateError
        );

        return Response.json(
          {
            ok: false,
            error: "payment_update_failed",
          },
          { status: 500 }
        );
      }

      return Response.json({
        ok: true,
        status: authoritativeStatus,
      });
    }

    // --------------------------------------------------
    // 15. PAID:
    //    Mark payment paid.
    // --------------------------------------------------

    const {
      data: updatedPayment,
      error: paymentUpdateError,
    } = await admin
      .from("payments")
      .update({
        status: "paid",
        amount_captured:
          toNumberOrNull(
            event.amount_captured
          ),
        commission:
          toNumberOrNull(
            event.commission
          ),
        transaction_fee:
          toNumberOrNull(
            event.transaction_fee
          ),
        tax:
          toNumberOrNull(
            event.tax
          ),
        net_amount:
          toNumberOrNull(
            event.net_amount
          ),
        environment:
          event.environment ??
          payment.environment ??
          null,
        event_id: eventId,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        payment.id
      )
      .eq(
        "status",
        "pending"
      )
      .select("*")
      .maybeSingle();

    if (paymentUpdateError) {
      console.error(
        "Failed to mark payment paid:",
        paymentUpdateError
      );

      return Response.json(
        {
          ok: false,
          error: "payment_update_failed",
        },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      // Another request may have processed the payment
      // between our checks. Do not grant Premium twice.
      return Response.json({
        ok: true,
        already_processed: true,
      });
    }

    // --------------------------------------------------
    // 16. Find the plan.
    // --------------------------------------------------

    const plan = getPlan(
      payment.plan_id
    );

    if (!plan) {
      console.error(
        "Paid payment references unknown plan:",
        payment.plan_id
      );

      return Response.json(
        {
          ok: false,
          error: "plan_not_found",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 17. Grant/extend Premium entitlement.
    // --------------------------------------------------

    await grantEntitlement({
      uid: payment.uid,
      planId: plan.id,
      source: "uropay",
      paymentId: payment.id,
      orderId,
    });

    console.log(
      `UroPay payment confirmed: ${plan.name} for user ${payment.uid}`
    );

    return Response.json({
      ok: true,
      status: "paid",
      entitlement_granted: true,
    });
  } catch (error) {
    console.error(
      "UroPay webhook processing error:",
      error
    );

    // IMPORTANT:
    // Return 500 instead of pretending processing succeeded.
    // This allows the payment provider/reconciliation system
    // to retry when appropriate.
    return Response.json(
      {
        ok: false,
        error: "webhook_processing_failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET fallback.
 */
export async function GET() {
  return Response.json({
    ok: true,
    message:
      "UroPay webhook endpoint active",
  });
}
