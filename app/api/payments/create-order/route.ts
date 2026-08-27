import { randomUUID } from "crypto";
import { z } from "zod";

import { ApiError, jsonError, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createUropayOrder } from "@/lib/payments/uropay";
import { getPlan } from "@/lib/plans";
import { attachReferralToUser } from "@/lib/referrals";

export const runtime = "nodejs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://mun-ai-app.vercel.app";

const WEBHOOK_URL =
  `${SITE_URL}/api/webhooks/uropay`;

const PAYMENT_ENVIRONMENT =
  process.env.UROPAY_ENVIRONMENT ||
  (
    process.env.NODE_ENV === "production"
      ? "production"
      : "test"
  );

const schema =
  z.object({
    planId:
      z.string()
        .trim()
        .min(1),
  });

export async function POST(
  request: Request
) {
  try {
    // --------------------------------------------------
    // 1. Require an authenticated user.
    // --------------------------------------------------

    const user =
      await requireUser(request);

    // Capture first-touch attribution again at the trusted checkout boundary
    // in case the client profile sync has not completed yet.
    await attachReferralToUser(user.uid);

    // --------------------------------------------------
    // 2. Validate request body.
    // --------------------------------------------------

    const body =
      await parseJson<unknown>(
        request
      );

    const parsed =
      schema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_request",
        "planId is required."
      );
    }

    // --------------------------------------------------
    // 3. Get plan ONLY from trusted server configuration.
    // --------------------------------------------------

    const plan =
      getPlan(
        parsed.data.planId
      );

    if (!plan) {
      throw new ApiError(
        404,
        "plan_not_found",
        "The selected plan does not exist."
      );
    }

    // --------------------------------------------------
    // 4. Generate unpredictable merchant order reference.
    // --------------------------------------------------

    const orderRef =
      `MUN-${randomUUID()}`;

    const admin =
      supabaseAdmin();

    // --------------------------------------------------
    // 5. Create local payment as PENDING.
    // --------------------------------------------------

    const {
      data: payment,
      error:
        paymentInsertError,
    } = await admin
      .from("payments")
      .insert({
        uid:
          user.uid,

        order_ref:
          orderRef,

        plan_id:
          plan.id,

        amount:
          plan.amount,

        status:
          "pending",

        environment:
          PAYMENT_ENVIRONMENT,

        created_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .select(
        `
          id,
          uid,
          order_ref,
          plan_id,
          amount,
          status,
          environment
        `
      )
      .single();

    if (
      paymentInsertError ||
      !payment
    ) {
      console.error(
        "Payment creation DB error:",
        paymentInsertError
      );

      throw new ApiError(
        500,
        "payment_record_failed",
        "Could not create the payment record."
      );
    }

    // --------------------------------------------------
    // 6. Send order to UroPay.
    //
    // IMPORTANT:
    // The return URL now includes orderRef.
    // --------------------------------------------------

    const returnUrl =
      `${SITE_URL}/checkout/success?orderRef=${encodeURIComponent(
        orderRef
      )}`;

    let uropayOrder: {
      orderId: string;
      openUrl: string;
    };

    try {
      uropayOrder =
        await createUropayOrder(
          orderRef,
          plan.amount,
          returnUrl,
          WEBHOOK_URL
        );
    } catch (error) {
      console.error(
        "UroPay order creation failed:",
        error
      );

      await admin
        .from("payments")
        .update({
          status:
            "pending",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          payment.id
        );

      throw new ApiError(
        502,
        "payment_provider_error",
        "Could not create the payment with UroPay. Please try again."
      );
    }

    // --------------------------------------------------
    // 7. Store UroPay order ID.
    // --------------------------------------------------

    const {
      error:
        paymentUpdateError,
    } = await admin
      .from("payments")
      .update({
        uropay_order_id:
          uropayOrder.orderId,

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
      );

    if (
      paymentUpdateError
    ) {
      console.error(
        "Failed to save UroPay order ID:",
        paymentUpdateError
      );

      throw new ApiError(
        500,
        "payment_linking_failed",
        "The payment was created but could not be linked correctly. Please contact support before retrying."
      );
    }

    // --------------------------------------------------
    // 8. Return only checkout information.
    // --------------------------------------------------

    return Response.json({
      openUrl:
        uropayOrder.openUrl,

      orderId:
        uropayOrder.orderId,

      orderRef,

      planId:
        plan.id,

      amount:
        plan.amount,

      currency:
        plan.currency,
    });
  } catch (error) {
    return jsonError(error);
  }
}
