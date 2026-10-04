import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeOrigin, isExemptMachineRoute, isStateChanging } from "@/lib/server/csrf";

describe("CSRF Origin Verification", () => {
  it("identifies state-changing HTTP methods", () => {
    assert.equal(isStateChanging("POST"), true);
    assert.equal(isStateChanging("PUT"), true);
    assert.equal(isStateChanging("PATCH"), true);
    assert.equal(isStateChanging("DELETE"), true);
    assert.equal(isStateChanging("post"), true);
    assert.equal(isStateChanging("GET"), false);
    assert.equal(isStateChanging("HEAD"), false);
    assert.equal(isStateChanging("OPTIONS"), false);
  });

  it("identifies exempt machine-to-machine routes (webhooks)", () => {
    assert.equal(isExemptMachineRoute("/api/webhooks/uropay"), true);
    assert.equal(isExemptMachineRoute("/api/webhooks/custom"), true);
    assert.equal(isExemptMachineRoute("/api/me"), false);
    assert.equal(isExemptMachineRoute("/api/profile"), false);
    assert.equal(isExemptMachineRoute("/api/chats"), false);
    assert.equal(isExemptMachineRoute("/api/payments/create-order"), false);
    assert.equal(isExemptMachineRoute("/api/c8f2x9/login"), false);
  });

  it("rejects absent Origin header", () => {
    const req = {
      headers: new Headers(),
      url: "https://example.com/api/profile",
      nextUrl: { origin: "https://example.com", pathname: "/api/profile" },
    };
    assert.equal(isSafeOrigin(req), false);
  });

  it("rejects empty or whitespace-only Origin header", () => {
    const req = {
      headers: new Headers({ origin: "   " }),
      url: "https://example.com/api/profile",
      nextUrl: { origin: "https://example.com", pathname: "/api/profile" },
    };
    assert.equal(isSafeOrigin(req), false);
  });

  it("rejects opaque 'null' Origin header (e.g. from sandboxed iframes)", () => {
    const req = {
      headers: new Headers({ origin: "null" }),
      url: "https://example.com/api/profile",
      nextUrl: { origin: "https://example.com", pathname: "/api/profile" },
    };
    assert.equal(isSafeOrigin(req), false);
  });

  it("rejects malformed Origin header", () => {
    const malformedOrigins = [
      "not-a-url",
      "://missing-protocol",
      "javascript:alert(1)",
      "http://[invalid-ipv6",
      "https://",
    ];

    for (const origin of malformedOrigins) {
      const req = {
        headers: new Headers({ origin }),
        url: "https://example.com/api/profile",
        nextUrl: { origin: "https://example.com", pathname: "/api/profile" },
      };
      assert.equal(isSafeOrigin(req), false, `Expected origin "${origin}" to be rejected`);
    }
  });

  it("rejects foreign / cross-site Origin header", () => {
    const foreignOrigins = [
      "https://attacker.com",
      "https://example.com.evil.com",
      "http://example.com", // protocol mismatch
      "https://example.com:8080", // port mismatch
      "https://sub.example.com", // subdomain mismatch
    ];

    for (const origin of foreignOrigins) {
      const req = {
        headers: new Headers({ origin }),
        url: "https://example.com/api/profile",
        nextUrl: { origin: "https://example.com", pathname: "/api/profile" },
      };
      assert.equal(isSafeOrigin(req), false, `Expected foreign origin "${origin}" to be rejected`);
    }
  });

  it("accepts valid same-origin Origin header", () => {
    const req = {
      headers: new Headers({ origin: "https://example.com" }),
      url: "https://example.com/api/profile",
      nextUrl: { origin: "https://example.com", pathname: "/api/profile" },
    };
    assert.equal(isSafeOrigin(req), true);
  });

  it("accepts configured NEXT_PUBLIC_SITE_URL origin", () => {
    const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";

    try {
      // Request might have different host at edge proxy, but matches configured site
      const req = {
        headers: new Headers({ origin: "https://app.example.com" }),
        url: "http://internal-host:3000/api/profile",
        nextUrl: { origin: "http://internal-host:3000", pathname: "/api/profile" },
      };
      assert.equal(isSafeOrigin(req), true);
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl;
    }
  });
});
