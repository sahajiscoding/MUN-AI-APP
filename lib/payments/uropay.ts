import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const API_BASE = "https://api.uropai.in";

const API_KEY = process.env.UROPAY_API_KEY;
const API_SECRET = process.env.UROPAY_API_SECRET;
const WEBHOOK_SECRET = process.env.UROPAY_WEBHOOK_SECRET;

function requireCredential(
  value: string | undefined,
  name: string
): string {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

/**
 * Create an HMAC-SHA256 signature for a UroPay API request.
 */
function signRequest(
  method: string,
  path: string,
  query: string,
  body: string
): Record<string, string> {
  const apiKey = requireCredential(API_KEY, "UROPAY_API_KEY");
  const apiSecret = requireCredential(
    API_SECRET,
    "UROPAY_API_SECRET"
  );

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();

  const canonical = [
    method,
    path,
    timestamp,
    nonce,
    query,
    body,
  ].join("\n");

  const signature = createHmac("sha256", apiSecret)
    .update(canonical)
    .digest("hex");

  return {
    "X-Api-Key": apiKey,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
  };
}

/**
 * Create a UroPay order.
 *
 * amountPaise:
 *   19900 = ₹199
 *   29900 = ₹299
 */
export async function createUropayOrder(
  orderRef: string,
  amountPaise: number,
  returnUrl?: string,
  webhookUrl?: string
) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const path = "/v1/orders";

  const bodyObj: Record<string, unknown> = {
    tenantOrderRef: orderRef,

    // Our database stores INR in paise.
    // UroPay expects whole rupees.
    amount: Math.round(amountPaise / 100),

    currency: "INR",
  };

  if (returnUrl) {
    bodyObj.returnUrl = returnUrl;
  }

  if (webhookUrl) {
    bodyObj.webhookUrl = webhookUrl;
  }

  const rawBody = JSON.stringify(bodyObj);

  const headers = signRequest(
    "POST",
    path,
    "",
    rawBody
  );

  headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: rawBody,
    cache: "no-store",
  });

  let json: any = null;

  try {
    json = await response.json();
  } catch {
    throw new Error(
      `UroPay returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      json?.message ||
        json?.error ||
        `UroPay order creation failed (${response.status}).`
    );
  }

  const orderId = json?.data?.id;
  const openUrl = json?.data?.openUrl;

  if (!orderId || !openUrl) {
    throw new Error(
      "UroPay response did not contain an order ID and checkout URL."
    );
  }

  return {
    orderId: String(orderId),
    openUrl: String(openUrl),
  };
}

/**
 * Verify a UroPay webhook signature.
 *
 * IMPORTANT:
 * The raw request body must be passed here.
 * Do not JSON.parse() the body before verification.
 */
export function verifyWebhookSignature(
  headers: Record<string, string>,
  rawBody: string
): boolean {
  if (!WEBHOOK_SECRET) {
    console.error(
      "UROPAY_WEBHOOK_SECRET is not configured."
    );

    return false;
  }

  const timestamp =
    headers["x-timestamp"] || "";

  const nonce =
    headers["x-nonce"] || "";

  const receivedSignature =
    headers["x-signature"] || "";

  if (!timestamp || !nonce || !receivedSignature) {
    return false;
  }

  // Reject obviously invalid timestamps.
  const timestampNumber = Number(timestamp);

  if (
    !Number.isFinite(timestampNumber) ||
    timestampNumber <= 0
  ) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);

  // Five-minute replay window.
  const MAX_AGE_SECONDS = 5 * 60;

  if (
    Math.abs(now - timestampNumber) >
    MAX_AGE_SECONDS
  ) {
    console.error(
      "UroPay webhook rejected: timestamp outside replay window."
    );

    return false;
  }

  const canonical = [
    "POST",
    "/tenant-webhook",
    timestamp,
    nonce,
    "",
    rawBody,
  ].join("\n");

  const expectedSignature = createHmac(
    "sha256",
    WEBHOOK_SECRET
  )
    .update(canonical)
    .digest("hex");

  let expectedBuffer: Buffer;
  let receivedBuffer: Buffer;

  try {
    expectedBuffer = Buffer.from(
      expectedSignature,
      "hex"
    );

    receivedBuffer = Buffer.from(
      receivedSignature,
      "hex"
    );
  } catch {
    return false;
  }

  if (
    expectedBuffer.length === 0 ||
    receivedBuffer.length === 0
  ) {
    return false;
  }

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

/**
 * Get the authoritative status of a UroPay order.
 *
 * UroPay's webhook is only a notification.
 * This GET request is the authoritative confirmation.
 */
export async function getOrderStatus(
  orderId: string
) {
  if (!orderId) {
    throw new Error(
      "UroPay order ID is required."
    );
  }

  const path = `/v1/orders/${encodeURIComponent(
    orderId
  )}`;

  const headers = signRequest(
    "GET",
    path,
    "",
    ""
  );

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  let json: any = null;

  try {
    json = await response.json();
  } catch {
    throw new Error(
      `UroPay status response was invalid (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      json?.message ||
        json?.error ||
        `UroPay status lookup failed (${response.status}).`
    );
  }

  return json?.data || null;
}
