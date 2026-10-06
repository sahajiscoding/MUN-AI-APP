import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { logger } from "@/lib/server/secure-logger";

const API_BASE = "https://api.uropai.in";

// Read credentials lazily (per call, never cached at module load) so key
// rotation takes effect without a code change (SEC-ENV-08).

/** Return a required UroPay credential, throwing when it is not configured. */
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
  const apiKey = requireCredential(process.env.UROPAY_API_KEY, "UROPAY_API_KEY");
  const apiSecret = requireCredential(
    process.env.UROPAY_API_SECRET,
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
    signal: AbortSignal.timeout(15_000),
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
  const webhookSecret = process.env.UROPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("UROPAY_WEBHOOK_SECRET is not configured.");

    return false;
  }

  const timestamp =
    headers["x-timestamp"] || "";

  const nonce =
    headers["x-nonce"] || "";

  const receivedSignature =
    (headers["x-signature"] || "").trim();

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
    logger.error("UroPay webhook rejected: timestamp outside replay window.");

    return false;
  }

  // Require exactly 64 hexadecimal characters for SHA-256 HMAC (32 bytes).
  // Reject malformed or non-hex encodings explicitly before decoding.
  const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
  if (!HEX_64_REGEX.test(receivedSignature)) {
    logger.error("UroPay webhook rejected: signature is not a valid 64-character hex string.");
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
    webhookSecret
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
    expectedBuffer.length !== 32 ||
    receivedBuffer.length !== 32
  ) {
    return false;
  }

  // Compare as plain byte views: timing-safe, and independent of Node's
  // Buffer typings (which drift across @types/node majors).
  return timingSafeEqual(
    new Uint8Array(expectedBuffer),
    new Uint8Array(receivedBuffer)
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
      signal: AbortSignal.timeout(15_000),
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

/**
 * Look up an authoritative order from UroPay by merchant tenant order reference.
 * Used to reconcile orders created at UroPay when the local provider ID link was interrupted.
 *
 * UroPay guarantees the following authoritative response schema:
 * - id: string — Provider order ID
 * - tenantOrderRef: string — Merchant order reference (e.g. MUN-<uuid>)
 * - amount: number — Order amount in whole INR (rupees)
 * - currency: string — Currency ("INR")
 * - status: string — Authoritative status ("PAID", "FAILED", "EXPIRED", "PENDING")
 * - environment: string — Provider environment ("production" or "test")
 */
export async function getOrderByTenantRef(
  tenantOrderRef: string
) {
  if (!tenantOrderRef) {
    throw new Error("UroPay tenant order reference is required.");
  }

  const path = "/v1/orders";
  const query = `tenantOrderRef=${encodeURIComponent(tenantOrderRef)}`;
  const headers = signRequest("GET", path, query, "");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}?${query}`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.error("UroPay order lookup by tenantOrderRef network error:", err);
    return null;
  }

  if (!response.ok) {
    logger.warn(`UroPay order lookup by tenantOrderRef returned status ${response.status}`);
    return null;
  }

  let json: any = null;
  try {
    json = await response.json();
  } catch {
    return null;
  }

  const data = json?.data;
  if (!data) return null;

  // Fail closed: only an order whose merchant reference exactly matches is
  // ever returned. Never fall back to an arbitrary list entry — if the
  // provider ignored the filter, data[0] could be another customer's order.
  const matchesRef = (o: unknown) => {
    if (!o || typeof o !== "object") return false;
    const order = o as Record<string, unknown>;
    return (
      order.tenantOrderRef === tenantOrderRef ||
      order.merchantOrderRef === tenantOrderRef ||
      order.orderRef === tenantOrderRef
    );
  };

  if (Array.isArray(data)) {
    const matches = data.filter(matchesRef);
    if (matches.length !== 1) {
      if (matches.length > 1) {
        logger.error("UroPay returned multiple orders for one tenantOrderRef; refusing to bind.");
      }
      return null;
    }
    return matches[0];
  }

  return matchesRef(data) ? data : null;
}

export type NormalizedPaymentStatus = "paid" | "failed" | "expired" | "pending" | "refunded";

/** Normalizes a payment status string from webhook or authoritative order. */
export function normalizeStatus(
  value: unknown
): NormalizedPaymentStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const status = value.trim().toUpperCase();

  switch (status) {
    case "PAID":
      return "paid";
    case "REFUNDED":
    case "REFUND":
    case "REVERSED":
    case "CHARGEBACK":
      return "refunded";
    case "FAILED":
      return "failed";
    case "EXPIRED":
      return "expired";
    case "PENDING":
    case "PROCESSING":
    case "CREATED":
      return "pending";
    default:
      return null;
  }
}

export type AuthoritativeBindingResult =
  | {
      valid: true;
      status: NormalizedPaymentStatus;
      orderId: string;
      orderRef: string;
      amountPaise: number;
      currency: string;
      environment: string | null;
      rawOrder: Record<string, unknown>;
    }
  | {
      valid: false;
      error:
        | "order_status_unavailable"
        | "unknown_order_status"
        | "order_id_mismatch"
        | "order_reference_mismatch"
        | "invalid_order_amount"
        | "amount_mismatch"
        | "currency_mismatch"
        | "environment_mismatch";
      detail?: Record<string, unknown>;
    };

/**
 * Validates complete binding between an authoritative UroPay order and local payment record.
 * 
 * Verifies:
 * 1. Authoritative status is recognized
 * 2. Provider Order ID matches (if expected ID is known)
 * 3. Merchant Order Reference matches payment.order_ref
 * 4. Amount in INR matches expected paise / 100
 * 5. Currency matches (default INR)
 * 6. Environment matches (production vs test)
 */
export function validateAuthoritativeOrderBinding(
  authoritativeOrder: unknown,
  expected: {
    orderRef: string;
    amountPaise: number | string;
    uropayOrderId?: string | null;
    currency?: string | null;
    environment?: string | null;
  },
  receivedOrderId?: string
): AuthoritativeBindingResult {
  if (!authoritativeOrder || typeof authoritativeOrder !== "object") {
    return { valid: false, error: "order_status_unavailable" };
  }

  const order = authoritativeOrder as Record<string, unknown>;

  // 1. Authoritative status
  const normalized = normalizeStatus(order.status);
  if (!normalized) {
    return {
      valid: false,
      error: "unknown_order_status",
      detail: { status: order.status },
    };
  }

  // 2. Provider Order ID binding — fail closed: when an ID is expected, the
  // authoritative order must carry that exact ID (a missing ID is a mismatch).
  const authOrderId = typeof order.id === "string" ? order.id.trim() : "";
  const expectedOrderId = (expected.uropayOrderId || receivedOrderId || "").trim();
  if (expectedOrderId && authOrderId !== expectedOrderId) {
    return {
      valid: false,
      error: "order_id_mismatch",
      detail: { expected: expectedOrderId, authoritative: authOrderId || null },
    };
  }
  const resolvedOrderId = authOrderId || expectedOrderId;
  if (!resolvedOrderId) {
    return {
      valid: false,
      error: "order_id_mismatch",
      detail: { expected: null, authoritative: null },
    };
  }

  // 3. Merchant order reference binding
  const authMerchantRef =
    (typeof order.tenantOrderRef === "string" && order.tenantOrderRef.trim()) ||
    (typeof order.merchantOrderRef === "string" && order.merchantOrderRef.trim()) ||
    (typeof order.orderRef === "string" && order.orderRef.trim()) ||
    "";

  // Without a stored provider order ID, the merchant reference is the ONLY
  // thing tying this provider order to our local payment, so it is mandatory.
  const hasTrustedStoredOrderId = Boolean(expected.uropayOrderId?.trim());
  if (
    (!hasTrustedStoredOrderId && !authMerchantRef) ||
    (authMerchantRef && authMerchantRef !== expected.orderRef)
  ) {
    return {
      valid: false,
      error: "order_reference_mismatch",
      detail: { expected: expected.orderRef, authoritative: authMerchantRef || null },
    };
  }

  // 4. Amount binding (authoritative order in whole rupees, expected in paise)
  const authAmountRupees = Number(order.amount);
  if (!Number.isFinite(authAmountRupees) || authAmountRupees <= 0) {
    return {
      valid: false,
      error: "invalid_order_amount",
      detail: { amount: order.amount },
    };
  }

  const expectedAmountRupees = Number(expected.amountPaise) / 100;
  if (authAmountRupees !== expectedAmountRupees) {
    return {
      valid: false,
      error: "amount_mismatch",
      detail: { expected: expectedAmountRupees, authoritative: authAmountRupees },
    };
  }

  // 5. Currency binding
  const authCurrency = typeof order.currency === "string" ? order.currency.trim().toUpperCase() : "";
  const expectedCurrency = (expected.currency || "INR").trim().toUpperCase();
  if (authCurrency && authCurrency !== expectedCurrency) {
    return {
      valid: false,
      error: "currency_mismatch",
      detail: { expected: expectedCurrency, authoritative: authCurrency },
    };
  }

  // 6. Environment binding
  const authEnvironment = typeof order.environment === "string" ? order.environment.trim().toLowerCase() : "";
  const expectedEnv = (expected.environment || "").trim().toLowerCase();
  if (authEnvironment && expectedEnv && authEnvironment !== expectedEnv) {
    return {
      valid: false,
      error: "environment_mismatch",
      detail: { expected: expectedEnv, authoritative: authEnvironment },
    };
  }

  return {
    valid: true,
    status: normalized,
    orderId: resolvedOrderId,
    orderRef: expected.orderRef,
    amountPaise: Math.round(authAmountRupees * 100),
    currency: authCurrency || expectedCurrency,
    environment: authEnvironment || expectedEnv || null,
    rawOrder: order,
  };
}
