/**
 * SERVER-ONLY MODULE — never import from client components.
 *
 * Shared x402 fulfilment pipeline.
 *
 * Both paid routes (the bot knowledge base and the AI research endpoint) must
 * perform the same ordered sequence. Centralising it here means a future change
 * to the payment flow cannot drift between the two, which is how a route
 * silently loses a control.
 *
 * ORDER MATTERS:
 *
 *   1. derive identity      (from signed fields only)
 *   2. pre-check claim      (cheap; rejects obvious replays before spending gas)
 *   3. settle               (on chain, via the facilitator)
 *   4. claim atomically     (THE authoritative one-payment-one-grant decision)
 *   5. record ledger        (reporting; never blocks a paid-for grant)
 *   6. release the resource (only reached when step 4 returned ok)
 *
 * The resource is never released on the strength of verification alone, and
 * never on the strength of settlement alone: settlement without a successful
 * claim is exactly the replay window this pipeline exists to close.
 */

import { logger } from "@/lib/server/secure-logger";
import {
  X402_PAID_CONTENT_CACHE_CONTROL,
  X402_PAYMENT_CACHE_CONTROL,
  getX402HttpServer,
  buildX402Response,
  recordX402Payment,
  type X402PaymentVerifiedResult,
} from "@/lib/server/x402-server";
import {
  claimX402Payment,
  countPayerClaimsSince,
  deriveX402PaymentIdentity,
  isX402PaymentClaimed,
  startOfUtcDay,
  x402OrderRef,
  type X402PaymentIdentity,
} from "@/lib/server/x402-payment-guard";

export type X402FulfilOutcome =
  | {
      ok: true;
      /** Settlement headers to attach to the granted response. */
      headers: Record<string, string>;
      transaction: string;
      identity: X402PaymentIdentity;
    }
  | {
      ok: false;
      /** Response to return instead of the resource. */
      response: Response;
    };

/** Builds a JSON error response that is never cacheable. */
function jsonNoStore(
  status: number,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": X402_PAYMENT_CACHE_CONTROL,
  });

  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * The client already presented a payment that has been consumed.
 *
 * Answered with 409, not 402, on purpose: returning 402 would make a compliant
 * x402 agent construct and sign a SECOND payment for a resource it has already
 * paid for. 409 tells the caller the payment was real but is spent, so it stops
 * rather than paying twice.
 */
function replayResponse(params: {
  requestedResource: string;
  claimedResource?: string;
  identity: string;
}): Response {
  return jsonNoStore(409, {
    error: "This payment has already been used.",
    code: "payment_already_consumed",
    resource: params.requestedResource,
    reason:
      "Each x402 authorization settles exactly one request. Sign a new payment to access this resource again.",
  });
}

type MachineBudget =
  | { ok: true }
  | { ok: false; reason: "exceeded"; used: number }
  | { ok: false; reason: "unattributable" | "unavailable" };

/**
 * Evaluates the daily per-payer machine request cap.
 *
 * The count is read from the claims table, which already records one row per
 * consumed payment, so no additional ledger is required.
 *
 * Race note: the count is read immediately before settlement and the claim is
 * written immediately after, so N concurrent requests from one payer can
 * overshoot the cap by at most the concurrency of that burst. This is a quota,
 * not a security boundary — replay protection is enforced atomically by the
 * claim's PRIMARY KEY and is not affected.
 */
async function checkMachineDailyBudget(
  payer: string | null,
  cap: number
): Promise<MachineBudget> {
  if (cap <= 0) return { ok: true };

  if (!payer) {
    // A well-formed EVM exact payment always carries a payer in its signed
    // authorization, so an absent payer means the payload shape was not
    // recognised. Refuse rather than grant unmetered access.
    return { ok: false, reason: "unattributable" };
  }

  try {
    const used = await countPayerClaimsSince(payer, startOfUtcDay());
    return used >= cap ? { ok: false, reason: "exceeded", used } : { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** Reads the optional `payment-identifier` extension id, for correlation only. */
function extractPaymentIdHint(paymentPayload: unknown): string | null {
  if (!paymentPayload || typeof paymentPayload !== "object") return null;
  const extensions = (paymentPayload as { extensions?: unknown }).extensions;
  if (!extensions || typeof extensions !== "object") return null;

  const declaration = (extensions as Record<string, unknown>)["payment-identifier"];
  if (!declaration || typeof declaration !== "object") return null;

  const info = (declaration as { info?: unknown }).info;
  if (!info || typeof info !== "object") return null;

  const id = (info as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/**
 * Outcome of the on-chain settlement step.
 *
 * Mirrors the shape returned by the x402 resource server's `processSettlement`
 * so the real implementation drops straight in.
 */
export type X402SettlementOutcome = {
  success: boolean;
  transaction?: string;
  headers?: Record<string, string>;
  response?: { status: number; headers: Record<string, string>; body?: unknown };
};

/**
 * Performs the on-chain settlement. Injectable so the ordering guarantees of
 * this pipeline (settle before claim, no grant without a claim) can be tested
 * without a facilitator or a funded wallet.
 */
export type X402SettlementStep = (
  verified: X402PaymentVerifiedResult
) => Promise<X402SettlementOutcome>;

const defaultSettlementStep: X402SettlementStep = async (verified) => {
  const server = await getX402HttpServer();
  return server.processSettlement(
    verified.paymentPayload,
    verified.paymentRequirements,
    verified.declaredExtensions
  );
};

export interface FulfilX402PaymentParams {
  /** Result of `processX402Request` when the payment verified. */
  verified: X402PaymentVerifiedResult;
  /**
   * The exact resource being bought. Recorded on the claim, and the basis for
   * cross-resource replay detection.
   */
  resourceKey: string;
  /** Price of this route, used for the reporting ledger. */
  amountUsd: string;
  /** Route label for logs and the ledger. */
  route: string;
  /**
   * Enforce the daily per-payer machine request cap before settling.
   *
   * Machine callers have no `auth.users` row, so the human AI ledger cannot
   * meter them (and attempting it makes the route fail after payment has
   * already settled — a systematic paid-but-denied). When enabled, the cap is
   * evaluated against the claims table BEFORE settlement so an over-budget
   * caller is refused without being charged.
   */
  enforceMachineDailyCap?: number;
  /** Settlement implementation; defaults to the facilitator. */
  settle?: X402SettlementStep;
}

/**
 * Settles the payment, consumes it atomically, and reports the result.
 *
 * Returns `ok: true` ONLY when the payment has been settled AND consumed. Any
 * other outcome returns a response the caller must send instead of the
 * resource.
 */
export async function fulfilX402Payment(
  params: FulfilX402PaymentParams
): Promise<X402FulfilOutcome> {
  const { verified, resourceKey, amountUsd, route, enforceMachineDailyCap } = params;
  const settle = params.settle ?? defaultSettlementStep;

  const identity = deriveX402PaymentIdentity(
    verified.paymentPayload,
    verified.paymentRequirements
  );

  // ---- 2. Cheap replay pre-check (never the granting decision) ----------
  if (await isX402PaymentClaimed(identity.identity)) {
    logger.error("SECURITY: x402 replay rejected before settlement", {
      route,
      resourceKey,
      identity: identity.identity.slice(0, 16),
      payer: identity.payer,
    });

    return {
      ok: false,
      response: replayResponse({
        requestedResource: resourceKey,
        identity: identity.identity,
      }),
    };
  }

  // ---- 2b. Machine daily budget, evaluated BEFORE settlement ------------
  // Refusing an over-budget caller here means it is never charged. Checking
  // after settlement would bill the caller for a request we then reject.
  if (enforceMachineDailyCap !== undefined) {
    const budget = await checkMachineDailyBudget(identity.payer, enforceMachineDailyCap);

    if (!budget.ok) {
      if (budget.reason === "exceeded") {
        logger.warn("x402 machine daily cap reached", {
          route,
          payer: identity.payer,
          cap: enforceMachineDailyCap,
          used: budget.used,
        });

        return {
          ok: false,
          response: jsonNoStore(
            429,
            {
              error: "Daily machine request limit reached. Please retry tomorrow.",
              code: "machine_daily_limit",
              limit: enforceMachineDailyCap,
            },
            { "Retry-After": "3600" }
          ),
        };
      }

      // Unattributable payer or unreadable budget: fail closed without charging.
      logger.error("x402 machine budget could not be evaluated — refusing to settle", {
        route,
        reason: budget.reason,
        payer: identity.payer,
      });

      return {
        ok: false,
        response: jsonNoStore(
          503,
          {
            error: "Payment guard temporarily unavailable.",
            code: "payment_guard_unavailable",
            retryable: true,
          },
          { "Retry-After": "5" }
        ),
      };
    }
  }

  // ---- 3. Settle on chain ----------------------------------------------
  const settleResult = await settle(verified);

  if (!settleResult.success || !settleResult.transaction) {
    // Settlement failed (nonce already consumed on chain, expired window,
    // insufficient balance, ...). Surface the protocol's own 402 response.
    return {
      ok: false,
      response: buildX402Response({
        response: settleResult.response ?? {
          status: 402,
          headers: { "Cache-Control": X402_PAYMENT_CACHE_CONTROL },
          body: { error: "Payment could not be settled.", code: "settlement_failed" },
        },
      }),
    };
  }

  // ---- 4. Consume the payment (authoritative) ---------------------------
  const claim = await claimX402Payment({
    identity,
    resourceKey,
    transactionHash: settleResult.transaction,
    paymentIdHint: extractPaymentIdHint(verified.paymentPayload),
  });

  if (!claim.ok) {
    if (claim.reason === "replay") {
      // Settlement reported success but the authorization was already spent.
      // This is the signature of a facilitator that is not authoritative for
      // single-use. The resource must NOT be released.
      return {
        ok: false,
        response: replayResponse({
          requestedResource: resourceKey,
          claimedResource: claim.claimedResource,
          identity: claim.identity,
        }),
      };
    }

    // The guard could not prove single-use. Fail closed: the payer may retry
    // with a fresh authorization, which is strictly better than granting an
    // unbounded number of times.
    return {
      ok: false,
      response: jsonNoStore(
        503,
        {
          error: "Payment guard temporarily unavailable.",
          code: "payment_guard_unavailable",
          retryable: true,
        },
        { "Retry-After": "5" }
      ),
    };
  }

  // ---- 5. Reporting ledger (best effort, never blocks a paid grant) -----
  await recordX402Payment({
    orderRef: x402OrderRef(identity.identity),
    amountUsd,
    network: verified.paymentRequirements.network,
    payerAddress: identity.payer ?? undefined,
    transactionHash: settleResult.transaction,
    status: "paid",
    route,
    resourceKey,
  });

  // ---- 6. Hand back settlement headers ---------------------------------
  return {
    ok: true,
    headers: settleResult.headers ?? {},
    transaction: settleResult.transaction,
    identity,
  };
}

/** Convenience re-exports so routes can set cache policy without extra imports. */
export { X402_PAID_CONTENT_CACHE_CONTROL, X402_PAYMENT_CACHE_CONTROL };
