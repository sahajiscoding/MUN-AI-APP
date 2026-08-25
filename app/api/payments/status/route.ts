import { z } from "zod";

import { jsonError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/server/entitlements";

export const runtime = "nodejs";

const querySchema = z.object({
  orderRef: z
    .string()
    .trim()
    .min(1)
    .max(100),
});

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired";

export async function GET(
  request: Request
) {
  try {
    // --------------------------------------------------
    // 1. Require the user to be logged in.
    // --------------------------------------------------

    const user =
      await requireUser(request);

    // --------------------------------------------------
    // 2. Read orderRef from the URL.
    // --------------------------------------------------

    const url =
      new URL(request.url);

    const parsed =
      querySchema.safeParse({
        orderRef:
          url.searchParams.get(
            "orderRef"
          ),
      });

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_order_reference",
        "A valid payment order reference is required."
      );
    }

    const orderRef =
      parsed.data.orderRef;

    // --------------------------------------------------
    // 3. Find the payment.
    //
    // IMPORTANT:
    // We filter by BOTH orderRef and the authenticated
    // user's UID. A user must never be able to inspect
    // another user's payment.
    // --------------------------------------------------

    const admin =
      supabaseAdmin();

    const {
      data: payment,
      error: paymentError,
    } = await admin
      .from("payments")
      .select(
        `
          id,
          uid,
          order_ref,
          plan_id,
          amount,
          status,
          environment,
          uropay_order_id,
          created_at,
          updated_at
        `
      )
      .eq(
        "order_ref",
        orderRef
      )
      .eq(
        "uid",
        user.uid
      )
      .maybeSingle();

    if (paymentError) {
      console.error(
        "Payment status lookup failed:",
        paymentError
      );

      throw new ApiError(
        500,
        "payment_lookup_failed",
        "Could not check the payment status."
      );
    }

    if (!payment) {
      throw new ApiError(
        404,
        "payment_not_found",
        "Payment could not be found."
      );
    }

    // --------------------------------------------------
    // 4. Normalize the payment status.
    // --------------------------------------------------

    const rawStatus =
      String(
        payment.status || ""
      )
        .trim()
        .toLowerCase();

    let status: PaymentStatus;

    switch (rawStatus) {
      case "paid":
        status = "paid";
        break;

      case "failed":
        status = "failed";
        break;

      case "expired":
        status = "expired";
        break;

      case "pending":
      default:
        status = "pending";
        break;
    }

    // --------------------------------------------------
    // 5. NEVER treat "paid" by itself as enough.
    //
    // The webhook marks the payment as paid and then
    // grants the entitlement.
    //
    // If entitlement creation temporarily failed,
    // we keep the user on the "processing" page
    // instead of incorrectly saying access is unlocked.
    // --------------------------------------------------

    if (status === "paid") {
      const entitlement =
        await getEntitlement(
          user.uid
        );

      const entitlementMatchesPayment =
        entitlement.status ===
          "active" &&
        entitlement.planId ===
          payment.plan_id;

      if (
        !entitlementMatchesPayment
      ) {
        return Response.json({
          ok: true,
          status: "pending",
          reason:
            "payment_confirmed_access_processing",
          orderRef:
            payment.order_ref,
          planId:
            payment.plan_id,
        });
      }

      return Response.json({
        ok: true,
        status: "paid",
        reason:
          "payment_confirmed",
        orderRef:
          payment.order_ref,
        planId:
          payment.plan_id,
        expiresAt:
          entitlement.expiresAt ??
          null,
      });
    }

    // --------------------------------------------------
    // 6. FAILED
    // --------------------------------------------------

    if (
      status === "failed"
    ) {
      return Response.json({
        ok: true,
        status: "failed",
        reason:
          "payment_failed",
        orderRef:
          payment.order_ref,
        planId:
          payment.plan_id,
      });
    }

    // --------------------------------------------------
    // 7. EXPIRED
    // --------------------------------------------------

    if (
      status === "expired"
    ) {
      return Response.json({
        ok: true,
        status: "expired",
        reason:
          "payment_expired",
        orderRef:
          payment.order_ref,
        planId:
          payment.plan_id,
      });
    }

    // --------------------------------------------------
    // 8. PENDING
    // --------------------------------------------------

    return Response.json({
      ok: true,
      status: "pending",
      reason:
        "payment_processing",
      orderRef:
        payment.order_ref,
      planId:
        payment.plan_id,
    });
  } catch (error) {
    return jsonError(error);
  }
}
