import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay";
import { requireUser } from "@/lib/server/auth";
import { grantEntitlement } from "@/lib/server/entitlements";

export const runtime = "nodejs";

const schema = z.object({
  planId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.safeParse(await parseJson<unknown>(request));

    if (!body.success) {
      throw new ApiError(400, "invalid_payment_payload", "Payment verification data is invalid.");
    }

    const { data: order, error: orderError } = await supabaseAdmin()
      .from("payment_orders")
      .select("*")
      .eq("order_id", body.data.razorpayOrderId)
      .single();

    if (orderError || !order) {
      throw new ApiError(404, "order_not_found", "Payment order was not found.");
    }

    if (order.uid !== user.uid) {
      throw new ApiError(403, "order_owner_mismatch", "This payment belongs to another account.");
    }

    if (order.plan_id !== body.data.planId) {
      throw new ApiError(400, "plan_mismatch", "Payment plan does not match the order.");
    }

    const verified = verifyRazorpayPaymentSignature({
      razorpayOrderId: body.data.razorpayOrderId,
      razorpayPaymentId: body.data.razorpayPaymentId,
      razorpaySignature: body.data.razorpaySignature,
    });

    if (!verified) {
      throw new ApiError(400, "invalid_payment_signature", "Payment signature could not be verified.");
    }

    await supabaseAdmin().from("payments").upsert(
      {
        payment_id: body.data.razorpayPaymentId,
        uid: user.uid,
        plan_id: body.data.planId,
        order_id: body.data.razorpayOrderId,
        razorpay_order_id: body.data.razorpayOrderId,
        razorpay_payment_id: body.data.razorpayPaymentId,
        verified: true,
        source: "client_verify",
        created_at: new Date().toISOString(),
      },
      { onConflict: "payment_id" }
    );

    await supabaseAdmin()
      .from("payment_orders")
      .update({
        status: "paid",
        latest_payment_id: body.data.razorpayPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", body.data.razorpayOrderId);

    const entitlement = await grantEntitlement({
      uid: user.uid,
      planId: body.data.planId,
      source: "razorpay",
      paymentId: body.data.razorpayPaymentId,
      orderId: body.data.razorpayOrderId,
    });

    return Response.json({ entitlement });
  } catch (error) {
    return jsonError(error);
  }
}
