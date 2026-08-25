import { z } from "zod";

import { jsonError, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  getEntitlement,
  grantEntitlement,
} from "@/lib/server/entitlements";

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

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);

    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      orderRef: url.searchParams.get("orderRef"),
    });

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_order_reference",
        "A valid payment order reference is required."
      );
    }

    const orderRef = parsed.data.orderRef;
    const admin = supabaseAdmin();

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
      .eq("order_ref", orderRef)
      .eq("uid", user.uid)
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

    const rawStatus = String(payment.status || "")
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

    // A payment is not enough by itself for the UI to claim
    // that Premium is active. The entitlement must also exist.
    // If the webhook marked the payment paid but entitlement
    // creation failed, repair it here from the server-side
    // payment record. The client cannot mark a payment as paid.
    if (status === "paid") {
      let entitlement = await getEntitlement(user.uid);

      const entitlementMatchesPayment =
        entitlement.status === "active" &&
        entitlement.planId === payment.plan_id;

      if (!entitlementMatchesPayment) {
        try {
          entitlement = await grantEntitlement({
            uid: payment.uid,
            planId: payment.plan_id,
            source: "uropay-recovery",
            paymentId: payment.id,
            orderId: payment.uropay_order_id ?? payment.order_ref,
          });
        } catch (error) {
          console.error(
            "Paid payment entitlement recovery failed:",
            error
          );

          return Response.json({
            ok: true,
            status: "pending",
            reason: "payment_confirmed_access_processing",
            orderRef: payment.order_ref,
            planId: payment.plan_id,
          });
        }
      }

      const accessConfirmed =
        entitlement.status === "active" &&
        entitlement.planId === payment.plan_id;

      if (!accessConfirmed) {
        return Response.json({
          ok: true,
          status: "pending",
          reason: "payment_confirmed_access_processing",
          orderRef: payment.order_ref,
          planId: payment.plan_id,
        });
      }

      return Response.json({
        ok: true,
        status: "paid",
        reason: "payment_confirmed",
        orderRef: payment.order_ref,
        planId: payment.plan_id,
        expiresAt: entitlement.expiresAt ?? null,
      });
    }

    if (status === "failed") {
      return Response.json({
        ok: true,
        status: "failed",
        reason: "payment_failed",
        orderRef: payment.order_ref,
        planId: payment.plan_id,
      });
    }

    if (status === "expired") {
      return Response.json({
        ok: true,
        status: "expired",
        reason: "payment_expired",
        orderRef: payment.order_ref,
        planId: payment.plan_id,
      });
    }

    return Response.json({
      ok: true,
      status: "pending",
      reason: "payment_processing",
      orderRef: payment.order_ref,
      planId: payment.plan_id,
    });
  } catch (error) {
    return jsonError(error);
  }
}
