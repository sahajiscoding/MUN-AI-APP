import { verifyWebhookSignature, getOrderStatus } from "@/lib/payments/uropay";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * UROpay webhook handler
 * Receives signed notifications when an order is PAID, FAILED, or EXPIRED
 */
export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-signature") || "";
    const timestamp = request.headers.get("x-timestamp") || "";

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, timestamp)) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(payload);
    const { tenantOrderRef, status, orderId } = event;

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

    // Already processed
    if (payment.status === "paid") {
      return Response.json({ ok: true, already_processed: true });
    }

    // Update payment status
    await supabaseAdmin()
      .from("payments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("order_ref", tenantOrderRef);

    // If paid, grant entitlement
    if (status === "paid" || status === "PAID") {
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

      console.log(`Webhook: granted ${plan.name} to user ${payment.uid}`);
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return Response.json({ ok: true }); // Always 200 to prevent retries
  }
}

/**
 * GET fallback — UROpay may call GET to verify the endpoint is alive
 */
export async function GET() {
  return Response.json({ ok: true, message: "UROpay webhook endpoint active" });
}
