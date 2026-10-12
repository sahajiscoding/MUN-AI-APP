/**
 * What each class of caller is allowed to spend per request.
 *
 * Three classes reach this product's AI route, and they are paying very
 * different amounts for the same button:
 *
 *   paid    — a ₹199/₹299 pass, metered by the 60-request / 300k-token ledger.
 *   trial   — three free days. Unlimited requests (that is the feature), so the
 *             only thing standing between a script and the founder's card is
 *             the per-request cost ceiling below.
 *   machine — one $0.05 x402 payment.
 *
 * ## The machine bound
 *
 * At the published NVIDIA NIM rates (Sep–Oct 2026):
 *
 *   Max      — Kimi K3, $3/M in, $15/M out:
 *              3,000 in + 12,000 out ≈ $0.189  → 3.8× the $0.05 price
 *              10,000 in + 12,000 out ≈ $0.210 → 4.2× the price
 *   Thorough — GLM-5.3-Flash, $0.15/M in, $0.50/M out:
 *              10,000 in + 8,000 out ≈ $0.0055 → 89% margin
 *
 * A paying bot could buy ~$0.19 of Kimi K3 inference for $0.05, and at the
 * 60-request daily cap that is ~$8.30 of net loss per bot per day. **No
 * completion length makes $0.05 cover the Max path**, so a machine caller is
 * never routed to it. To sell Max to bots, raise
 * `X402_ROUTE_PRICES.aiResearch` and `X402_MACHINE_COMPLETION_CEILING` together
 * and re-do the arithmetic; `tests/x402-machine-limits.test.ts` asserts the
 * cost bound and will fail if that is done carelessly.
 *
 * ## The trial bound
 *
 * A trial account has no request cap, so its exposure is
 * `(requests the rate limiter allows) × (cost per request)`. On the cheap model
 * the worst case is bounded by the trial's daily token budget — a million
 * tokens is about ₹44/day even if every one of them were output. On Kimi K3 the
 * same million tokens is about ₹1,320/day, which is why **Max is a paid-plan
 * feature and is downgraded during the trial**. That does not cost the trial
 * anything in experience: the workspace defaults to Quick.
 *
 * The human paid path is unaffected: the 300,000-token daily budget is what
 * makes a Max request affordable for a subscriber who has actually paid.
 */

/** The strongest mode one x402 payment covers. Both modes below run GLM-5.3-Flash. */
export const X402_MACHINE_RESPONSE_MODE = "thorough" as const;

/** Completion ceiling for a paid machine caller, within the $0.05 price. */
export const X402_MACHINE_COMPLETION_CEILING = 8000;

/** The strongest mode the free trial covers. Max runs Kimi K3 and is paid-only. */
export const TRIAL_MAX_RESPONSE_MODE = "thorough" as const;

export type AiAccessKind = "paid" | "trial" | "machine";

export type AiResponseMode = "quick" | "thorough" | "max";

export type GrantedResponseLimits = {
  responseMode: AiResponseMode;
  maxTokens: number | undefined;
};

/**
 * The mode and token budget a request is actually granted.
 *
 * A *smaller* request is always honoured, so a caller asking for fewer tokens
 * still gets fewer; a larger one is capped rather than rejected, so a caller
 * receives the answer its access level buys instead of an error.
 */
export function grantedResponseLimits(
  kind: AiAccessKind,
  requestedMode: AiResponseMode | undefined,
  requestedMaxTokens: number | undefined
): GrantedResponseLimits {
  if (kind === "paid") {
    // Mirrors the request schema's default, and otherwise preserves the exact
    // value the caller sent (including undefined = use the mode ceiling).
    return { responseMode: requestedMode ?? "quick", maxTokens: requestedMaxTokens };
  }

  if (kind === "trial") {
    return {
      // Quick and Thorough are honoured; Max is downgraded, not rejected, so a
      // triallist who taps the premium toggle still gets a complete answer.
      responseMode:
        requestedMode === "max"
          ? TRIAL_MAX_RESPONSE_MODE
          : requestedMode ?? "quick",
      maxTokens: requestedMaxTokens,
    };
  }

  // Machine. The mode is fixed, not downgraded: honouring "quick" would be
  // cheaper, but it would also leave the caller in control of which model runs,
  // and the point of this clamp is that the price — not the request body —
  // decides the cost. A caller that wants a shorter answer can still ask for
  // fewer tokens, which is honoured here.
  const maxTokens =
    requestedMaxTokens && requestedMaxTokens < X402_MACHINE_COMPLETION_CEILING
      ? requestedMaxTokens
      : X402_MACHINE_COMPLETION_CEILING;

  return { responseMode: X402_MACHINE_RESPONSE_MODE, maxTokens };
}
