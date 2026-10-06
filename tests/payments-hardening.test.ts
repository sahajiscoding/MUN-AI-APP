import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyWebhookSignature,
  validateAuthoritativeOrderBinding,
  normalizeStatus,
  getOrderByTenantRef,
} from "@/lib/payments/uropay";

describe("Payment Hardening & Webhook Lifecycle Security", () => {
  const secret = "test-webhook-secret-32-chars-long!";
  const originalSecret = process.env.UROPAY_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.UROPAY_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    process.env.UROPAY_WEBHOOK_SECRET = originalSecret;
  });

  function signPayload(body: string, timestamp: string, nonce: string): string {
    const canonical = ["POST", "/tenant-webhook", timestamp, nonce, "", body].join("\n");
    return createHmac("sha256", secret).update(canonical).digest("hex");
  }

  // =========================================================================
  // Finding 5: Signature Encoding Validation
  // =========================================================================
  describe("Finding 5: Signature Encoding Validation", () => {
    it("accepts strictly 64-hexadecimal-character HMAC-SHA256 signature", () => {
      const body = JSON.stringify({ eventId: "evt_1", status: "PAID" });
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "nonce_123";
      const sig = signPayload(body, now, nonce);

      assert.equal(sig.length, 64);
      assert.equal(/^[0-9a-fA-F]{64}$/.test(sig), true);

      const valid = verifyWebhookSignature(
        { "x-timestamp": now, "x-nonce": nonce, "x-signature": sig },
        body
      );
      assert.equal(valid, true);
    });

    it("rejects non-hex characters in 64-character signature", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "nonce_123";
      // 64 chars, but contains invalid hex letters 'z' and 'g'
      const malformedSig = "z".repeat(32) + "g".repeat(32);

      const valid = verifyWebhookSignature(
        { "x-timestamp": now, "x-nonce": nonce, "x-signature": malformedSig },
        body
      );
      assert.equal(valid, false);
    });

    it("rejects signatures with incorrect lengths (63 or 65 characters)", () => {
      const body = "{}";
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "nonce_123";

      assert.equal(
        verifyWebhookSignature(
          { "x-timestamp": now, "x-nonce": nonce, "x-signature": "a".repeat(63) },
          body
        ),
        false
      );

      assert.equal(
        verifyWebhookSignature(
          { "x-timestamp": now, "x-nonce": nonce, "x-signature": "a".repeat(65) },
          body
        ),
        false
      );
    });
  });

  // =========================================================================
  // Finding 3: Complete Authoritative Order Identity Binding
  // =========================================================================
  describe("Finding 3: Authoritative Order Cross-checking", () => {
    const validPayment = {
      orderRef: "MUN-order-uuid-1",
      amountPaise: 19900, // ₹199
      uropayOrderId: "uro_ord_100",
      currency: "INR",
      environment: "production",
    };

    it("successfully binds when all 5 attributes match authoritative order", () => {
      const authoritativeOrder = {
        id: "uro_ord_100",
        tenantOrderRef: "MUN-order-uuid-1",
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(authoritativeOrder, validPayment);
      assert.equal(result.valid, true);
      if (result.valid) {
        assert.equal(result.status, "paid");
        assert.equal(result.orderId, "uro_ord_100");
        assert.equal(result.orderRef, "MUN-order-uuid-1");
        assert.equal(result.amountPaise, 19900);
        assert.equal(result.currency, "INR");
        assert.equal(result.environment, "production");
      }
    });

    it("rejects amount mismatch", () => {
      const authoritativeOrder = {
        id: "uro_ord_100",
        tenantOrderRef: "MUN-order-uuid-1",
        amount: 299, // Mismatched: expected 199
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(authoritativeOrder, validPayment);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "amount_mismatch");
        assert.deepEqual(result.detail, { expected: 199, authoritative: 299 });
      }
    });

    it("rejects currency mismatch", () => {
      const authoritativeOrder = {
        id: "uro_ord_100",
        tenantOrderRef: "MUN-order-uuid-1",
        amount: 199,
        currency: "USD", // Mismatched: expected INR
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(authoritativeOrder, validPayment);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "currency_mismatch");
      }
    });

    it("rejects environment mismatch", () => {
      const authoritativeOrder = {
        id: "uro_ord_100",
        tenantOrderRef: "MUN-order-uuid-1",
        amount: 199,
        currency: "INR",
        environment: "test", // Mismatched: expected production
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(authoritativeOrder, validPayment);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "environment_mismatch");
      }
    });

    it("rejects merchant order reference mismatch", () => {
      const authoritativeOrder = {
        id: "uro_ord_100",
        tenantOrderRef: "MUN-different-reference", // Mismatched
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(authoritativeOrder, validPayment);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "order_reference_mismatch");
      }
    });

    it("rejects provider order ID mismatch", () => {
      const authoritativeOrder = {
        id: "uro_ord_999", // Mismatched: expected uro_ord_100
        tenantOrderRef: "MUN-order-uuid-1",
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(authoritativeOrder, validPayment);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "order_id_mismatch");
      }
    });
  });

  // =========================================================================
  // Finding 1 & 2: Webhook Claim Lifecycle, In-Flight Handling, and Safe Recovery
  // =========================================================================
  describe("Finding 1 & 2: Webhook Claim States & Incomplete Claim Recovery", () => {
    // Simulating database state machine in memory
    type WebhookRow = {
      event_id: string;
      status: "processing" | "processed" | "failed";
      updated_at: string;
    };

    class MockWebhookStore {
      rows = new Map<string, WebhookRow>();

      async claim(eventId: string, leaseDurationMs = 30_000): Promise<"claimed" | "already_processed" | "in_flight" | "reclaimed"> {
        const existing = this.rows.get(eventId);
        const now = new Date().toISOString();

        if (!existing) {
          this.rows.set(eventId, {
            event_id: eventId,
            status: "processing",
            updated_at: now,
          });
          return "claimed";
        }

        if (existing.status === "processed") {
          return "already_processed";
        }

        const updatedAtMs = new Date(existing.updated_at).getTime();
        const leaseActive = Date.now() - updatedAtMs < leaseDurationMs;

        if (existing.status === "processing" && leaseActive) {
          return "in_flight";
        }

        // Safe recovery of failed claim or expired lease:
        this.rows.set(eventId, {
          event_id: eventId,
          status: "processing",
          updated_at: now,
        });
        return "reclaimed";
      }

      markProcessed(eventId: string) {
        const row = this.rows.get(eventId);
        if (row) {
          row.status = "processed";
          row.updated_at = new Date().toISOString();
        }
      }

      markFailed(eventId: string) {
        const row = this.rows.get(eventId);
        if (row) {
          row.status = "failed";
          row.updated_at = new Date().toISOString();
        }
      }
    }

    it("Finding 1: safely recovers and redelivers after forced DB failure after event insertion", async () => {
      const store = new MockWebhookStore();
      const eventId = "evt_paid_retry_1";

      // 1. First delivery arrives and claims the event
      const claim1 = await store.claim(eventId);
      assert.equal(claim1, "claimed");

      // 2. Simulated DB error during payment status update
      // Handler catches error and marks event as failed
      store.markFailed(eventId);
      assert.equal(store.rows.get(eventId)?.status, "failed");

      // 3. Provider redelivers with the SAME eventId
      // Handler MUST NOT return already_processed: true!
      const claim2 = await store.claim(eventId);
      assert.equal(claim2, "reclaimed", "Event must be safely reclaimed for retry");

      // 4. Processing succeeds on retry, marking processed
      store.markProcessed(eventId);
      assert.equal(store.rows.get(eventId)?.status, "processed");

      // 5. Subsequent delivery of now-completed event correctly returns already_processed
      const claim3 = await store.claim(eventId);
      assert.equal(claim3, "already_processed", "Completed event returns already_processed");
    });

    it("Finding 2: duplicate delivery while first delivery is processing receives in_flight (retryable 429)", async () => {
      const store = new MockWebhookStore();
      const eventId = "evt_duplicate_concurrent";

      // Delivery A claims event
      const claimA = await store.claim(eventId);
      assert.equal(claimA, "claimed");

      // Delivery B arrives while delivery A is actively processing (< 30s lease)
      const claimB = await store.claim(eventId);
      assert.equal(claimB, "in_flight", "Delivery B must not receive success; must be retryable");

      // Delivery A finishes processing
      store.markProcessed(eventId);

      // Now Delivery B redelivers and receives already_processed
      const claimBRetry = await store.claim(eventId);
      assert.equal(claimBRetry, "already_processed");
    });

    it("reclaims stale lease if delivery crashes without marking failed", async () => {
      const store = new MockWebhookStore();
      const eventId = "evt_crashed_worker";

      // Worker crashes, leaving row with processing status and old timestamp
      store.rows.set(eventId, {
        event_id: eventId,
        status: "processing",
        updated_at: new Date(Date.now() - 40_000).toISOString(), // 40 seconds ago (> 30s lease)
      });

      // Redelivery arrives:
      const claim = await store.claim(eventId);
      assert.equal(claim, "reclaimed", "Expired lease must be safely reclaimed");
    });
  });

  // =========================================================================
  // Finding 4: Unlinked Order Recovery via Merchant Reference
  // =========================================================================
  describe("Finding 4: Unlinked Provider Order Reconciliation", () => {
    it("binds unlinked payment when authoritative order contains merchant reference", () => {
      const unlinkedPayment = {
        orderRef: "MUN-unlinked-order-99",
        amountPaise: 19900,
        uropayOrderId: null, // Order was created at UroPay but DB link update was interrupted
        currency: "INR",
        environment: "production",
      };

      const authoritativeOrder = {
        id: "uro_ord_recovered_99",
        tenantOrderRef: "MUN-unlinked-order-99",
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      // Both webhook and status reconciliation validate binding
      const result = validateAuthoritativeOrderBinding(
        authoritativeOrder,
        unlinkedPayment,
        "uro_ord_recovered_99"
      );

      assert.equal(result.valid, true);
      if (result.valid) {
        assert.equal(result.orderId, "uro_ord_recovered_99");
        assert.equal(result.orderRef, "MUN-unlinked-order-99");
        assert.equal(result.status, "paid");
      }
    });

    it("rejects unlinked payment if provider tenantOrderRef does not match local orderRef", () => {
      const unlinkedPayment = {
        orderRef: "MUN-legit-order",
        amountPaise: 19900,
        uropayOrderId: null,
        currency: "INR",
        environment: "production",
      };

      const attackerOrder = {
        id: "uro_ord_attacker",
        tenantOrderRef: "MUN-attacker-order", // Tampered reference
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(
        attackerOrder,
        unlinkedPayment,
        "uro_ord_attacker"
      );

      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "order_reference_mismatch");
      }
    });
  });

  // =========================================================================
  // Audit P1: binding and tenant-ref lookup must fail CLOSED
  // =========================================================================
  describe("Audit P1: fail-closed order binding", () => {
    const unlinked = {
      orderRef: "MUN-victim-order",
      amountPaise: 19900,
      uropayOrderId: null,
      currency: "INR",
      environment: "production",
    };

    it("rejects an unlinked payment when the provider order has no merchant reference", () => {
      const orderWithoutRef = {
        id: "uro_ord_someone_else",
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(orderWithoutRef, unlinked);
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "order_reference_mismatch");
      }
    });

    it("rejects when an order ID is expected but the provider order omits it", () => {
      const orderWithoutId = {
        tenantOrderRef: "MUN-order-uuid-1",
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "PAID",
      };

      const result = validateAuthoritativeOrderBinding(orderWithoutId, {
        orderRef: "MUN-order-uuid-1",
        amountPaise: 19900,
        uropayOrderId: "uro_ord_100",
      });
      assert.equal(result.valid, false);
      if (!result.valid) {
        assert.equal(result.error, "order_id_mismatch");
      }
    });

    it("still binds a linked order that omits the merchant reference (ID is trusted)", () => {
      const result = validateAuthoritativeOrderBinding(
        { id: "uro_ord_100", amount: 199, currency: "INR", status: "PAID" },
        { orderRef: "MUN-order-uuid-1", amountPaise: 19900, uropayOrderId: "uro_ord_100" }
      );
      assert.equal(result.valid, true);
    });

    describe("getOrderByTenantRef", () => {
      const originalFetch = globalThis.fetch;
      const originalKey = process.env.UROPAY_API_KEY;
      const originalSecret = process.env.UROPAY_API_SECRET;

      beforeEach(() => {
        process.env.UROPAY_API_KEY = "test-key";
        process.env.UROPAY_API_SECRET = "test-secret";
      });

      afterEach(() => {
        globalThis.fetch = originalFetch;
        process.env.UROPAY_API_KEY = originalKey;
        process.env.UROPAY_API_SECRET = originalSecret;
      });

      function mockList(data: unknown) {
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ data }), { status: 200 })) as typeof fetch;
      }

      it("never falls back to an arbitrary order when the filter is ignored", async () => {
        mockList([
          { id: "uro_other_1", tenantOrderRef: "MUN-someone-else", amount: 199, status: "PAID" },
          { id: "uro_other_2", amount: 199, status: "PAID" },
        ]);
        assert.equal(await getOrderByTenantRef("MUN-victim-order"), null);
      });

      it("returns only the exactly matching order", async () => {
        mockList([
          { id: "uro_other_1", tenantOrderRef: "MUN-someone-else", amount: 199, status: "PAID" },
          { id: "uro_mine", tenantOrderRef: "MUN-victim-order", amount: 199, status: "PENDING" },
        ]);
        const order = (await getOrderByTenantRef("MUN-victim-order")) as { id: string } | null;
        assert.equal(order?.id, "uro_mine");
      });

      it("refuses to bind when multiple orders claim the same reference", async () => {
        mockList([
          { id: "uro_a", tenantOrderRef: "MUN-victim-order", amount: 199, status: "PAID" },
          { id: "uro_b", tenantOrderRef: "MUN-victim-order", amount: 199, status: "PAID" },
        ]);
        assert.equal(await getOrderByTenantRef("MUN-victim-order"), null);
      });

      it("rejects a single-object response with a different reference", async () => {
        mockList({ id: "uro_other", tenantOrderRef: "MUN-someone-else", amount: 199, status: "PAID" });
        assert.equal(await getOrderByTenantRef("MUN-victim-order"), null);
      });
    });
  });

  // =========================================================================
  // Audit P3: Refund and Chargeback Handling
  // =========================================================================
  describe("Audit P3: Refund and chargeback status handling", () => {
    it("normalizes refund and chargeback statuses to 'refunded'", () => {
      assert.equal(normalizeStatus("REFUNDED"), "refunded");
      assert.equal(normalizeStatus("refunded"), "refunded");
      assert.equal(normalizeStatus("REFUND"), "refunded");
      assert.equal(normalizeStatus("REVERSED"), "refunded");
      assert.equal(normalizeStatus("CHARGEBACK"), "refunded");
      assert.equal(normalizeStatus("  refunded  "), "refunded");
    });

    it("validates authoritative binding when order status is refunded", () => {
      const validPayment = {
        orderRef: "MUN-refund-test-1",
        amountPaise: 19900,
        uropayOrderId: "uro_ord_refund_100",
        currency: "INR",
        environment: "production",
      };

      const refundedOrder = {
        id: "uro_ord_refund_100",
        tenantOrderRef: "MUN-refund-test-1",
        amount: 199,
        currency: "INR",
        environment: "production",
        status: "REFUNDED",
      };

      const result = validateAuthoritativeOrderBinding(refundedOrder, validPayment);
      assert.equal(result.valid, true);
      if (result.valid) {
        assert.equal(result.status, "refunded");
        assert.equal(result.orderId, "uro_ord_refund_100");
        assert.equal(result.orderRef, "MUN-refund-test-1");
      }
    });

    it("accepts signed webhook event with REFUNDED status", () => {
      const body = JSON.stringify({
        eventId: "evt_refund_1",
        orderId: "uro_ord_refund_100",
        tenantOrderRef: "MUN-refund-test-1",
        status: "REFUNDED",
      });
      const now = String(Math.floor(Date.now() / 1000));
      const nonce = "nonce_ref_123";

      const canonical = ["POST", "/tenant-webhook", now, nonce, "", body].join("\n");
      const sig = createHmac("sha256", secret).update(canonical).digest("hex");

      const valid = verifyWebhookSignature(
        { "x-timestamp": now, "x-nonce": nonce, "x-signature": sig },
        body
      );
      assert.equal(valid, true);
    });
  });
});

