import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getX402Config,
  getX402HttpServer,
  createWebAdapter,
  processX402Request,
  buildX402Response,
  resetX402HttpServerForTesting,
  X402_ROUTE_PRICES,
} from "@/lib/server/x402-server";
import { decodePaymentRequiredHeader } from "@x402/core/http";

// The route config refuses to build with an unset or placeholder payout address
// (`assertValidPayTo`), so these tests configure a real merchant wallet exactly
// as production must. Without this the suite would silently be exercising the
// placeholder address that used to swallow payments.
const TEST_PAY_TO = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
process.env.X402_PAY_TO ??= TEST_PAY_TO;

describe("x402 Server Integration & Protocol Compliance", () => {
  beforeEach(() => {
    resetX402HttpServerForTesting();
  });
  it("provides valid default configuration", () => {
    const config = getX402Config();
    assert.ok(config.payTo.startsWith("0x"));
    assert.ok(config.network.length > 0);
    assert.ok(config.facilitatorUrl.startsWith("https://"));
  });

  it("constructs and initializes the x402 resource server", async () => {
    const server = await getX402HttpServer();
    assert.ok(server);
    assert.ok(server.requiresPayment);
  });

  it("generates HTTP 402 with PAYMENT-REQUIRED header for unpaid bot request to /api/ai/research", async () => {
    const req = new Request("https://mun-prep.local/api/ai/research", {
      method: "POST",
      headers: {
        "User-Agent": "python-requests/2.31.0",
        Accept: "application/json",
      },
    });

    const result = await processX402Request(req, "/api/ai/research", "POST");
    assert.equal(result.type, "payment-error");

    if (result.type === "payment-error") {
      const response = buildX402Response(result);
      assert.equal(response.status, 402);
      assert.ok(response.headers.has("PAYMENT-REQUIRED"));

      const headerVal = response.headers.get("PAYMENT-REQUIRED");
      assert.ok(headerVal);

      const decoded = decodePaymentRequiredHeader(headerVal);
      assert.equal(decoded.x402Version, 2);
      assert.ok(Array.isArray(decoded.accepts));
      assert.ok(decoded.accepts.length > 0);

      const option = decoded.accepts[0];
      assert.equal(option.scheme, "exact");
      // $0.05 USDC with 6 decimals = 50,000 atomic units
      assert.equal(option.amount, "50000");
      assert.ok(option.asset);
      assert.ok(option.payTo);

      // Verify x402 V2 Extensions on the Payment-Required payload
      // Extensions are declared at the route level and propagated to the decoded response or option
      const extensions = (decoded as unknown as { extensions?: Record<string, unknown> }).extensions ||
        (option as unknown as { extensions?: Record<string, unknown> }).extensions || {};
      
      // Bazaar discovery extension
      assert.ok("bazaar" in extensions, "bazaar extension must be present");
      const bazaar = extensions["bazaar"] as Record<string, unknown>;
      assert.ok(bazaar.schema, "bazaar schema must be defined");
      assert.ok(bazaar.info, "bazaar info must be defined");

      // Builder code attribution extension
      assert.ok("builder-code" in extensions, "builder-code extension must be present");

      // Payment identifier extension
      assert.ok("payment-identifier" in extensions, "payment-identifier extension must be present");

      // Sign-In-With-X extension
      assert.ok("sign-in-with-x" in extensions, "sign-in-with-x extension must be present");
      const siwx = extensions["sign-in-with-x"] as Record<string, unknown>;
      assert.ok(siwx.info, "siwx info must be defined");
      const siwxInfo = siwx.info as Record<string, unknown>;
      assert.ok(typeof siwxInfo.statement === "string");
    }
  });

  it("generates HTTP 402 with PAYMENT-REQUIRED header for unpaid bot request to /api/x402/content", async () => {
    const req = new Request("https://mun-prep.local/api/x402/content?resource=courses", {
      method: "GET",
      headers: {
        "User-Agent": "ClaudeBot/1.0",
        Accept: "application/json",
      },
    });

    const result = await processX402Request(req, "/api/x402/content", "GET");
    assert.equal(result.type, "payment-error");

    if (result.type === "payment-error") {
      const response = buildX402Response(result);
      assert.equal(response.status, 402);
      assert.ok(response.headers.has("PAYMENT-REQUIRED"));

      const decoded = decodePaymentRequiredHeader(response.headers.get("PAYMENT-REQUIRED")!);
      const option = decoded.accepts[0];
      assert.equal(option.scheme, "exact");
      // $0.005 USDC = 5,000 atomic units
      assert.equal(option.amount, "5000");
    }
  });

  it("builds an adapter correctly from Request", () => {
    const req = new Request("https://mun-prep.local/api/test?slug=foo", {
      headers: {
        "X-Custom": "header-val",
        "User-Agent": "curl/8.0",
      },
    });
    const adapter = createWebAdapter(req);
    assert.equal(adapter.getHeader("x-custom"), "header-val");
    assert.equal(adapter.getMethod(), "GET");
    assert.equal(adapter.getUserAgent(), "curl/8.0");
    assert.equal(adapter.getQueryParam?.("slug"), "foo");
  });

  it("handles SIWxStorage lifecycle correctly (nonce generation, verification, and payment tracking)", async () => {
    const { getSIWxStorage } = await import("@/lib/server/x402-server");
    const storage = getSIWxStorage();

    // 1. Nonce generation
    const nonce = await storage.getNonce();
    assert.ok(nonce);
    assert.equal(typeof nonce, "string");
    assert.ok(nonce.length >= 8);

    // 2. Nonce verification (valid first time)
    const isValid = await storage.verifyNonce(nonce);
    assert.equal(isValid, true);

    // 3. Replay attack prevention (nonce must be consumed and rejected second time)
    const isReplay = await storage.verifyNonce(nonce);
    assert.equal(isReplay, false);

    // 4. Payment tracking & verification
    const testAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const testResource = "https://munprep.org/api/ai/research";

    const hasPaidBefore = await storage.hasPaid(testResource, testAddress);
    assert.equal(hasPaidBefore, false);

    await storage.recordPayment(testResource, testAddress);

    const hasPaidAfter = await storage.hasPaid(testResource, testAddress);
    assert.equal(hasPaidAfter, true);
  });

  it("handles payment identifier idempotency caching correctly", async () => {
    const { getCachedPaymentIdResult, setCachedPaymentIdResult } = await import(
      "@/lib/server/x402-server"
    );

    const paymentId = "pid_test_123456789";
    assert.equal(getCachedPaymentIdResult(paymentId), null);

    const sampleResult = { status: "success", research: "MUN UNEP strategy" };
    setCachedPaymentIdResult(paymentId, sampleResult, { "x-custom": "cached" });

    const cached = getCachedPaymentIdResult(paymentId);
    assert.ok(cached);
    assert.deepEqual(cached?.data, sampleResult);
    assert.equal(cached?.headers["x-custom"], "cached");
  });
});

