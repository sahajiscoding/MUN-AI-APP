import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  x402HTTPResourceServer,
  decodePaymentSignatureHeader,
  type HTTPAdapter,
  type HTTPProcessResult,
} from "@x402/core/http";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
  BAZAAR,
} from "@x402/extensions/bazaar";
import {
  builderCodeResourceServerExtension,
  declareBuilderCodeExtension,
  BUILDER_CODE,
} from "@x402/extensions/builder-code";
import {
  paymentIdentifierResourceServerExtension,
  declarePaymentIdentifierExtension,
  extractPaymentIdentifier,
  PAYMENT_IDENTIFIER,
} from "@x402/extensions/payment-identifier";
import {
  createSIWxResourceServerExtension,
  declareSIWxExtension,
  SIGN_IN_WITH_X,
  type SIWxStorage,
} from "@x402/extensions/sign-in-with-x";
import { logger } from "@/lib/server/secure-logger";
import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";

export type NetworkCaip2 = `eip155:${number}` | string;

export interface X402ServerConfig {
  payTo: string;
  network: NetworkCaip2;
  facilitatorUrl: string;
  siteOrigin: string;
  appBuilderCode: string;
}

/**
 * Normalizes an origin URL into a standard valid origin string.
 */
function normalizeOrigin(urlStr?: string): string {
  if (!urlStr) return "https://munprep.org";
  try {
    const parsed = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
    return parsed.origin;
  } catch {
    return "https://munprep.org";
  }
}

/**
 * Cache policy for payment negotiation and error traffic.
 *
 * A 402 challenge carries a per-request `payTo`/nonce context and must never be
 * served from a shared cache. The SDK sets this for its own responses; applying
 * it explicitly here also covers the responses this module builds.
 */
export const X402_PAYMENT_CACHE_CONTROL = "no-store";

/**
 * Cache policy for payment-gated CONTENT.
 *
 * A granted resource is bought once and must never be reusable by a later
 * unpaid reader. Without an explicit directive a CDN is entitled to cache the
 * granted 200 and serve it to anyone during its TTL — a paid-content leak the
 * x402 specification does not address at all. `private, no-store` keeps the
 * body out of every shared cache.
 */
export const X402_PAID_CONTENT_CACHE_CONTROL = "private, no-store, max-age=0";

/** Merchant wallet addresses that can never receive a real payment. */
function isPlaceholderPayTo(address: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return true;

  const value = BigInt(address);
  // The zero address, and the low sentinels used as test fixtures
  // (0x…0001, 0x…0002, …), are all trivially small compared with a real
  // keccak-derived account address.
  return value < BigInt(0x1_0000);
}

/**
 * Validates the merchant payout address, failing closed.
 *
 * Previously an unset `X402_PAY_TO` silently defaulted to `0x…0001`, so a
 * misconfigured deployment would advertise a burn address in every 402
 * challenge and every settled payment would be irrecoverable. Refusing to
 * start a paid route is strictly better than accepting money that cannot
 * arrive.
 */
export function assertValidPayTo(value: string | undefined): string {
  const candidate = value?.trim() ?? "";

  if (!candidate) {
    throw new Error(
      "X402_PAY_TO is not configured. Set it to the merchant EVM wallet address that should receive bot micro-payments."
    );
  }

  if (isPlaceholderPayTo(candidate)) {
    throw new Error(
      `X402_PAY_TO is not a usable payout address (${candidate.slice(0, 10)}…). It must be a 40-character hex address that is not the zero address or a placeholder. Payments sent to it could never be recovered.`
    );
  }

  return candidate;
}

/**
 * Returns x402 server configuration.
 * Defaults to Base Sepolia testnet (`eip155:84532`) with the official testnet facilitator,
 * allowing live end-to-end testing with Circle faucet USDC.
 * Set `X402_NETWORK=eip155:8453` in production for Base mainnet.
 *
 * Throws when `X402_PAY_TO` is missing or is a placeholder — see `assertValidPayTo`.
 */
export function getX402Config(): X402ServerConfig {
  const payTo = assertValidPayTo(process.env.X402_PAY_TO);

  const network =
    (process.env.X402_NETWORK?.trim() as NetworkCaip2) || "eip155:84532";

  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL?.trim() ||
    "https://x402.org/facilitator";

  const siteOrigin = normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim()
  );

  const appBuilderCode =
    process.env.X402_BUILDER_CODE?.trim() || "bc_mun_prep_app";

  return { payTo, network, facilitatorUrl, siteOrigin, appBuilderCode };
}

/**
 * Storage provider for Sign-In-With-X (SIWX / CAIP-122).
 * Tracks paid wallet addresses across memory and database records,
 * and maintains nonces to prevent signature replay attacks.
 */
export class AppSIWxStorage implements SIWxStorage {
  private readonly paidWallets = new Map<string, number>();
  private readonly nonces = new Map<string, number>();

  async hasPaid(resource: string, address: string): Promise<boolean> {
    const normAddress = address.trim().toLowerCase();
    const normResource = resource.trim().toLowerCase();
    const key = `${normResource}::${normAddress}`;

    // 1. Fast in-memory check
    if (this.paidWallets.has(key)) {
      return true;
    }

    // 2. Persistent check in database
    try {
      const admin = supabaseAdmin();
      const { data, error } = await admin
        .from("payments")
        .select("id")
        .eq("status", "paid")
        .ilike("uropay_order_id", `%${normAddress}%`)
        .limit(1);

      if (!error && data && data.length > 0) {
        this.paidWallets.set(key, Date.now());
        return true;
      }
    } catch {
      // Gracefully continue with in-memory store
    }

    return false;
  }

  async recordPayment(resource: string, address: string): Promise<void> {
    const normAddress = address.trim().toLowerCase();
    const normResource = resource.trim().toLowerCase();
    const key = `${normResource}::${normAddress}`;
    this.paidWallets.set(key, Date.now());
  }

  getNonce(): string {
    const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    this.recordNonce(nonce);
    return nonce;
  }

  verifyNonce(nonce: string): boolean {
    const ts = this.nonces.get(nonce);
    if (!ts) return false;
    // Check expiration (10 minutes)
    if (Date.now() - ts > 10 * 60 * 1000) {
      this.nonces.delete(nonce);
      return false;
    }
    // Consume nonce to prevent replay
    this.nonces.delete(nonce);
    return true;
  }

  hasUsedNonce(nonce: string): boolean {
    const ts = this.nonces.get(nonce);
    if (!ts) return false;
    // Exclude expired nonces (> 10 mins)
    if (Date.now() - ts > 10 * 60 * 1000) {
      this.nonces.delete(nonce);
      return false;
    }
    return true;
  }

  recordNonce(nonce: string): void {
    this.nonces.set(nonce, Date.now());
    // Periodically prune stale nonces if map grows
    if (this.nonces.size > 2000) {
      const now = Date.now();
      for (const [n, ts] of this.nonces.entries()) {
        if (now - ts > 10 * 60 * 1000) {
          this.nonces.delete(n);
        }
      }
    }
  }
}

let siwxStorageInstance: AppSIWxStorage | null = null;

export function getSIWxStorage(): AppSIWxStorage {
  if (!siwxStorageInstance) {
    siwxStorageInstance = new AppSIWxStorage();
  }
  return siwxStorageInstance;
}

/**
 * Idempotency store for payment-identifier extension.
 * Caches settled results to safely handle client network retries.
 */
interface CachedIdempotentResult {
  timestamp: number;
  data: unknown;
  headers: Record<string, string>;
}

const idempotencyCache = new Map<string, CachedIdempotentResult>();

export function getCachedPaymentIdResult(paymentId: string): CachedIdempotentResult | null {
  const cached = idempotencyCache.get(paymentId);
  if (!cached) return null;
  // TTL: 1 hour
  if (Date.now() - cached.timestamp > 60 * 60 * 1000) {
    idempotencyCache.delete(paymentId);
    return null;
  }
  return cached;
}

export function setCachedPaymentIdResult(
  paymentId: string,
  data: unknown,
  headers: Record<string, string> = {}
): void {
  idempotencyCache.set(paymentId, {
    timestamp: Date.now(),
    data,
    headers,
  });
  if (idempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now - v.timestamp > 60 * 60 * 1000) {
        idempotencyCache.delete(k);
      }
    }
  }
}

/**
 * Converts a `$`-prefixed price to USDC atomic units (6 decimals).
 *
 * The x402 protocol expresses amounts in atomic units, so the ledger stores the
 * same representation. Decimal-string arithmetic is used rather than floats:
 * `$0.005` must persist as exactly 5000, not as a rounded cent.
 */
export function usdPriceToAtomicUnits(price: string): number {
  const normalized = price.trim().replace(/^\$/, "");
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(normalized);

  if (!match) {
    throw new Error(`Invalid USD price: ${price}`);
  }

  const whole = match[1];
  const fraction = (match[2] ?? "").padEnd(6, "0");
  const atomic = BigInt(whole) * BigInt(1_000_000) + BigInt(fraction);

  if (atomic <= BigInt(0)) {
    throw new Error(`USD price must be greater than zero: ${price}`);
  }

  return Number(atomic);
}

let cachedHttpServer: x402HTTPResourceServer | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Resets the HTTP resource server singleton (for testing).
 */
export function resetX402HttpServerForTesting(): void {
  cachedHttpServer = null;
  initPromise = null;
}

/**
 * Price catalog for bot microtransactions.
 */
export const X402_ROUTE_PRICES = {
  aiResearch: "$0.05",
  contentPage: "$0.005",
} as const;

/**
 * Builds and initializes the x402 HTTP resource server singleton with all V2 extensions:
 * 1. Bazaar (Service Discovery Layer & Catalog)
 * 2. Builder Code (ERC-8021 Calldata Attribution)
 * 3. Payment-Identifier (Idempotency & Replay Protection)
 * 4. Sign-In-With-X (CAIP-122 Wallet Authentication for repeat access)
 */
export async function getX402HttpServer(): Promise<x402HTTPResourceServer> {
  if (cachedHttpServer && initPromise) {
    await initPromise;
    return cachedHttpServer;
  }

  const config = getX402Config();
  const siwxStorage = getSIWxStorage();

  const facilitatorClient = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
    timeoutMs: 15_000,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register("eip155:*", new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension)
    .registerExtension(builderCodeResourceServerExtension)
    .registerExtension(paymentIdentifierResourceServerExtension)
    .registerExtension(
      createSIWxResourceServerExtension({
        storage: siwxStorage,
        origin: config.siteOrigin,
      })
    );

  const routesConfig = {
    "POST /api/ai/research": {
      accepts: [
        {
          scheme: "exact",
          network: config.network as `eip155:${number}`,
          payTo: config.payTo,
          price: X402_ROUTE_PRICES.aiResearch,
        },
      ],
      description: "AI-powered MUN preparation and research query",
      mimeType: "application/json",
      resource: `${config.siteOrigin}/api/ai/research`,
      serviceName: "MUN Prep AI Research",
      tags: ["mun", "ai", "research", "un", "diplomacy"],
      iconUrl: `${config.siteOrigin}/favicon.ico`,
      extensions: {
        ...declareDiscoveryExtension({
          input: {
            committee: "UNEP",
            agenda: "Renewable energy transition and sustainable technology transfer",
            country: "France",
            experienceLevel: "Intermediate",
            tool: "research",
          },
          inputSchema: {
            properties: {
              committee: { type: "string", description: "UN committee name (e.g. UNSC, DISEC, UNEP, WHO)" },
              agenda: { type: "string", description: "Agenda topic or problem statement being simulated" },
              country: { type: "string", description: "Country assigned to the delegate" },
              experienceLevel: { type: "string", description: "Delegate experience level (e.g. Beginner, Intermediate, Advanced)" },
              tool: { type: "string", enum: ["research", "country-profile", "position-paper", "speech", "poi", "resolution"], description: "Specific MUN preparation tool to execute" },
            },
            required: ["committee", "agenda", "country", "experienceLevel"],
          },
          output: {
            example: {
              analysis: "Strategic committee analysis, previous UN resolutions, and national stance recommendations.",
              countryStance: "Commitment to decarbonization, support for multilateral financing.",
            },
            schema: {
              type: "object",
              properties: {
                analysis: { type: "string" },
                countryStance: { type: "string" },
              },
            },
          },
        }),
        [BUILDER_CODE]: declareBuilderCodeExtension(config.appBuilderCode),
        [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension(false),
        ...declareSIWxExtension({
          statement: "Sign in with your wallet to authenticate and access MUN Prep AI research",
          expirationSeconds: 300,
        }),
      },
    },
    "GET /api/x402/content": {
      accepts: [
        {
          scheme: "exact",
          network: config.network as `eip155:${number}`,
          payTo: config.payTo,
          price: X402_ROUTE_PRICES.contentPage,
        },
      ],
      description: "MUN Prep public educational knowledge base and course library",
      mimeType: "application/json",
      resource: `${config.siteOrigin}/api/x402/content`,
      serviceName: "MUN Prep Knowledge Base",
      tags: ["mun", "education", "courses", "glossary", "un"],
      iconUrl: `${config.siteOrigin}/favicon.ico`,
      extensions: {
        ...declareDiscoveryExtension({
          input: { resource: "courses", slug: "mun-basics" },
          inputSchema: {
            properties: {
              resource: {
                type: "string",
                enum: ["courses", "course", "glossary", "legal", "summary"],
                description: "Educational resource collection to retrieve",
              },
              slug: {
                type: "string",
                description: "Optional course or legal document slug identifier",
              },
            },
          },
          output: {
            example: {
              service: "MUN Prep Bot Knowledge Base",
              availableResources: [
                { resource: "courses", description: "All available MUN courses" },
                { resource: "glossary", description: "Full Model UN terminology reference" },
              ],
              price: "$0.005",
              network: "Base (EVM USDC)",
            },
            schema: {
              type: "object",
              properties: {
                service: { type: "string" },
                availableResources: { type: "array" },
              },
            },
          },
        }),
        [BUILDER_CODE]: declareBuilderCodeExtension(config.appBuilderCode),
        [PAYMENT_IDENTIFIER]: declarePaymentIdentifierExtension(false),
        ...declareSIWxExtension({
          statement: "Sign in with your wallet to access purchased MUN preparation content",
          expirationSeconds: 300,
        }),
      },
    },
  };

  const httpServer = new x402HTTPResourceServer(resourceServer, routesConfig);

  initPromise = httpServer.initialize().catch((err) => {
    logger.warn("x402HTTPResourceServer initialization notice:", {
      message: err instanceof Error ? err.message : String(err),
      network: config.network,
      facilitator: config.facilitatorUrl,
    });
  });

  await initPromise;
  cachedHttpServer = httpServer;
  return httpServer;
}

/**
 * Creates a minimal HTTPAdapter from a standard web Request.
 */
export function createWebAdapter(request: Request, body?: unknown): HTTPAdapter {
  const urlObj = new URL(request.url);

  return {
    getHeader: (name: string) => {
      return request.headers.get(name) ?? undefined;
    },
    getMethod: () => request.method.toUpperCase(),
    getPath: () => urlObj.pathname,
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "*/*",
    getUserAgent: () => request.headers.get("user-agent") ?? "",
    getBody: () => body,
    getQueryParam: (name: string) => urlObj.searchParams.get(name) ?? undefined,
  };
}

/**
 * Helper to process an incoming web request through the x402 resource server.
 *
 * Fails closed: if the facilitator could not be reached at initialization, the
 * SDK throws while building payment requirements. That is surfaced as a clean,
 * non-cacheable 503 so a caller knows to retry — never as an unhandled 500, and
 * never as access to the resource.
 */
export async function processX402Request(
  request: Request,
  routePath: string,
  method: string,
  body?: unknown
): Promise<HTTPProcessResult> {
  try {
    // Server construction is inside the try on purpose: `getX402Config()` runs
    // here and is what rejects a missing or placeholder payout address. Outside
    // the try, that misconfiguration escaped as an unhandled 500.
    const server = await getX402HttpServer();
    const adapter = createWebAdapter(request, body);

    return await server.processHTTPRequest({
      adapter,
      path: routePath,
      method: method.toUpperCase(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Misconfiguration: the payout address is missing or a placeholder. This
    // is raised by `assertValidPayTo` before any network call. Surfaced as a
    // named 503 rather than an opaque 500 so the operator can see what to fix —
    // the route stays closed, which is the point.
    if (message.includes("X402_PAY_TO")) {
      logger.error("x402 payout address is not configured — paid route closed", {
        routePath,
        method,
      });

      throw new ApiError(
        503,
        "payment_rail_misconfigured",
        "Paid access is temporarily unavailable. Please retry shortly."
      );
    }

    // Raised when initialize() could not load supported kinds from any
    // facilitator, i.e. the payment rail is unreachable.
    if (
      message.includes("Facilitator does not support") ||
      message.toLowerCase().includes("initializ")
    ) {
      logger.error("x402 facilitator unavailable — refusing to serve paid route", {
        routePath,
        method,
        message,
      });

      throw new ApiError(
        503,
        "payment_rail_unavailable",
        "The payment service is temporarily unavailable. Please retry shortly."
      );
    }

    throw error;
  }
}

/**
 * Result of `processX402Request` when a payment has verified and is ready to
 * settle. Exported so the fulfilment pipeline can be typed against it.
 */
export type X402PaymentVerifiedResult = Extract<
  HTTPProcessResult,
  { type: "payment-verified" }
>;

/**
 * Converts x402 HTTPResponseInstructions into a standard web Response.
 *
 * All negotiation and error traffic is marked non-cacheable: a 402 challenge
 * embeds live payment requirements, and a settlement failure carries
 * transaction-specific headers. Neither may be replayed from a shared cache.
 */
export function buildX402Response(processResult: {
  response: {
    status: number;
    headers: Record<string, string>;
    body?: unknown;
  };
}): Response {
  const { status, headers, body } = processResult.response;
  const responseHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== null) {
      responseHeaders.set(key, value);
    }
  }

  if (!responseHeaders.has("Cache-Control")) {
    responseHeaders.set("Cache-Control", X402_PAYMENT_CACHE_CONTROL);
  }

  if (body !== undefined && body !== null && typeof body !== "string") {
    if (!responseHeaders.has("Content-Type")) {
      responseHeaders.set("Content-Type", "application/json");
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: responseHeaders,
    });
  }

  return new Response((body as string) ?? null, {
    status,
    headers: responseHeaders,
  });
}

/**
export function applyPaidContentCachePolicy(response: Response): Response {
  response.headers.set("Cache-Control", X402_PAID_CONTENT_CACHE_CONTROL);
  return response;
}

/**
 * Records a verified bot microtransaction in the payments ledger for reporting.
 * Provider is marked as 'x402'; the authoritative single-use record lives in
 * `public.x402_payment_claims`.
 *
 * `uid` is intentionally null: machine callers have no `auth.users` row, and
 * the ledger's CHECK constraint permits an ownerless row only for the x402
 * plan. The previous implementation wrote the all-zero UUID, which violated
 * the foreign key on every insert — so nothing was ever recorded.
 *
 * `amount` is stored in USDC atomic units (6 decimals), matching how x402
 * expresses amounts; the row is disambiguated by `currency: "USDC"`.
 *
 * Failures are reported at error level but never thrown: this row is reporting,
 * not access control, and a settled payer must still receive what they bought.
 *
 * If payerAddress is provided, the payer wallet will also be recorded in the
 * SIWX storage so repeat visits can be granted access via SIWX without repaying.
 */
 */
export async function recordX402Payment(params: {
  orderRef: string;
  amountUsd: string;
  network: string;
  payerAddress?: string;
  transactionHash?: string;
  status: "paid" | "verified";
  route?: string;
  resourceKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  // If payerAddress is provided, record it in the SIWX storage for repeat access
  if (params.payerAddress) {
    const resourcePath = (params.metadata?.path as string) || "/api/x402/content";
    const siwx = getSIWxStorage();
    await siwx.recordPayment(resourcePath, params.payerAddress);
  }


  try {
    const atomicAmount = usdPriceToAtomicUnits(params.amountUsd);
    const admin = supabaseAdmin();

    const { error } = await admin.from("payments").insert({
      uid: null,
      order_ref: params.orderRef,
      uropay_order_id: params.transactionHash || params.payerAddress || params.orderRef,
      plan_id: "x402-bot-microtransaction",
      amount: atomicAmount,
      status: params.status,
      currency: "USDC",
      environment: params.network.includes("84532") ? "test" : "production",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // 23505 on order_ref means this exact payment was already recorded.
      if (error.code === "23505") {
        logger.warn("x402 ledger row already present for this payment", {
          orderRef: params.orderRef,
        });
        return true;
      }

      logger.error(
        "ALERT: x402 payment settled but the reporting ledger row failed to write",
        {
          error: error.message,
          orderRef: params.orderRef,
          transactionHash: params.transactionHash,
          route: params.route,
          resourceKey: params.resourceKey,
        }
      );
      return false;
    }

    return true;
  } catch (err) {
    logger.error("ALERT: x402 ledger write threw after settlement", {
      error: err instanceof Error ? err.message : String(err),
      orderRef: params.orderRef,
      route: params.route,
    });
    return false;
  }
}
