import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";
import { getPlan } from "@/lib/plans";
import { grantEntitlement } from "@/lib/server/entitlements";
import { processReferralCommission } from "@/lib/referrals";

type ReconciliationResult = {
  paymentId: string;
  uid: string;
  planId: string;
  repaired: boolean;
  reason: string;
};

/** Repair premium entitlements and referral commissions for recent paid payments. */
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
        amount,
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
    logger.error(
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

  const { data: grantRows, error: grantLookupError } = await admin
    .from("entitlement_payment_grants")
    .select("payment_id")
    .in("payment_id", payments.map((payment) => payment.id));
  if (grantLookupError) {
    logger.error("Failed to load payment grant ledger:", grantLookupError.message);
    throw new Error("Could not load payment grant ledger for reconciliation.");
  }
  const alreadyGranted = new Set((grantRows ?? []).map((row) => row.payment_id));

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

      // Ensure the referral commission exists for this paid payment. The
      // webhook normally creates it; this is the owner-driven repair path for
      // payments the webhook never reached. The RPC is idempotent per payment,
      // and the ordering guard in processReferralCommission prevents
      // retroactive commissions for payments made before the code was attached.
      try {
        await processReferralCommission({
          uid: payment.uid,
          paymentId: payment.id,
          orderId: payment.uropay_order_id ?? payment.order_ref,
          planId: plan.id,
          paymentAmountPaise: Number(payment.amount),
        });
      } catch (error) {
        logger.error(
          "Referral commission reconciliation failed:",
          {
            paymentId: payment.id,
            error,
          }
        );
      }

      if (alreadyGranted.has(payment.id)) {
        results.push({
          paymentId: payment.id,
          uid: payment.uid,
          planId: payment.plan_id,
          repaired: false,
          reason: "Payment entitlement was already redeemed.",
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
        logger.error(
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

      // Correlation IDs only — UIDs are truncated by the logger (SEC-LOG-01).
      logger.info("Reconciled paid payment", {
        paymentId: payment.id,
        uid: payment.uid,
        planId: payment.plan_id,
      });
    } catch (error) {
      logger.error(
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
