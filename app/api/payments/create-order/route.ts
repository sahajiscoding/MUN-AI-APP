import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createUropayOrder } from "@/lib/payments/uropay";
import { getPlan } from "@/lib/plans";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mun-ai-app.vercel.app";

const schema = z.object({
  planId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await parseJson<{ planId: string }>(request);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(400, "invalid_request", "planId is required.");
    }

    const plan = getPlan(parsed.data.planId);
    if (!plan) {
      throw new ApiError(404, "plan_not_found", "Plan not found.");
    }

    // Create a unique order reference: uid-planId-timestamp
    const orderRef = `${user.uid}-${plan.id}-${Date.now()}`;

    // Store the order in Supabase so we can link it to the user on webhook
    await supabaseAdmin().from("payments").upsert(
      {
        uid: user.uid,
        order_ref: orderRef,
        plan_id: plan.id,
        amount: plan.amount,
        status: "pending",
        created_at: new Date().toISOString(),
      },
      { onConflict: "order_ref" }
    );

    // Create order on UROpay with redirect URLs
    const { orderId, openUrl } = await createUropayOrder(
      orderRef,
      plan.amount,
      `${SITE_URL}/checkout/success`,
      `${SITE_URL}/api/webhooks/uropay`
    );

    // Update with UROpay order ID
    await supabaseAdmin()
      .from("payments")
      .update({ uropay_order_id: orderId })
      .eq("order_ref", orderRef);

    return Response.json({ openUrl, orderId, orderRef });
  } catch (error) {
    return jsonError(error);
  }
}
