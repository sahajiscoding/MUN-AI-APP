import { supabaseAdmin } from "@/lib/supabase/server";
import { getPlan } from "@/lib/plans";
import { grantEntitlement } from "@/lib/server/entitlements";

type ReconciliationResult = {
  paymentId: string;
  uid: string;
  planId: string;
  repaired: boolean;
  reason: string;
};

export async function reconcilePaidPayments(
  limit = 50
): Promise<ReconciliationResult[]> {
  const admin = supabaseAdmin();

  const results: ReconciliationResult[] = [];

  // Find recently paid payments.
  //
  // We intentionally limit the number processed in one run
  // so a reconciliation request cannot perform an unlimited
  // amount of database work.
  const {
    data: payments,
    error: paymentError,
  } = await admin
    .from("payments")
    .select(
      `
        id,
        uid,
        plan_id,
        status,
        order_ref,
        uropay_order_id,
        created_at
      `
    )
    .eq("status", "paid")
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (paymentError) {
    console.error(
      "Failed to load paid payments:",
      paymentError
    );

    throw new Error(
      "Could not load paid payments for reconciliation."
    );
  }

  if (!payments?.length) {
    return results;
  }

  for (const payment of payments) {
    try {
      const plan = getPlan(
        payment.plan_id
      );

      if (!plan) {
        results.push({
          paymentId: payment.id,
          uid: payment.uid,
          planId: payment.plan_id,
          repaired: false,
          reason:
            "Payment references an unknown plan.",
        });

        continue;
      }

      // Check whether the user already has an active entitlement.
      const {
        data: entitlement,
        error: entitlementError,
      } = await admin
        .from("entitlements")
        .select(
          `
            uid,
            status,
            plan_id,
            expires_at,
            latest_payment_id,
            latest_order_id
          `
        )
        .eq(
          "uid",
          payment.uid
        )
        .maybeSingle();

      if (entitlementError) {
        console.error(
          "Failed to check entitlement:",
          {
            paymentId: payment.id,
            error: entitlementError,
          }
        );

        results.push({
          paymentId: payment.id,
          uid: payment.uid,
          planId: payment.plan_id,
          repaired: false,
          reason:
            "Could not read entitlement.",
        });

        continue;
      }

      const now = Date.now();

      const entitlementExpiry =
        entitlement?.expires_at
          ? new Date(
              entitlement.expires_at
            ).getTime()
          : 0;

      const entitlementIsActive =
        entitlement?.status ===
          "active" &&
        entitlementExpiry > now;

      const alreadyLinkedToPayment =
        entitlement?.latest_payment_id ===
        payment.id;

      const alreadyLinkedToOrder =
        entitlement?.latest_order_id ===
        payment.uropay_order_id;

      if (
        entitlementIsActive &&
        (alreadyLinkedToPayment ||
          alreadyLinkedToOrder)
      ) {
        results.push({
          paymentId: payment.id,
          uid: payment.uid,
          planId: payment.plan_id,
          repaired: false,
          reason:
            "Entitlement already correctly linked.",
        });

        continue;
      }

      // If the payment is paid but the entitlement isn't
      // correctly linked, repair it.
      await grantEntitlement({
        uid: payment.uid,
        planId: plan.id,
        source: "uropay-reconciliation",
        paymentId: payment.id,
        orderId:
          payment.uropay_order_id ??
          undefined,
      });

      results.push({
        paymentId: payment.id,
        uid: payment.uid,
        planId: payment.plan_id,
        repaired: true,
        reason:
          "Premium entitlement repaired.",
      });

      console.log(
        "Reconciled paid payment:",
        {
          paymentId: payment.id,
          uid: payment.uid,
          planId: payment.plan_id,
        }
      );
    } catch (error) {
      console.error(
        "Failed to reconcile payment:",
        {
          paymentId: payment.id,
          error,
        }
      );

      results.push({
        paymentId: payment.id,
        uid: payment.uid,
        planId: payment.plan_id,
        repaired: false,
        reason:
          "Reconciliation failed.",
      });
    }
  }

  return results;
}
