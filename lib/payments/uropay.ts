import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const API_BASE = "https://api.uropai.in";
const API_KEY = process.env.UROPAY_API_KEY || "";
const API_SECRET = process.env.UROPAY_API_SECRET || "";
const WEBHOOK_SECRET = process.env.UROPAY_WEBHOOK_SECRET || "";

/**
 * Sign a request for UROpay API (HMAC-SHA256)
 * Canonical string: ${method}\n${path}\n${timestamp}\n${nonce}\n${queryString}\n${rawBody}
 */
function signRequest(
  method: string,
  path: string,
  query: string,
  body: string
): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  const canonical = [method, path, timestamp, nonce, query, body].join("\n");
  const signature = createHmac("sha256", API_SECRET)
    .update(canonical)
    .digest("hex");

  return {
    "X-Api-Key": API_KEY,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
  };
}

/**
 * Create a UROpay order and return the checkout URL
 */
export async function createUropayOrder(
  orderRef: string,
  amountPaise: number,
  returnUrl?: string,
  webhookUrl?: string
) {
  if (!API_KEY || !API_SECRET) {
    throw new Error(
      "UROpay credentials missing. Set UROPAY_API_KEY and UROPAY_API_SECRET."
    );
  }

  const path = "/v1/orders";
  const bodyObj: Record<string, unknown> = {
    tenantOrderRef: orderRef,
    amount: Math.round(amountPaise / 100), // UROpay expects rupees
    currency: "INR",
  };

  if (returnUrl) bodyObj.returnUrl = returnUrl;
  if (webhookUrl) bodyObj.webhookUrl = webhookUrl;

  const rawBody = JSON.stringify(bodyObj);
  const headers = signRequest("POST", path, "", rawBody);
  headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: rawBody,
  });

  const json = await res.json();

  if (!res.ok || !json?.data?.openUrl) {
    throw new Error(json?.message || "Failed to create UROpay order");
  }

  return {
    orderId: json.data.id,
    openUrl: json.data.openUrl,
  };
}

/**
 * Verify UROpay webhook signature using timing-safe comparison
 * Canonical: POST\n/tenant-webhook\n${timestamp}\n${nonce}\n${queryString}\n${rawBody}
 */
export function verifyWebhookSignature(
  headers: Record<string, string>,
  rawBody: string
): boolean {
  if (!WEBHOOK_SECRET) return false;

  const timestamp = headers["x-timestamp"] || "";
  const nonce = headers["x-nonce"] || "";
  const receivedSig = headers["x-signature"] || "";

  const canonical = ["POST", "/tenant-webhook", timestamp, nonce, "", rawBody].join(
    "\n"
  );
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(canonical)
    .digest("hex");

  // Timing-safe comparison
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(receivedSig, "hex");

  return (
    expectedBuf.length === actualBuf.length &&
    timingSafeEqual(expectedBuf, actualBuf)
  );
}

/**
 * Look up order status from UROpay API (authoritative source of truth)
 */
export async function getOrderStatus(orderId: string) {
  if (!API_KEY || !API_SECRET) return null;

  const path = `/v1/orders/${orderId}`;
  const headers = signRequest("GET", path, "", "");

  const res = await fetch(`${API_BASE}${path}`, { headers });
  const json = await res.json();

  return json?.data || null;
}
