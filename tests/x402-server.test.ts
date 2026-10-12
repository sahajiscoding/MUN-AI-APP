import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getX402Config,
  getX402HttpServer,
  createWebAdapter,
  processX402Request,
  buildX402Response,
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
});
