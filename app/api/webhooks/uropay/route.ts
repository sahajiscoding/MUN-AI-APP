import { verifyWebhookSignature, getOrderStatus } from "@/lib/payments/uropay";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * UROpay webhook handler
 * Receives signed notifications when an order is PAID, FAILED, or EXPIRED
 * Webhook is advisory — always verify with GET /v1/orders/{orderId} if uncertain
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Collect all headers for signature verification
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Verify webhook signature (timing-safe, uses /tenant-webhook path)
    if (!verifyWebhookSignature(headers, rawBody)) {
      console.error("Webhook: invalid signature");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const {
      eventId,
      orderId,
      tenantOrderRef,
      status,
      amount_captured,
      commission,
      transaction_fee,
      tax,
      net_amount,
      environment,
    } = event;

    console.log(`Webhook: eventId=${eventId} orderId=${orderId} status=${status} env=${environment}`);

    if (!tenantOrderRef || !status) {
      return Response.json({ ok: true, skipped: true });
    }

    // Find the payment record
    const { data: payment } = await supabaseAdmin()
      .from("payments")
      .select("*")
      .eq("order_ref", tenantOrderRef)
      .single();

    if (!payment) {
      console.error("Webhook: payment not found for order_ref:", tenantOrderRef);
      return Response.json({ ok: true, skipped: true });
    }

    // Already processed (idempotent on eventId)
    if (payment.status === "paid") {
      return Response.json({ ok: true, already_processed: true });
    }

    // Update payment status with full details
    await supabaseAdmin()
      .from("payments")
      .update({
        status: status.toLowerCase(),
        amount_captured: amount_captured,
        commission: commission,
        transaction_fee: transaction_fee,
        tax: tax,
        net_amount: net_amount,
        environment: environment,
        event_id: eventId,
        updated_at: new Date().toISOString(),
      })
      .eq("order_ref", tenantOrderRef);

    // If paid, grant entitlement
    if (status === "PAID") {
      const plan = getPlan(payment.plan_id);
      if (!plan) {
        console.error("Webhook: plan not found:", payment.plan_id);
        return Response.json({ ok: true, error: "plan_not_found" });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + plan.accessDays);

      await supabaseAdmin().from("entitlements").upsert(
        {
          uid: payment.uid,
          status: "active",
          plan_id: plan.id,
          source: "uropay",
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "uid" }
      );

      console.log(`Webhook: granted ${plan.name} (${plan.accessDays} days) to user ${payment.uid}`);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    // Always return 200 to prevent UROpay from retrying
    return Response.json({ ok: true });
  }
}

/**
 * GET fallback — UROpay may call GET to verify the endpoint is alive
 */
export async function GET() {
  return Response.json({ ok: true, message: "UroPay webhook endpoint active" });
}
