/**
 * What one x402 payment actually buys.
 *
 * `X402_ROUTE_PRICES.aiResearch` is $0.05 per request. The machine daily cap
 * bounds how *many* requests a paying bot may make; nothing bounded how *large*
 * each one could be, because `responseMode` and `maxTokens` both arrive in the
 * caller's own request body and were passed straight through to the router.
 *
 * At the published provider rates (NVIDIA NIM, Sep–Oct 2026):
 *
 *   Max      — Kimi K3, $3/M in, $15/M out:
 *              3,000 in + 12,000 out ≈ $0.189  → 3.8× the $0.05 price
 *              10,000 in + 12,000 out ≈ $0.210 → 4.2× the price
 *   Thorough — GLM-5.3-Flash, $0.15/M in, $0.50/M out:
 *              10,000 in + 8,000 out ≈ $0.0055 → 89% margin
 *
 * So a paying bot could buy ~$0.19 of Kimi K3 inference for $0.05, and at the
 * 60-request daily cap that is ~$8.30 of net loss per bot per day. **No
 * completion length makes $0.05 cover the Max path** — even a near-empty answer
 * on K3 costs more than the price once the prompt is included — so a machine
 * caller is never routed to it. To sell Max to bots, raise
 * `X402_ROUTE_PRICES.aiResearch` and `X402_MACHINE_COMPLETION_CEILING` together
 * and re-do the arithmetic above; `tests/x402-machine-limits.test.ts` asserts
 * the cost bound and will fail if that is done carelessly.
 *
 * The human path is unaffected: it is metered by a 300,000-token daily budget on
 * the token ledger, which is what makes a Max request affordable for a ₹299
 * monthly subscriber.
 */

/** The strongest mode one x402 payment covers. Both modes below run GLM-5.3-Flash. */
export const X402_MACHINE_RESPONSE_MODE = "thorough" as const;

/** Completion ceiling for a paid machine caller, within the $0.05 price. */
export const X402_MACHINE_COMPLETION_CEILING = 8000;

export type AiResponseMode = "quick" | "thorough" | "max";

export type GrantedResponseLimits = {
  responseMode: AiResponseMode;
  maxTokens: number | undefined;
};

/**
 * The mode and token budget a request is actually granted.
 *
 * A machine caller is clamped to what its payment covers; a human caller is
 * passed through untouched, because the token ledger is what bounds them.
 *
 * A *smaller* machine request is honoured, so a bot asking for fewer tokens
 * still gets fewer; a larger one is capped rather than rejected, so it receives
 * the answer its payment buys instead of an error it has already paid for.
 */
export function grantedResponseLimits(
  isMachine: boolean,
  requestedMode: AiResponseMode | undefined,
  requestedMaxTokens: number | undefined
): GrantedResponseLimits {
  if (!isMachine) {
    // Mirrors the request schema's default, and otherwise preserves the exact
    // value the caller sent (including undefined = use the mode ceiling).
    return { responseMode: requestedMode ?? "quick", maxTokens: requestedMaxTokens };
  }

  // The mode is fixed, not downgraded. Honouring "quick" would be cheaper, but
  // it would also leave the caller in control of which model runs, and the
  // point of this clamp is that the price — not the request body — decides the
  // cost. A caller that wants a shorter answer can still ask for fewer tokens,
  // which is honoured here.
  const maxTokens =
    requestedMaxTokens && requestedMaxTokens < X402_MACHINE_COMPLETION_CEILING
      ? requestedMaxTokens
      : X402_MACHINE_COMPLETION_CEILING;

  return { responseMode: X402_MACHINE_RESPONSE_MODE, maxTokens };
}
