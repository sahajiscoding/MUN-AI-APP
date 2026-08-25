import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getRazorpayClient, getRazorpayPublicKey } from "@/lib/payments/razorpay";
import { getPlan } from "@/lib/plans";
import { requireUser } from "@/lib/server/auth";

export const runtime = "nodejs";

const schema = z.object({
  planId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = schema.safeParse(await parseJson<unknown>(request));

    if (!body.success) {
      throw new ApiError(400, "invalid_order_request", "Choose a valid plan.");
    }

    const plan = getPlan(body.data.planId);

    if (!plan) {
      throw new ApiError(400, "invalid_plan", "The selected plan does not exist.");
    }

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `mun_${Date.now()}`,
      notes: {
        uid: user.uid,
        planId: plan.id,
      },
    });

    await supabaseAdmin().from("payment_orders").upsert(
      {
        order_id: order.id,
        uid: user.uid,
        email: user.email ?? null,
        plan_id: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        razorpay_order_id: order.id,
        status: "created",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
    );

    return Response.json({
      key: getRazorpayPublicKey(),
      razorpayOrderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      description: plan.name,
    });
  } catch (error) {
    return jsonError(error);
  }
}
