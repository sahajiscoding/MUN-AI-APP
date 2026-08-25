import { createHmac } from "crypto";
import { getPlan } from "@/lib/plans";

const API_BASE = "https://api.uropai.in";
const API_KEY = process.env.UROPAY_API_KEY || "";
const API_SECRET = process.env.UROPAY_API_SECRET || "";
const WEBHOOK_SECRET = process.env.UROPAY_WEBHOOK_SECRET || "";

/**
 * Sign a request for UROpay API (HMAC-SHA256)
 */
function sign(method: string, path: string, body: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `${method}\n${path}\n${timestamp}\n${body}`;
  const signature = createHmac("sha256", API_SECRET).update(message).digest("hex");

  return {
    "X-Api-Key": API_KEY,
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  };
}

/**
 * Create a UROpay order and return the checkout URL
 */
export async function createUropayOrder(orderRef: string, amountPaise: number) {
  if (!API_KEY || !API_SECRET) {
    throw new Error("UROpay credentials missing. Set UROPAY_API_KEY and UROPAY_API_SECRET.");
  }

  const body = JSON.stringify({
    tenantOrderRef: orderRef,
    amount: Math.round(amountPaise / 100), // UROpay expects rupees, not paise
    currency: "INR",
  });

  const headers = sign("POST", "/v1/orders", body);
  headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}/v1/orders`, {
    method: "POST",
    headers,
    body,
  });

  const json = await res.json();

  if (!res.ok || !json?.data?.openUrl) {
    throw new Error(json?.error?.message || "Failed to create UROpay order");
  }

  return {
    orderId: json.data.id,
    openUrl: json.data.openUrl,
  };
}

/**
 * Verify UROpay webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  if (!WEBHOOK_SECRET) return false;

  const message = `${timestamp}\n${payload}`;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(message).digest("hex");

  return signature === expected;
}

/**
 * Look up order status from UROpay API
 */
export async function getOrderStatus(orderId: string) {
  if (!API_KEY || !API_SECRET) return null;

  const body = "";
  const headers = sign("GET", `/v1/orders/${orderId}`, body);

  const res = await fetch(`${API_BASE}/v1/orders/${orderId}`, { headers });
  const json = await res.json();

  return json?.data || null;
}
