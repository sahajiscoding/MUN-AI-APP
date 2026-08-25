import crypto from "node:crypto";
import Razorpay from "razorpay";
import { ApiError } from "@/lib/api";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new ApiError(
      500,
      "missing_payment_config",
      `${name} is missing from server environment.`
    );
  }

  return value;
}

export function getRazorpayClient() {
  return new Razorpay({
    key_id: requireEnv("RAZORPAY_KEY_ID"),
    key_secret: requireEnv("RAZORPAY_KEY_SECRET")
  });
}

export function getRazorpayPublicKey() {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

export function verifyRazorpayPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const secret = requireEnv("RAZORPAY_KEY_SECRET");
  const body = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

  return safeEqual(expected, input.razorpaySignature);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null
) {
  if (!signature) {
    return false;
  }

  const secret = requireEnv("RAZORPAY_WEBHOOK_SECRET");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}
