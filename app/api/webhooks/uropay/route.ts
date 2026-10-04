import {
  verifyWebhookSignature,
  getOrderStatus,
  validateAuthoritativeOrderBinding,
  normalizeStatus,
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
  payment: { environment?: string | null; uropay_order_id?: string | null };
  eventId: string;
  orderId: string;
  status: string;
};

/**
 * Shared column mapping applied whenever a webhook delivery syncs the local
 * payment row. Persists uropay_order_id to recover unlinked provider orders.
 */
function buildPaymentSyncUpdate({ event, payment, eventId, orderId, status }: PaymentSyncUpdate) {
  return {
    status,
    uropay_order_id: payment.uropay_order_id || orderId,
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
    if (!(await checkRateLimit(`webhook-uropay:${ip}`, 60, 60_000, { failClosed: true }))) {
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

    if (!payment.uropay_order_id) {
      logger.warn(
        "Reconciling unlinked provider order via webhook:",
        {
          orderRef: tenantOrderRef,
          uropayOrderId: orderId,
        }
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

    // Completely bind provider order ID, merchant order reference,
    // amount, currency, and environment before proceeding.
    const binding = validateAuthoritativeOrderBinding(
      authoritativeOrder,
      {
        orderRef: payment.order_ref,
        amountPaise: payment.amount,
        uropayOrderId: payment.uropay_order_id,
        currency: payment.currency,
        environment: payment.environment,
      },
      orderId
    );

    if (!binding.valid) {
      logger.error(
        "UroPay authoritative binding validation failed:",
        {
          orderRef: tenantOrderRef,
          error: binding.error,
          detail: binding.detail,
        }
      );

      const statusMap: Record<string, number> = {
        order_status_unavailable: 502,
        unknown_order_status: 502,
        invalid_order_amount: 502,
        amount_mismatch: 409,
        order_id_mismatch: 409,
        order_reference_mismatch: 409,
        currency_mismatch: 409,
        environment_mismatch: 409,
      };

      return Response.json(
        { ok: false, error: binding.error },
        { status: statusMap[binding.error] ?? 409 }
      );
    }

    const authoritativeStatus = binding.status;

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

    // Atomically claim the provider event. Distinguishes 'processing',
    // 'processed', and retryable recovery of incomplete claims.
    const claim = await claimWebhookEvent(
      admin,
      eventId,
      tenantOrderRef,
      orderId
    );

    if (claim.type === "already_processed") {
      return Response.json({ ok: true, already_processed: true });
    }

    if (claim.type === "in_flight") {
      // In-progress claim from another delivery: return retryable response,
      // never prematurely acknowledge success while processing.
      return Response.json(
        { ok: false, error: "event_processing_in_flight" },
        {
          status: 429,
          headers: {
            "Retry-After": "5",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    claimedEventId = eventId;

    // --------------------------------------------------
    // NON-PAID EVENTS
    // --------------------------------------------------

    if (authoritativeStatus !== "paid") {
      const { error: updateError } = await admin
        .from("payments")
        .update(buildPaymentSyncUpdate({ event, payment, eventId, orderId, status: authoritativeStatus }))
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

    // Ensure plan is valid before changing any state
    const plan = getPlan(payment.plan_id);
    if (!plan) {
      logger.error(
        "Paid payment references unknown plan:",
        payment.plan_id
      );

      throw new Error(`plan_not_found: ${payment.plan_id}`);
    }

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
        await awardReferralCommission(payment, orderId, plan.id);
        await markWebhookEventProcessed(admin, eventId);
        claimedEventId = null;
        return Response.json({
          ok: true,
          already_processed: true,
          entitlement_granted: true,
        });
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
      .update(buildPaymentSyncUpdate({ event, payment, eventId, orderId, status: "paid" }))
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (paymentUpdateError) {
      logger.error(
        "Failed to mark payment paid:",
        paymentUpdateError
      );

      throw new Error("payment_update_failed");
    }

    if (!updatedPayment) {
      // Payment might have been marked paid concurrently
      const { data: currentPayment } = await admin
        .from("payments")
        .select("status")
        .eq("id", payment.id)
        .maybeSingle();

      if (currentPayment?.status === "paid") {
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
        return Response.json({
          ok: true,
          already_processed: true,
          entitlement_granted: true,
        });
      }
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
      try {
        await supabaseAdmin()
          .from("webhook_events")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("event_id", claimedEventId);
      } catch (cleanupError) {
        logger.error("Failed to mark webhook event as failed:", cleanupError);
      }
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

const LEASE_DURATION_MS = 30_000;

type WebhookClaimResult =
  | { type: "claimed" }
  | { type: "already_processed" }
  | { type: "in_flight" };

/**
 * Atomically claims a webhook event in the database.
 * 
 * Correctly distinguishes:
 * - 'claimed': Fresh claim or safe recovery of an incomplete/failed claim
 * - 'already_processed': Previously completed event (status: 'processed')
 * - 'in_flight': Currently being processed by another active delivery (< 30s lease)
 */
async function claimWebhookEvent(
  admin: ReturnType<typeof supabaseAdmin>,
  eventId: string,
  tenantOrderRef: string,
  orderId: string
): Promise<WebhookClaimResult> {
  const nowIso = new Date().toISOString();
  const { error: insertError } = await admin.from("webhook_events").insert({
    event_id: eventId,
    event: "uropay",
    status: "processing",
    order_ref: tenantOrderRef,
    uropay_order_id: orderId,
    received_at: nowIso,
    updated_at: nowIso,
  });

  if (!insertError) {
    return { type: "claimed" };
  }

  if (insertError.code !== "23505") {
    throw insertError;
  }

  // 23505 Unique collision: inspect existing row status
  const { data: existing, error: fetchError } = await admin
    .from("webhook_events")
    .select("status, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (fetchError || !existing) {
    throw fetchError || new Error("Failed to check existing webhook event.");
  }

  // Only acknowledged as processed if status is genuinely "processed"
  if (existing.status === "processed") {
    return { type: "already_processed" };
  }

  const updatedAtMs = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
  const leaseActive = Date.now() - updatedAtMs < LEASE_DURATION_MS;

  if (existing.status === "processing" && leaseActive) {
    // Duplicate delivery arriving while delivery A is actively processing:
    // Wait briefly (up to 1.5s) to allow delivery A to finish cleanly
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const { data: poll } = await admin
        .from("webhook_events")
        .select("status")
        .eq("event_id", eventId)
        .maybeSingle();

      if (poll?.status === "processed") {
        return { type: "already_processed" };
      }
      if (poll?.status === "failed") {
        break; // First delivery failed, we can reclaim immediately
      }
    }
    // Still in flight: do NOT acknowledge as processed! Return retryable in_flight
    return { type: "in_flight" };
  }

  // Safe recovery of incomplete claim (status === 'failed' or expired lease):
  const { data: reclaimed, error: reclaimError } = await admin
    .from("webhook_events")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId)
    .eq("status", existing.status)
    .select("event_id")
    .maybeSingle();

  if (reclaimError) {
    throw reclaimError;
  }

  if (reclaimed) {
    return { type: "claimed" };
  }

  return { type: "in_flight" };
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
