import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getClientIp, sanitizeIp, checkRateLimit } from "@/lib/server/rate-limit";

describe("Rate Limiting & Client IP Resolution", () => {
  describe("sanitizeIp", () => {
    it("sanitizes valid IPv4 addresses", () => {
      assert.equal(sanitizeIp("203.0.113.1"), "203.0.113.1");
      assert.equal(sanitizeIp("  198.51.100.42  "), "198.51.100.42");
    });

    it("strips port numbers from IPv4", () => {
      assert.equal(sanitizeIp("203.0.113.1:8080"), "203.0.113.1");
      assert.equal(sanitizeIp("198.51.100.42:443"), "198.51.100.42");
    });

    it("sanitizes valid IPv6 addresses", () => {
      assert.equal(sanitizeIp("2001:db8::1"), "2001:db8::1");
      assert.equal(sanitizeIp("::1"), "::1");
    });

    it("strips brackets and ports from IPv6", () => {
      assert.equal(sanitizeIp("[2001:db8::1]:8080"), "2001:db8::1");
      assert.equal(sanitizeIp("[::1]:443"), "::1");
    });

    it("rejects invalid or malformed IP formats", () => {
      assert.equal(sanitizeIp("not-an-ip"), null);
      assert.equal(sanitizeIp("999.999.999.999"), null);
      assert.equal(sanitizeIp(""), null);
      assert.equal(sanitizeIp(null), null);
    });
  });

  describe("getClientIp - Ingress spoofing defense", () => {
    it("prioritizes trusted x-vercel-forwarded-for platform header", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-vercel-forwarded-for": "203.0.113.50",
          "x-forwarded-for": "198.51.100.1, 198.51.100.2",
          "x-real-ip": "198.51.100.3",
        },
      });
      assert.equal(getClientIp(req), "203.0.113.50");
    });

    it("prioritizes x-real-ip over x-forwarded-for when x-vercel-forwarded-for is absent", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-real-ip": "203.0.113.60",
          "x-forwarded-for": "198.51.100.1, 198.51.100.2",
        },
      });
      assert.equal(getClientIp(req), "203.0.113.60");
    });

    it("selects the LAST entry from x-forwarded-for to defeat client-supplied head spoofing", () => {
      // In reverse-proxy topologies (AWS, Cloudflare, Nginx), the client connects
      // sending `x-forwarded-for: 1.1.1.1 (spoofed)`. The proxy appends the true client IP:
      // resulting in `1.1.1.1, 203.0.113.100`.
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "1.1.1.1, 10.0.0.1, 203.0.113.100",
        },
      });
      assert.equal(getClientIp(req), "203.0.113.100");
    });

    it("handles trailing whitespace and port on the last x-forwarded-for entry", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "1.1.1.1, 203.0.113.200:443  ",
        },
      });
      assert.equal(getClientIp(req), "203.0.113.200");
    });

    it("falls back to earlier entry if the tail entry is malformed", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {
          "x-forwarded-for": "203.0.113.75, malformed-junk",
        },
      });
      assert.equal(getClientIp(req), "203.0.113.75");
    });

    it("returns 'unknown' when no valid IP headers exist", () => {
      const req = new Request("https://example.com/api/test", {
        headers: {},
      });
      assert.equal(getClientIp(req), "unknown");
    });
  });

  describe("checkRateLimit - failClosed policy", () => {
    it("fails closed when DB store is unavailable and failClosed: true is set", async () => {
      // With dummy/unreachable DB configuration, checkRateLimit catches DB error.
      // With failClosed: true, it must return false (block request) rather than allowing memory fallback.
      const allowed = await checkRateLimit(
        "test-key-fail-closed",
        5,
        60_000,
        { failClosed: true }
      );
      assert.equal(allowed, false);
    });

    it("falls back to memory when failClosed is not set or false", async () => {
      // When failClosed is false (standard route default), it falls back to memoryCheck
      const allowed = await checkRateLimit(
        `test-key-memory-fallback-${Date.now()}`,
        5,
        60_000,
        { failClosed: false }
      );
      assert.equal(allowed, true);
    });
  });
});
