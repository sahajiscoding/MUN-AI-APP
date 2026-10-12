import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizePublicMessage } from "@/lib/safe-message";

describe("sanitizePublicMessage", () => {
  it("unwraps Error instances and preserves the message", () => {
    const err = new Error("Please verify your email address before continuing.");
    assert.equal(
      sanitizePublicMessage(err, "Something went wrong. Try again."),
      "Please verify your email address before continuing."
    );
  });

  it("unwraps Error instances with upstream payment errors", () => {
    const err = new Error("Could not create the payment with UroPay. Please try again.");
    assert.equal(
      sanitizePublicMessage(err, "Something went wrong. Try again."),
      "Could not create the payment with UroPay. Please try again."
    );
  });

  it("unwraps object errors with a string message property", () => {
    const err = { message: "That referral code could not be applied." };
    assert.equal(
      sanitizePublicMessage(err, "Something went wrong. Try again."),
      "That referral code could not be applied."
    );
  });

  it("handles string errors directly", () => {
    assert.equal(
      sanitizePublicMessage("You need to sign in again.", "Something went wrong. Try again."),
      "You need to sign in again."
    );
  });

  it("falls back to default fallback when value is empty or invalid", () => {
    assert.equal(sanitizePublicMessage(null, "Fallback message"), "Fallback message");
    assert.equal(sanitizePublicMessage(undefined, "Fallback message"), "Fallback message");
    assert.equal(sanitizePublicMessage(12345, "Fallback message"), "Fallback message");
    assert.equal(sanitizePublicMessage("", "Fallback message"), "Fallback message");
    assert.equal(sanitizePublicMessage(new Error("   "), "Fallback message"), "Fallback message");
  });

  it("redacts JWT tokens from error messages", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const err = new Error(`Request failed with token ${jwt}`);
    const sanitized = sanitizePublicMessage(err, "Fallback message");
    assert.match(sanitized, /\[redacted-credential\]/);
    assert.equal(sanitized.includes(jwt), false);
  });

  it("redacts credentials query parameters from error messages", () => {
    const err = new Error("Fetch failed for endpoint?api_key=secret_12345&other=1");
    const sanitized = sanitizePublicMessage(err, "Fallback message");
    assert.match(sanitized, /api_key=\[redacted\]/);
  });
});
