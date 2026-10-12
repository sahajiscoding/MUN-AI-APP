import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  FREE_TRIAL_DAYS,
  FREE_TRIAL_PLAN_ID,
  canonicalPlanId,
  freeTrialPlan,
  getPlan,
  getPlanForDisplay,
  isTrialPlanId,
  plans,
} from "@/lib/plans";
import {
  ensureTrialEntitlement,
  freeTrialDays,
  isTrialEntitlement,
  trialDailyTokenCap,
  trialUsageLimits,
} from "@/lib/server/trial";
import { grantedResponseLimits } from "@/lib/server/x402-machine-limits";

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.AI_FREE_TRIAL_DAYS;
  delete process.env.AI_TRIAL_DAILY_TOKEN_CAP;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("the free trial is a plan an account can BE on, but never one it can BUY", () => {
  // The load-bearing assertion of this whole feature. `create-order` resolves
  // the amount it charges through getPlan(), so if this ever returns a plan the
  // ₹0 trial becomes a purchasable ₹0 order — a free-access hole, not a bug.
  it("does not resolve through the checkout resolver", () => {
    assert.equal(getPlan(FREE_TRIAL_PLAN_ID), undefined);
    assert.equal(getPlan("trial"), undefined);
    assert.equal(getPlan("TRIAL"), undefined);
    assert.equal(getPlan(" free-trial "), undefined);
  });

  it("resolves through the display resolver, so the UI can name it", () => {
    assert.equal(getPlanForDisplay(FREE_TRIAL_PLAN_ID)?.name, "Free Trial");
    assert.equal(getPlanForDisplay("trial"), undefined, "no loose 'trial' alias");
  });

  it("is absent from the purchasable catalogue, which is what the paywall renders", () => {
    assert.equal(plans.length, 2);
    assert.ok(
      !plans.some((plan) => plan.id === FREE_TRIAL_PLAN_ID),
      "a ₹0 plan in the catalogue would render a Buy button nobody should be able to press"
    );
    for (const plan of plans) {
      assert.ok(plan.amount > 0, `${plan.id} must cost money`);
    }
  });

  it("identifies trial plan ids, including the stored alias", () => {
    assert.equal(isTrialPlanId("free-trial"), true);
    assert.equal(isTrialPlanId("free-trial"), true);
    assert.equal(isTrialPlanId("weekly-pass"), false);
    assert.equal(isTrialPlanId(null), false);
    assert.equal(canonicalPlanId("free-trial"), FREE_TRIAL_PLAN_ID);
  });

  it("keeps the published trial length at three days", () => {
    assert.equal(FREE_TRIAL_DAYS, 3);
    assert.equal(freeTrialPlan.accessDays, 3);
    assert.equal(freeTrialPlan.amount, 0);
  });
});

describe("trial usage limits — unlimited requests, bounded cost", () => {
  it("lifts the request cap (0 means unlimited to reserve_ai_usage)", () => {
    assert.deepEqual(trialUsageLimits(), { requestCap: 0, tokenCap: 1_000_000 });
    // Resolved with ?? not ||, so the deliberate 0 survives. If this ever
    // became a truthiness check the trial would silently re-inherit the
    // 60-request paid cap and stop being unlimited.
    assert.equal(trialUsageLimits().requestCap ?? 60, 0);
  });

  it("keeps a finite daily token ceiling so cost stays bounded", () => {
    const cap = trialDailyTokenCap();
    assert.ok(Number.isFinite(cap) && cap > 0, "an unbounded trial is an unbounded bill");
    assert.ok(cap >= 300_000, "the ceiling must not be tighter than the paid plan");
  });

  it("honours an environment override", () => {
    process.env.AI_TRIAL_DAILY_TOKEN_CAP = "250000";
    assert.equal(trialDailyTokenCap(), 250_000);
    assert.equal(trialUsageLimits().tokenCap, 250_000);
  });

  it("rejects nonsense and out-of-range overrides rather than trusting them", () => {
    process.env.AI_TRIAL_DAILY_TOKEN_CAP = "not-a-number";
    assert.equal(trialDailyTokenCap(), 1_000_000);

    process.env.AI_TRIAL_DAILY_TOKEN_CAP = "0";
    // Floored well above the ~18,000 tokens a single request reserves: a lower
    // ceiling would make every trial request fail rather than reduce usage.
    assert.equal(trialDailyTokenCap(), 100_000, "floored, never zero/unlimited");

    process.env.AI_TRIAL_DAILY_TOKEN_CAP = "999999999999";
    assert.equal(trialDailyTokenCap(), 5_000_000, "capped");
  });

  it("keeps the trial length inside the range the grant RPC accepts", () => {
    assert.equal(freeTrialDays(), 3);

    process.env.AI_FREE_TRIAL_DAYS = "10";
    assert.equal(freeTrialDays(), 10);

    // The RPC raises on <1 or >30, so a bad env value must be clamped before it
    // reaches Postgres — otherwise every trial grant would throw.
    process.env.AI_FREE_TRIAL_DAYS = "3650";
    assert.equal(freeTrialDays(), 30);

    process.env.AI_FREE_TRIAL_DAYS = "0";
    assert.equal(freeTrialDays(), 1);

    process.env.AI_FREE_TRIAL_DAYS = "banana";
    assert.equal(freeTrialDays(), 3);
  });
});

describe("recognising a trial entitlement", () => {
  it("is a trial only while active and on the trial plan", () => {
    assert.equal(isTrialEntitlement({ status: "active", planId: "free-trial" }), true);
    assert.equal(isTrialEntitlement({ status: "active", planId: "weekly-pass" }), false);
    assert.equal(isTrialEntitlement({ status: "active", planId: "admin" }), false);
    assert.equal(isTrialEntitlement({ status: "expired", planId: "free-trial" }), false);
    assert.equal(isTrialEntitlement({ status: "inactive", planId: "free-trial" }), false);
    assert.equal(isTrialEntitlement({ status: "active" }), false);
    assert.equal(isTrialEntitlement(null), false);
    assert.equal(isTrialEntitlement(undefined), false);
  });
});

describe("a trial cannot reach the paid model", () => {
  it("downgrades Max instead of refusing it", () => {
    const granted = grantedResponseLimits("trial", "max", 12000);
    assert.equal(granted.responseMode, "thorough");
    assert.notEqual(granted.responseMode, "max");
    // Downgraded, not rejected: the triallist still gets a complete answer.
    assert.equal(granted.maxTokens, 12000);
  });

  it("honours quick and thorough, and a smaller token request", () => {
    assert.equal(grantedResponseLimits("trial", "quick", 1800).responseMode, "quick");
    assert.equal(grantedResponseLimits("trial", "quick", 1800).maxTokens, 1800);
    assert.equal(grantedResponseLimits("trial", "thorough", 8000).responseMode, "thorough");
    assert.equal(grantedResponseLimits("trial", undefined, undefined).responseMode, "quick");
  });

  it("still lets a paying subscriber use Max", () => {
    assert.equal(grantedResponseLimits("paid", "max", 12000).responseMode, "max");
  });

  it("still lets a machine caller through the machine rules, not the trial ones", () => {
    const granted = grantedResponseLimits("machine", "max", 12000);
    assert.equal(granted.responseMode, "thorough");
    assert.equal(granted.maxTokens, 8000);
  });
});

describe("a trial grant never breaks a request", () => {
  it("never throws when the backend is unreachable", async () => {
    // No Supabase credentials in this environment, so the RPC cannot be issued.
    // A paying user must still be able to reach their tools in that case, so the
    // failure has to be swallowed and reported, never propagated.
    const result = await ensureTrialEntitlement("00000000-0000-4000-8000-000000000000");
    assert.equal(result.granted, false);
    assert.equal(result.errored, true);
  });

  it("does not attempt a grant for an empty uid", async () => {
    const result = await ensureTrialEntitlement("");
    assert.equal(result.granted, false);
    assert.equal(result.errored, true);
  });
});
