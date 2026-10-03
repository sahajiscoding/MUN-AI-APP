import {
  verifyWebhookSignature,
  getOrderStatus,
} from "@/lib/payments/uropay";

import { ApiError, readRequestText } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";
import { getPlan } from "@/lib/plans";
import { grantEntitlement } from "@/lib/server/entitlements";
import { processReferralCommission } from "@/lib/referrals";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

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

/** Normalizes a UroPay webhook status string to paid/failed/expired. */
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

/** Converts an unknown webhook amount value to a finite number or null. */
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

type PaymentSyncUpdate = {
  event: UroPayWebhookEvent;
  payment: { environment?: string | null };
  eventId: string;
  status: string;
};

/**
 * Shared column mapping applied whenever a webhook delivery syncs the local
 * payment row. The non-paid and first-paid paths differ only in the status
 * they write and whether they return the updated row.
 */
function buildPaymentSyncUpdate({ event, payment, eventId, status }: PaymentSyncUpdate) {
  return {
    status,
    amount_captured: toNumberOrNull(event.amount_captured),
    commission: toNumberOrNull(event.commission),
    transaction_fee: toNumberOrNull(event.transaction_fee),
    tax: toNumberOrNull(event.tax),
    net_amount: toNumberOrNull(event.net_amount),
    environment:
      event.environment ?? payment.environment ?? null,
    event_id: eventId,
    updated_at: new Date().toISOString(),
  };
}

/** Awards the first-purchase referral commission for a confirmed payment. */
function awardReferralCommission(
  payment: { uid: string; id: string; amount: unknown },
  orderId: string,
  planId: string,
) {
  return processReferralCommission({
    uid: payment.uid,
    paymentId: payment.id,
    orderId,
    planId,
    paymentAmountPaise: Number(payment.amount),
  });
}

/** POST /api/webhooks/uropay — verifies signature and syncs payment/entitlement state. */
export async function POST(
  request: Request
) {
  let claimedEventId: string | null = null;
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`webhook-uropay:${ip}`, 60, 60_000))) {
      return Response.json(
        { ok: false, error: "rate_limited" },
        { status: 429 }
      );
    }

    let rawBody: string;
    try {
      // Bounded read: the signature must cover the exact raw bytes, and an
      // oversized body is rejected before it is fully buffered.
      rawBody = await readRequestText(request, 256_000);
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json({ ok: false, error: "payload_too_large" }, { status: error.status });
      }
      return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const headers: Record<string, string> = {};

    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    if (!verifyWebhookSignature(headers, rawBody)) {
      logger.error(
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
      logger.error(
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
      logger.error(
        "Payment lookup failed:",
        paymentLookupError
      );

      return Response.json(
        { ok: false, error: "database_error" },
        { status: 500 }
      );
    }

    if (!payment) {
      logger.error(
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
      logger.error(
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

    if (
      payment.environment &&
      event.environment &&
      String(payment.environment).toLowerCase() !==
        String(event.environment).toLowerCase()
    ) {
      logger.error(
        "UroPay webhook rejected: environment mismatch."
      );

      return Response.json(
        { ok: false, error: "environment_mismatch" },
        { status: 409 }
      );
    }

    const authoritativeOrder = await getOrderStatus(orderId);

    if (!authoritativeOrder) {
      logger.error(
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
      logger.error(
        "Unknown UroPay authoritative status:",
        authoritativeOrder.status
      );

      return Response.json(
        { ok: false, error: "unknown_order_status" },
        { status: 502 }
      );
    }

    if (authoritativeStatus !== webhookStatus) {
      logger.error(
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
      logger.error(
        "UroPay order has invalid amount."
      );

      return Response.json(
        { ok: false, error: "invalid_order_amount" },
        { status: 502 }
      );
    }

    const expectedAmountRupees = Number(payment.amount) / 100;

    if (authoritativeAmount !== expectedAmountRupees) {
      logger.error(
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

    // Atomically claim the provider event before changing payment or
    // entitlement state. A unique-violation means another delivery won.
    const { error: eventClaimError } = await admin.from("webhook_events").insert({
      event_id: eventId,
      event: "uropay",
      status: "processing",
      order_ref: tenantOrderRef,
      uropay_order_id: orderId,
      updated_at: new Date().toISOString(),
    });

    if (eventClaimError?.code === "23505") {
      return Response.json({ ok: true, already_processed: true });
    }
    if (eventClaimError) {
      throw eventClaimError;
    }
    claimedEventId = eventId;

    // --------------------------------------------------
    // NON-PAID EVENTS
    // --------------------------------------------------

    if (authoritativeStatus !== "paid") {
      const { error: updateError } = await admin
        .from("payments")
        .update(buildPaymentSyncUpdate({ event, payment, eventId, status: authoritativeStatus }))
        .eq("id", payment.id)
        .eq("status", "pending");

      if (updateError) {
        logger.error(
          "Failed to update non-paid payment:",
          updateError
        );

        throw new Error("payment_update_failed");
      }

      await markWebhookEventProcessed(admin, eventId);
      claimedEventId = null;
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
        logger.error(
          "Failed to inspect entitlement for paid payment:",
          entitlementLookupError
        );

        throw new Error("entitlement_lookup_failed");
      }

      if (
        entitlement?.status === "active" &&
        entitlement.latest_payment_id === payment.id
      ) {
        const plan = getPlan(payment.plan_id);
        if (plan) {
          await awardReferralCommission(payment, orderId, plan.id);
        }
        await markWebhookEventProcessed(admin, eventId);
        claimedEventId = null;
        return Response.json({
          ok: true,
          already_processed: true,
          entitlement_granted: true,
        });
      }

      const plan = getPlan(payment.plan_id);

      if (!plan) {
        logger.error(
          "Paid payment references unknown plan:",
          payment.plan_id
        );

        throw new Error("plan_not_found");
      }

      await grantEntitlement({
        uid: payment.uid,
        planId: plan.id,
        source: "uropay-recovery",
        paymentId: payment.id,
        orderId,
      });
      await awardReferralCommission(payment, orderId, plan.id);
      await markWebhookEventProcessed(admin, eventId);
      claimedEventId = null;

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
      .update(buildPaymentSyncUpdate({ event, payment, eventId, status: "paid" }))
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (paymentUpdateError) {
      logger.error(
        "Failed to mark payment paid:",
        paymentUpdateError
      );

      return Response.json(
        { ok: false, error: "payment_update_failed" },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      await markWebhookEventProcessed(admin, eventId);
      claimedEventId = null;
      return Response.json({
        ok: true,
        already_processed: true,
      });
    }

    const plan = getPlan(payment.plan_id);

    if (!plan) {
      logger.error(
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
    await awardReferralCommission(payment, orderId, plan.id);
    await markWebhookEventProcessed(admin, eventId);
    claimedEventId = null;

    // Log correlation IDs only — the logger truncates the UID prefix and
    // never stores full PII (SEC-LOG-01).
    logger.info("UroPay payment confirmed", {
      plan: plan.name,
      uid: payment.uid,
    });

    return Response.json({
      ok: true,
      status: "paid",
      entitlement_granted: true,
    });
  } catch (error) {
    if (claimedEventId) {
      await supabaseAdmin().from("webhook_events").delete().eq("event_id", claimedEventId);
    }
    logger.error(
      "UroPay webhook processing error:",
      error instanceof Error ? error.message : "unknown error"
    );

    return Response.json(
      { ok: false, error: "webhook_processing_failed" },
      { status: 500 }
    );
  }
}

/** Marks a claimed UroPay webhook event as processed. */
async function markWebhookEventProcessed(admin: ReturnType<typeof supabaseAdmin>, eventId: string) {
  const { error } = await admin
    .from("webhook_events")
    .update({ status: "processed", updated_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (error) throw error;
}

/** GET /api/webhooks/uropay — rejects non-POST methods with 405. */
export async function GET() {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: "POST",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
