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

export async function POST(
  request: Request
) {
  try {
    const rawBody = await request.text();

    const headers: Record<string, string> = {};

    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    if (!verifyWebhookSignature(headers, rawBody)) {
      console.error(
        "UroPay webhook rejected: invalid signature."
      );

      return Response.json(
        { ok: false, error: "invalid_signature" },
        { status: 401 }
      );
    }

    let event: UroPayWebhookEvent;

    try {
      event = JSON.parse(rawBody) as UroPayWebhookEvent;
    } catch {
      return Response.json(
        { ok: false, error: "invalid_json" },
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
      typeof event.tenantOrderRef === "string"
        ? event.tenantOrderRef.trim()
        : "";

    const webhookStatus = normalizeStatus(event.status);

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
        { ok: false, error: "invalid_webhook_payload" },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    const {
      data: payment,
      error: paymentLookupError,
    } = await admin
      .from("payments")
      .select("*")
      .eq("order_ref", tenantOrderRef)
      .maybeSingle();

    if (paymentLookupError) {
      console.error(
        "Payment lookup failed:",
        paymentLookupError
      );

      return Response.json(
        { ok: false, error: "database_error" },
        { status: 500 }
      );
    }

    if (!payment) {
      console.error(
        "UroPay webhook: unknown order reference:",
        tenantOrderRef
      );

      return Response.json(
        { ok: false, error: "payment_not_found" },
        { status: 404 }
      );
    }

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
        { ok: false, error: "order_id_mismatch" },
        { status: 409 }
      );
    }

    // An event ID is globally unique in our payments table.
    // A repeated copy of the exact same event is safe to acknowledge.
    const {
      data: existingEvent,
      error: existingEventError,
    } = await admin
      .from("payments")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEventError) {
      console.error(
        "Event lookup failed:",
        existingEventError
      );

      return Response.json(
        { ok: false, error: "database_error" },
        { status: 500 }
      );
    }

    // If the exact event was already stored, do not process it twice.
    if (existingEvent) {
      return Response.json({
        ok: true,
        already_processed: true,
      });
    }

    if (
      payment.environment &&
      event.environment &&
      String(payment.environment).toLowerCase() !==
        String(event.environment).toLowerCase()
    ) {
      console.error(
        "UroPay webhook rejected: environment mismatch."
      );

      return Response.json(
        { ok: false, error: "environment_mismatch" },
        { status: 409 }
      );
    }

    const authoritativeOrder = await getOrderStatus(orderId);

    if (!authoritativeOrder) {
      console.error(
        "UroPay authoritative order lookup returned no data."
      );

      return Response.json(
        { ok: false, error: "order_status_unavailable" },
        { status: 502 }
      );
    }

    const authoritativeStatus = normalizeStatus(
      authoritativeOrder.status
    );

    if (!authoritativeStatus) {
      console.error(
        "Unknown UroPay authoritative status:",
        authoritativeOrder.status
      );

      return Response.json(
        { ok: false, error: "unknown_order_status" },
        { status: 502 }
      );
    }

    if (authoritativeStatus !== webhookStatus) {
      console.error(
        "UroPay status mismatch.",
        {
          webhookStatus,
          authoritativeStatus,
        }
      );

      return Response.json(
        { ok: false, error: "status_mismatch" },
        { status: 409 }
      );
    }

    const authoritativeAmount = Number(
      authoritativeOrder.amount
    );

    if (!Number.isFinite(authoritativeAmount)) {
      console.error(
        "UroPay order has invalid amount."
      );

      return Response.json(
        { ok: false, error: "invalid_order_amount" },
        { status: 502 }
      );
    }

    const expectedAmountRupees = Number(payment.amount) / 100;

    if (authoritativeAmount !== expectedAmountRupees) {
      console.error(
        "UroPay amount mismatch.",
        {
          expectedAmountRupees,
          authoritativeAmount,
        }
      );

      return Response.json(
        { ok: false, error: "amount_mismatch" },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // NON-PAID EVENTS
    // --------------------------------------------------

    if (authoritativeStatus !== "paid") {
      const { error: updateError } = await admin
        .from("payments")
        .update({
          status: authoritativeStatus,
          amount_captured: toNumberOrNull(event.amount_captured),
          commission: toNumberOrNull(event.commission),
          transaction_fee: toNumberOrNull(event.transaction_fee),
          tax: toNumberOrNull(event.tax),
          net_amount: toNumberOrNull(event.net_amount),
          environment:
            event.environment ?? payment.environment ?? null,
          event_id: eventId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .eq("status", "pending");

      if (updateError) {
        console.error(
          "Failed to update non-paid payment:",
          updateError
        );

        return Response.json(
          { ok: false, error: "payment_update_failed" },
          { status: 500 }
        );
      }

      return Response.json({
        ok: true,
        status: authoritativeStatus,
      });
    }

    // --------------------------------------------------
    // PAID EVENT
    // --------------------------------------------------

    // Important recovery behavior:
    // A previous request may have changed the payment to PAID
    // but failed before granting the entitlement. In that case,
    // a later legitimate webhook must be able to repair access.
    // We only skip processing when the entitlement itself records
    // this exact payment as its latest payment.
    if (payment.status === "paid") {
      const {
        data: entitlement,
        error: entitlementLookupError,
      } = await admin
        .from("entitlements")
        .select(
          "uid, status, plan_id, latest_payment_id"
        )
        .eq("uid", payment.uid)
        .maybeSingle();

      if (entitlementLookupError) {
        console.error(
          "Failed to inspect entitlement for paid payment:",
          entitlementLookupError
        );

        return Response.json(
          { ok: false, error: "entitlement_lookup_failed" },
          { status: 500 }
        );
      }

      if (
        entitlement?.status === "active" &&
        entitlement.latest_payment_id === payment.id
      ) {
        return Response.json({
          ok: true,
          already_processed: true,
          entitlement_granted: true,
        });
      }

      const plan = getPlan(payment.plan_id);

      if (!plan) {
        console.error(
          "Paid payment references unknown plan:",
          payment.plan_id
        );

        return Response.json(
          { ok: false, error: "plan_not_found" },
          { status: 500 }
        );
      }

      await grantEntitlement({
        uid: payment.uid,
        planId: plan.id,
        source: "uropay-recovery",
        paymentId: payment.id,
        orderId,
      });

      return Response.json({
        ok: true,
        status: "paid",
        entitlement_granted: true,
        recovered: true,
      });
    }

    // --------------------------------------------------
    // First successful PAID processing.
    // --------------------------------------------------

    const {
      data: updatedPayment,
      error: paymentUpdateError,
    } = await admin
      .from("payments")
      .update({
        status: "paid",
        amount_captured: toNumberOrNull(event.amount_captured),
        commission: toNumberOrNull(event.commission),
        transaction_fee: toNumberOrNull(event.transaction_fee),
        tax: toNumberOrNull(event.tax),
        net_amount: toNumberOrNull(event.net_amount),
        environment:
          event.environment ?? payment.environment ?? null,
        event_id: eventId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (paymentUpdateError) {
      console.error(
        "Failed to mark payment paid:",
        paymentUpdateError
      );

      return Response.json(
        { ok: false, error: "payment_update_failed" },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      return Response.json({
        ok: true,
        already_processed: true,
      });
    }

    const plan = getPlan(payment.plan_id);

    if (!plan) {
      console.error(
        "Paid payment references unknown plan:",
        payment.plan_id
      );

      return Response.json(
        { ok: false, error: "plan_not_found" },
        { status: 500 }
      );
    }

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

    return Response.json(
      { ok: false, error: "webhook_processing_failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "UroPay webhook endpoint active",
  });
}
