import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "@/lib/payments/uropay";

describe("UroPay Webhook Signature Verification", () => {
  const secret = "test-webhook-secret-key-32-bytes!!";
  const originalSecret = process.env.UROPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.UROPAY_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    process.env.UROPAY_WEBHOOK_SECRET = originalSecret;
  });

  function generateValidSignature(body: string, timestamp: string, nonce: string) {
    const canonical = [
      "POST",
      "/tenant-webhook",
      timestamp,
      nonce,
      "",
      body,
    ].join("\n");

    return createHmac("sha256", secret).update(canonical).digest("hex");
  }

  it("verifies a valid HMAC-SHA256 64-character hex signature", () => {
    const body = JSON.stringify({ event: "order.paid", orderId: "ord_123" });
    const now = String(Math.floor(Date.now() / 1000));
    const nonce = "nonce-abc-123";
    const sig = generateValidSignature(body, now, nonce);

    assert.equal(sig.length, 64);
    const valid = verifyWebhookSignature(
      {
        "x-timestamp": now,
        "x-nonce": nonce,
        "x-signature": sig,
      },
      body
    );

    assert.equal(valid, true);
  });

  describe("Malformed & Non-Hex Signature Hardening", () => {
    it("rejects signatures containing non-hex characters (e.g. g-z)", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "test-nonce";
      // 64 chars, but contains 'z' and 'g'
      const nonHexSig = "z".repeat(32) + "g".repeat(32);

      const valid = verifyWebhookSignature(
        {
          "x-timestamp": now,
          "x-nonce": nonce,
          "x-signature": nonHexSig,
        },
        body
      );
      assert.equal(valid, false);
    });

    it("rejects odd-length signatures (e.g. 63 characters)", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "test-nonce";
      const shortSig = "a".repeat(63);

      const valid = verifyWebhookSignature(
        {
          "x-timestamp": now,
          "x-nonce": nonce,
          "x-signature": shortSig,
        },
        body
      );
      assert.equal(valid, false);
    });

    it("rejects oversized signatures (e.g. 65 characters)", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "test-nonce";
      const longSig = "a".repeat(65);

      const valid = verifyWebhookSignature(
        {
          "x-timestamp": now,
          "x-nonce": nonce,
          "x-signature": longSig,
        },
        body
      );
      assert.equal(valid, false);
    });

    it("rejects signatures with punctuation or null bytes", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "test-nonce";
      const dirtySig = "a".repeat(63) + "!";

      const valid = verifyWebhookSignature(
        {
          "x-timestamp": now,
          "x-nonce": nonce,
          "x-signature": dirtySig,
        },
        body
      );
      assert.equal(valid, false);
    });

    it("rejects empty or missing signature", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));

      assert.equal(
        verifyWebhookSignature(
          { "x-timestamp": now, "x-nonce": "nonce", "x-signature": "" },
          body
        ),
        false
      );

      assert.equal(
        verifyWebhookSignature(
          { "x-timestamp": now, "x-nonce": "nonce" },
          body
        ),
        false
      );
    });

    it("rejects mismatched 64-character hex signature via timing-safe equal", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "test-nonce";
      // 64 valid hex chars, but incorrect HMAC
      const wrongHexSig = "0".repeat(64);

      const valid = verifyWebhookSignature(
        {
          "x-timestamp": now,
          "x-nonce": nonce,
          "x-signature": wrongHexSig,
        },
        body
      );
      assert.equal(valid, false);
    });
  });

  describe("Replay Window and Header Validation", () => {
    it("rejects timestamps outside the 5-minute replay window", () => {
      const body = "{}";
      // 10 minutes ago
      const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 600);
      const nonce = "test-nonce";
      const sig = generateValidSignature(body, expiredTimestamp, nonce);

      const valid = verifyWebhookSignature(
        {
          "x-timestamp": expiredTimestamp,
          "x-nonce": nonce,
          "x-signature": sig,
        },
        body
      );
      assert.equal(valid, false);
    });

    it("rejects invalid non-numeric timestamps", () => {
      const body = "{}";
      const valid = verifyWebhookSignature(
        {
          "x-timestamp": "invalid-timestamp",
          "x-nonce": "test-nonce",
          "x-signature": "a".repeat(64),
        },
        body
      );
      assert.equal(valid, false);
    });
  });
});
