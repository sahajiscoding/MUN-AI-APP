import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  X402_MACHINE_COMPLETION_CEILING,
  X402_MACHINE_RESPONSE_MODE,
  grantedResponseLimits,
} from "@/lib/server/x402-machine-limits";

// Published NVIDIA NIM list rates for the two models the router can reach, in
// USD per million tokens. Update these from the provider's pricing page; the
// cost bound below is only as good as they are.
const RATES = {
  "glm-5.3-flash": { in: 0.15, out: 0.5 },
  "kimi-k3": { in: 3, out: 15 },
} as const;

/** The x402 price for one research request, in USD. Mirrors X402_ROUTE_PRICES.aiResearch. */
const X402_AI_RESEARCH_PRICE_USD = 0.05;

/** Largest prompt the request schema can produce: 6,000-char agenda + 36,000-char conversation. */
const WORST_CASE_PROMPT_TOKENS = 10_000;

function inferenceCostUsd(model: keyof typeof RATES, inputTokens: number, outputTokens: number) {
  const rate = RATES[model];
  return (inputTokens / 1e6) * rate.in + (outputTokens / 1e6) * rate.out;
}

describe("grantedResponseLimits — human callers are untouched", () => {
  it("preserves the mode and an explicit token budget", () => {
    assert.deepEqual(grantedResponseLimits("paid", "max", 12000), {
      responseMode: "max",
      maxTokens: 12000,
    });
  });

  it("preserves an undefined token budget so the mode ceiling applies", () => {
    assert.deepEqual(grantedResponseLimits("paid", "quick", undefined), {
      responseMode: "quick",
      maxTokens: undefined,
    });
  });

  it("defaults a missing mode to quick, matching the request schema", () => {
    assert.deepEqual(grantedResponseLimits("paid", undefined, undefined), {
      responseMode: "quick",
      maxTokens: undefined,
    });
  });
});

describe("grantedResponseLimits — machine callers are clamped to what they paid for", () => {
  it("refuses the Max model no matter what the caller asks for", () => {
    // The bug this exists to prevent: a $0.05 payment selecting Kimi K3.
    for (const requested of ["max", "thorough", "quick", undefined] as const) {
      const granted = grantedResponseLimits("machine", requested, 12000);
      assert.equal(granted.responseMode, X402_MACHINE_RESPONSE_MODE);
      assert.notEqual(granted.responseMode, "max");
    }
  });

  it("caps a caller's token request at the paid ceiling", () => {
    assert.equal(grantedResponseLimits("machine", "max", 12000).maxTokens, X402_MACHINE_COMPLETION_CEILING);
    assert.equal(
      grantedResponseLimits("machine", "thorough", 999_999).maxTokens,
      X402_MACHINE_COMPLETION_CEILING
    );
  });

  it("defaults to the paid ceiling when no token budget is requested", () => {
    assert.equal(grantedResponseLimits("machine", "max", undefined).maxTokens, X402_MACHINE_COMPLETION_CEILING);
  });

  it("honours a smaller token request rather than inflating it", () => {
    assert.equal(grantedResponseLimits("machine", "thorough", 1800).maxTokens, 1800);
    assert.equal(grantedResponseLimits("machine", "max", 256).maxTokens, 256);
  });
});

describe("the x402 price covers the inference it is granted", () => {
  it("keeps worst-case cost for a machine request well under the price", () => {
    const granted = grantedResponseLimits("machine", "max", 12000);
    const cost = inferenceCostUsd(
      "glm-5.3-flash",
      WORST_CASE_PROMPT_TOKENS,
      granted.maxTokens!
    );

    assert.ok(
      cost < X402_AI_RESEARCH_PRICE_USD,
      `granted request costs $${cost.toFixed(4)} against a $${X402_AI_RESEARCH_PRICE_USD} price`
    );
    // A comfortable margin, not a hair's breadth: if a ceiling or a rate change
    // eats it, this fails before the loss reaches production.
    assert.ok(
      cost < X402_AI_RESEARCH_PRICE_USD * 0.5,
      `granted request costs $${cost.toFixed(4)} — over half the $${X402_AI_RESEARCH_PRICE_USD} price`
    );
  });

  it("documents, by assertion, why the Max path must stay closed to machines", () => {
    // This is the arithmetic behind the clamp. If a future change makes Max
    // affordable at this price, this test fails and the ceiling can be raised
    // deliberately — which is the point.
    const maxCost = inferenceCostUsd("kimi-k3", WORST_CASE_PROMPT_TOKENS, 12000);
    assert.ok(
      maxCost > X402_AI_RESEARCH_PRICE_USD,
      `Max now costs only $${maxCost.toFixed(4)} — the clamp can be revisited`
    );

    const dailyLossAtTheRequestCap = 60 * (maxCost - X402_AI_RESEARCH_PRICE_USD);
    assert.ok(dailyLossAtTheRequestCap > 5, "the exposure this clamp removes");
  });
});
