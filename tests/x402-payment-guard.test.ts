import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  claimX402Payment,
  countPayerClaimsSince,
  deriveX402PaymentIdentity,
  isX402PaymentClaimed,
  resetX402ClaimStoreForTests,
  setX402ClaimStoreForTests,
  startOfUtcDay,
  x402OrderRef,
  type X402ClaimStore,
} from "@/lib/server/x402-payment-guard";
import { fulfilX402Payment } from "@/lib/server/x402-fulfil";
import {
  X402_PAID_CONTENT_CACHE_CONTROL,
  X402_PAYMENT_CACHE_CONTROL,
  applyPaidContentCachePolicy,
  assertValidPayTo,
  processX402Request,
  usdPriceToAtomicUnits,
  type X402PaymentVerifiedResult,
} from "@/lib/server/x402-server";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const PAYER_A = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const PAYER_B = "0x000000000000000000000000000000000000dEaD";
const NONCE_A = "0x1f0f8bcb7ed7cbe9cbe1f0f8bcb7ed7cbe9cbe1f0f8bcb7ed7cbe9cbe1f0f8bc";
const NONCE_B = "0x2a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef";
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/**
 * Builds a payment payload in the EIP-3009 shape the `exact` scheme produces.
 * `overrides` lets a test mutate anything the client controls.
 */
function eip3009Payload(overrides: Record<string, unknown> = {}) {
  return {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    signature: "0xdeadbeef",
    payload: {
      signature: "0xdeadbeef",
      authorization: {
        from: PAYER_A,
        to: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
        value: "5000",
        validAfter: "0",
        validBefore: "9999999999",
        nonce: NONCE_A,
      },
    },
    ...overrides,
  };
}

function paymentRequirements(overrides: Record<string, unknown> = {}) {
  return {
    scheme: "exact",
    network: "eip155:84532",
    asset: USDC_BASE_SEPOLIA,
    payTo: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    maxAmountRequired: "5000",
    amount: "5000",
    resource: "https://mun-prep.example/api/x402/content?resource=courses",
    description: "MUN prep content",
    ...overrides,
  };
}

function verifiedResult(overrides: {
  paymentPayload?: unknown;
  paymentRequirements?: unknown;
} = {}): X402PaymentVerifiedResult {
  return {
    type: "payment-verified",
    paymentPayload: overrides.paymentPayload ?? eip3009Payload(),
    paymentRequirements: overrides.paymentRequirements ?? paymentRequirements(),
    declaredExtensions: {},
  } as unknown as X402PaymentVerifiedResult;
}

/** A settlement step that always succeeds, recording how often it was called. */
function succeedingSettler() {
  const calls: unknown[] = [];
  return {
    calls,
    step: async (verified: X402PaymentVerifiedResult) => {
      calls.push(verified.paymentPayload);
      return {
        success: true,
        transaction: "0xsettled",
        headers: { "PAYMENT-RESPONSE": "settled" },
      };
    },
  };
}

/** A store whose every operation fails, standing in for an unreachable database. */
const brokenStore: X402ClaimStore = {
  async insert() {
    throw new Error("connection refused");
  },
  async lookup() {
    throw new Error("connection refused");
  },
  async countSince() {
    throw new Error("connection refused");
  },
};

beforeEach(() => {
  resetX402ClaimStoreForTests();
});

afterEach(() => {
  resetX402ClaimStoreForTests();
});

/* ------------------------------------------------------------------ */
/* Identity derivation                                                 */
/* ------------------------------------------------------------------ */

describe("x402 payment identity", () => {
  it("is deterministic for the same signed authorization", () => {
    const first = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());
    const second = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());

    assert.equal(first.identity, second.identity);
    assert.equal(first.identity.length, 64);
    assert.equal(first.payer, PAYER_A);
    assert.equal(first.nonce, NONCE_A);
    assert.equal(first.strong, true);
  });

  it("cannot be reused across a different nonce or payer", () => {
    const base = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());

    const otherNonce = deriveX402PaymentIdentity(
      eip3009Payload({
        payload: {
          signature: "0xdeadbeef",
          authorization: {
            from: PAYER_A,
            value: "5000",
            nonce: NONCE_B,
          },
        },
      }),
      paymentRequirements()
    );

    const otherPayer = deriveX402PaymentIdentity(
      eip3009Payload({
        payload: {
          signature: "0xdeadbeef",
          authorization: { from: PAYER_B, value: "5000", nonce: NONCE_A },
        },
      }),
      paymentRequirements()
    );

    assert.notEqual(base.identity, otherNonce.identity);
    assert.notEqual(base.identity, otherPayer.identity);
  });

  it("ignores client-supplied resource metadata", () => {
    // The reference middleware never compares the client's claimed resource to
    // the route actually served, so a payment bought for one URL could be
    // replayed at another. Identity must not be derived from those fields.
    const base = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());

    const rewritten = deriveX402PaymentIdentity(
      eip3009Payload({
        resource: "https://attacker.example/api/x402/content?resource=courses",
        description: "totally different",
        accepted: { extra: { mutated: true } },
      }),
      paymentRequirements({
        resource: "https://attacker.example/other",
        description: "totally different",
      })
    );

    assert.equal(base.identity, rewritten.identity);
  });

  it("distinguishes networks and assets", () => {
    const base = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());
    const otherChain = deriveX402PaymentIdentity(
      eip3009Payload(),
      paymentRequirements({ network: "eip155:8453" })
    );
    const otherAsset = deriveX402PaymentIdentity(
      eip3009Payload(),
      paymentRequirements({ asset: "0x0000000000000000000000000000000000000000" })
    );

    assert.notEqual(base.identity, otherChain.identity);
    assert.notEqual(base.identity, otherAsset.identity);
  });

  it("falls back to a payload hash for unrecognised shapes without throwing", () => {
    const weird = deriveX402PaymentIdentity(
      { x402Version: 2, scheme: "exact", payload: { somethingElse: true } },
      paymentRequirements()
    );

    assert.equal(weird.strong, false);
    assert.equal(weird.payer, null);
    assert.equal(weird.identity.length, 64);

    // Stable across calls, so byte-identical replays are still rejected.
    const again = deriveX402PaymentIdentity(
      { x402Version: 2, scheme: "exact", payload: { somethingElse: true } },
      paymentRequirements()
    );
    assert.equal(weird.identity, again.identity);
  });

  it("derives a deterministic ledger reference", () => {
    const { identity } = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());
    assert.equal(x402OrderRef(identity), `x402-${identity.slice(0, 40)}`);
    assert.ok(x402OrderRef(identity).length <= 255);
  });
});

/* ------------------------------------------------------------------ */
/* Claim store                                                         */
/* ------------------------------------------------------------------ */

describe("x402 payment claim store", () => {
  it("consumes an authorization exactly once", async () => {
    const identity = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());

    const first = await claimX402Payment({ identity, resourceKey: "content:courses" });
    assert.equal(first.ok, true);

    const second = await claimX402Payment({ identity, resourceKey: "content:courses" });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.reason, "replay");
      assert.equal(second.claimedResource, "content:courses");
    }
  });

  it("grants exactly one claim under concurrency", async () => {
    const identity = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        claimX402Payment({ identity, resourceKey: "content:courses" })
      )
    );

    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 11);
  });

  it("reports a claimed payment and counts it per payer", async () => {
    const identity = deriveX402PaymentIdentity(eip3009Payload(), paymentRequirements());
    assert.equal(await isX402PaymentClaimed(identity.identity), false);

    await claimX402Payment({ identity, resourceKey: "content:courses" });
    assert.equal(await isX402PaymentClaimed(identity.identity), true);

    assert.equal(await countPayerClaimsSince(PAYER_A, startOfUtcDay()), 1);
    assert.equal(await countPayerClaimsSince(PAYER_B, startOfUtcDay()), 0);
    // A window that ends in the future excludes the claim.
    assert.equal(await countPayerClaimsSince(PAYER_A, new Date(Date.now() + 60_000)), 0);
  });
});

/* ------------------------------------------------------------------ */
/* Fulfilment pipeline                                                 */
/* ------------------------------------------------------------------ */

describe("x402 fulfilment pipeline", () => {
  it("grants once and reports settlement headers", async () => {
    const settler = succeedingSettler();

    const outcome = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "content:courses",
      amountUsd: "0.005",
      route: "/api/x402/content",
      settle: settler.step,
    });

    assert.equal(outcome.ok, true);
    assert.equal(settler.calls.length, 1);
    if (outcome.ok) {
      assert.equal(outcome.transaction, "0xsettled");
      assert.equal(outcome.headers["PAYMENT-RESPONSE"], "settled");
      assert.equal(outcome.identity.payer, PAYER_A);
    }
  });

  it("refuses a replay before spending gas", async () => {
    const settler = succeedingSettler();
    const first = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "content:courses",
      amountUsd: "0.005",
      route: "/api/x402/content",
      settle: settler.step,
    });
    assert.equal(first.ok, true);

    const replay = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "content:courses",
      amountUsd: "0.005",
      route: "/api/x402/content",
      settle: settler.step,
    });

    assert.equal(replay.ok, false);
    // The replay was caught by the pre-check, so no second settlement ran.
    assert.equal(settler.calls.length, 1);

    if (!replay.ok) {
      assert.equal(replay.response.status, 409);
      assert.equal(replay.response.headers.get("Cache-Control"), X402_PAYMENT_CACHE_CONTROL);
      const body = await replay.response.json();
      assert.equal(body.code, "payment_already_consumed");
    }
  });

  it("withholds the resource when settlement succeeds but the claim is taken", async () => {
    // The non-authoritative-facilitator case: /settle reports success for an
    // authorization that has already been consumed, and the cheap pre-check
    // misses (stale replica, or a race between the two requests). Only the
    // authoritative claim can catch this, and it must.
    const seen = new Set<string>();
    setX402ClaimStoreForTests({
      async insert(record) {
        if (seen.has(record.paymentIdentity)) return "duplicate";
        seen.add(record.paymentIdentity);
        return "inserted";
      },
      async lookup() {
        return null; // pre-check always misses
      },
      async countSince() {
        return 0;
      },
    });

    const settler = succeedingSettler();

    const first = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "content:courses",
      amountUsd: "0.005",
      route: "/api/x402/content",
      settle: settler.step,
    });
    assert.equal(first.ok, true);

    const second = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "content:courses",
      amountUsd: "0.005",
      route: "/api/x402/content",
      settle: settler.step,
    });

    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.response.status, 409);
      const body = await second.response.json();
      assert.equal(body.code, "payment_already_consumed");
    }
  });

  it("surfaces a 402 when settlement fails", async () => {
    const outcome = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "content:courses",
      amountUsd: "0.005",
      route: "/api/x402/content",
      settle: async () => ({ success: false }),
    });

    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.response.status, 402);
      assert.equal(outcome.response.headers.get("Cache-Control"), X402_PAYMENT_CACHE_CONTROL);
    }
  });

  it("fails closed without granting when the claim store is unreachable", async () => {
    setX402ClaimStoreForTests(brokenStore);

    const outcome = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "content:courses",
      amountUsd: "0.005",
      route: "/api/x402/content",
      settle: succeedingSettler().step,
    });

    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.response.status, 503);
      const body = await outcome.response.json();
      assert.equal(body.code, "payment_guard_unavailable");
      assert.equal(body.retryable, true);
    }
  });

  it("refuses an over-budget machine caller before charging it", async () => {
    let settled = 0;
    const settle = async () => {
      settled++;
      return { success: true, transaction: "0xsettled", headers: {} };
    };

    /** A distinct authorization from the same payer, so only the cap applies. */
    const nthPayment = (n: number) =>
      verifiedResult({
        paymentPayload: eip3009Payload({
          payload: {
            signature: `0xsignature-${n}`,
            authorization: { from: PAYER_A, value: "5000", nonce: `0xnonce-${n}` },
          },
        }),
      });

    const call = (n: number) =>
      fulfilX402Payment({
        verified: nthPayment(n),
        resourceKey: "ai-research",
        amountUsd: "0.05",
        route: "/api/ai/research",
        enforceMachineDailyCap: 2,
        settle,
      });

    // Two payments fit inside the cap of 2.
    assert.equal((await call(1)).ok, true);
    assert.equal((await call(2)).ok, true);
    assert.equal(settled, 2);

    const capped = await call(3);

    assert.equal(capped.ok, false);
    if (!capped.ok) {
      assert.equal(capped.response.status, 429);
      const body = await capped.response.json();
      assert.equal(body.code, "machine_daily_limit");
    }
    // Critically: the over-budget request was refused WITHOUT being charged.
    assert.equal(settled, 2);
  });

  it("refuses an unattributable payer rather than granting unmetered", async () => {
    let settled = 0;
    const outcome = await fulfilX402Payment({
      verified: verifiedResult({
        paymentPayload: { x402Version: 2, scheme: "exact", payload: { unknown: true } },
      }),
      resourceKey: "ai-research",
      amountUsd: "0.05",
      route: "/api/ai/research",
      enforceMachineDailyCap: 60,
      settle: async () => {
        settled++;
        return { success: true, transaction: "0xsettled", headers: {} };
      },
    });

    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.response.status, 503);
    }
    assert.equal(settled, 0);
  });

  it("fails closed when the budget cannot be read", async () => {
    setX402ClaimStoreForTests(brokenStore);

    const outcome = await fulfilX402Payment({
      verified: verifiedResult(),
      resourceKey: "ai-research",
      amountUsd: "0.05",
      route: "/api/ai/research",
      enforceMachineDailyCap: 60,
      settle: succeedingSettler().step,
    });

    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.response.status, 503);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Route configuration                                                 */
/* ------------------------------------------------------------------ */

describe("x402 payout address validation", () => {
  it("accepts a real merchant address", () => {
    assert.equal(assertValidPayTo(PAYER_A), PAYER_A);
    assert.equal(assertValidPayTo(`  ${PAYER_A}  `), PAYER_A);
  });

  it("rejects the placeholder and zero addresses", () => {
    // 0x…0001 was the shipped default, and it silently swallowed payments.
    assert.throws(() => assertValidPayTo("0x0000000000000000000000000000000000000001"));
    assert.throws(() => assertValidPayTo("0x0000000000000000000000000000000000000002"));
    assert.throws(() => assertValidPayTo("0x0000000000000000000000000000000000000000"));
    assert.throws(() => assertValidPayTo(undefined));
    assert.throws(() => assertValidPayTo(""));
    assert.throws(() => assertValidPayTo("not-an-address"));
    assert.throws(() => assertValidPayTo("0x123"));
  });
});

describe("x402 cache policy", () => {
  it("marks granted content non-cacheable", () => {
    const response = applyPaidContentCachePolicy(Response.json({ course: "mun-basics" }));

    // `no-store` keeps the bought body out of every shared cache. `no-cache`
    // would still permit a CDN to store it and revalidate.
    assert.equal(response.headers.get("Cache-Control"), X402_PAID_CONTENT_CACHE_CONTROL);
    assert.match(X402_PAID_CONTENT_CACHE_CONTROL, /no-store/);
    assert.match(X402_PAID_CONTENT_CACHE_CONTROL, /private/);
  });

  it("keeps negotiation traffic non-cacheable too", () => {
    assert.equal(X402_PAYMENT_CACHE_CONTROL, "no-store");
  });
});

describe("x402 USD to atomic unit conversion", () => {
  it("converts route prices to 6-decimal USDC units", () => {
    assert.equal(usdPriceToAtomicUnits("0.005"), 5000);
    assert.equal(usdPriceToAtomicUnits("$0.005"), 5000);
    assert.equal(usdPriceToAtomicUnits("0.05"), 50000);
    assert.equal(usdPriceToAtomicUnits("1"), 1000000);
    assert.equal(usdPriceToAtomicUnits("1.5"), 1500000);
  });

  it("rejects malformed or non-positive prices", () => {
    assert.throws(() => usdPriceToAtomicUnits("0"));
    assert.throws(() => usdPriceToAtomicUnits("abc"));
    assert.throws(() => usdPriceToAtomicUnits("1.1234567"));
    assert.throws(() => usdPriceToAtomicUnits("-1"));
  });
});

/* ------------------------------------------------------------------ */
/* Misconfiguration must not serve the resource                        */
/* ------------------------------------------------------------------ */

describe("x402 route misconfiguration", () => {
  const originalPayTo = process.env.X402_PAY_TO;

  afterEach(() => {
    if (originalPayTo === undefined) delete process.env.X402_PAY_TO;
    else process.env.X402_PAY_TO = originalPayTo;
    resetX402ClaimStoreForTests();
  });

  it("returns a named 503 rather than an opaque 500 when no payout address is set", async () => {
    delete process.env.X402_PAY_TO;
    // Reset the cached server so configuration is re-read.
    resetX402ClaimStoreForTests();

    const request = new Request("https://mun-prep.local/api/x402/content?resource=courses", {
      method: "GET",
      headers: { "User-Agent": "ClaudeBot/1.0" },
    });

    const error = await processX402Request(request, "/api/x402/content", "GET").then(
      () => null,
      (thrown: unknown) => thrown
    );

    assert.ok(error, "expected the route to refuse");
    assert.equal((error as { status?: number }).status, 503);
    assert.equal((error as { code?: string }).code, "payment_rail_misconfigured");
  });
});
