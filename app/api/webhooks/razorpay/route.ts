import { ApiError, jsonError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay";
import { grantEntitlement } from "@/lib/server/entitlements";

export const runtime = "nodejs";

type RazorpayWebhook = {
  event?: string;
  id?: string;
  payload?: {
    order?: {
      entity?: {
        id?: string;
      };
    };
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      throw new ApiError(400, "invalid_webhook_signature", "Webhook signature is invalid.");
    }

    const event = JSON.parse(rawBody) as RazorpayWebhook;
    const eventId = event.id ?? crypto.randomUUID();

    // Idempotency check
    const { data: existing } = await supabaseAdmin()
      .from("webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .single();

    if (existing) {
      return Response.json({ received: true, duplicate: true });
    }

    await supabaseAdmin().from("webhook_events").insert({
      event_id: eventId,
      event: event.event ?? "unknown",
    });

    const razorpayOrderId =
      event.payload?.order?.entity?.id ?? event.payload?.payment?.entity?.order_id;
    const razorpayPaymentId = event.payload?.payment?.entity?.id;

    if (!razorpayOrderId) {
      return Response.json({ received: true, ignored: true });
    }

    const { data: order } = await supabaseAdmin()
      .from("payment_orders")
      .select("*")
      .eq("order_id", razorpayOrderId)
      .single();

    if (!order) {
      await supabaseAdmin()
        .from("webhook_events")
        .update({
          status: "order_not_found",
          razorpay_order_id: razorpayOrderId,
        })
        .eq("event_id", eventId);

      return Response.json({ received: true, orderFound: false });
    }

    const shouldGrant =
      event.event === "order.paid" ||
      event.event === "payment.captured" ||
      event.payload?.payment?.entity?.status === "captured";

    if (shouldGrant && order.uid && order.plan_id) {
      await supabaseAdmin().from("payments").upsert(
        {
          payment_id: razorpayPaymentId ?? razorpayOrderId,
          uid: order.uid,
          plan_id: order.plan_id,
          order_id: razorpayOrderId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId ?? null,
          verified: true,
          source: "webhook",
          raw_event: event.event ?? null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "payment_id" }
      );

      await supabaseAdmin()
        .from("payment_orders")
        .update({
          status: "paid",
          latest_payment_id: razorpayPaymentId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", razorpayOrderId);

      await grantEntitlement({
        uid: order.uid,
        planId: order.plan_id,
        source: "razorpay",
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    return jsonError(error);
  }
}
