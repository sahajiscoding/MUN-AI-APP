import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  x402HTTPResourceServer,
  decodePaymentSignatureHeader,
  type HTTPAdapter,
  type HTTPProcessResult,
} from "@x402/core/http";
import { logger } from "@/lib/server/secure-logger";
import { supabaseAdmin } from "@/lib/supabase/server";

export type NetworkCaip2 = `eip155:${number}` | string;

export interface X402ServerConfig {
  payTo: string;
  network: NetworkCaip2;
  facilitatorUrl: string;
}

/**
 * Returns x402 server configuration.
 * Defaults to Base Sepolia testnet (`eip155:84532`) with the official testnet facilitator,
 * allowing live end-to-end testing with Circle faucet USDC.
 * Set `X402_NETWORK=eip155:8453` in production for Base mainnet.
 */
export function getX402Config(): X402ServerConfig {
  const payTo =
    process.env.X402_PAY_TO?.trim() ||
    "0x0000000000000000000000000000000000000001";

  const network =
    (process.env.X402_NETWORK?.trim() as NetworkCaip2) || "eip155:84532";

  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL?.trim() ||
    "https://x402.org/facilitator";

  return { payTo, network, facilitatorUrl };
}

let cachedHttpServer: x402HTTPResourceServer | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Price catalog for bot microtransactions.
 */
export const X402_ROUTE_PRICES = {
  aiResearch: "$0.05",
  contentPage: "$0.005",
} as const;

/**
 * Builds and initializes the x402 HTTP resource server singleton.
 */
export async function getX402HttpServer(): Promise<x402HTTPResourceServer> {
  if (cachedHttpServer && initPromise) {
    await initPromise;
    return cachedHttpServer;
  }

  const config = getX402Config();

  const facilitatorClient = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
    timeoutMs: 15_000,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    "eip155:*",
    new ExactEvmScheme()
  );

  const routesConfig = {
    "POST /api/ai/research": {
      accepts: {
        scheme: "exact",
        network: config.network as `eip155:${number}`,
        payTo: config.payTo,
        price: X402_ROUTE_PRICES.aiResearch,
      },
      description: "AI-powered MUN preparation and research query",
      mimeType: "application/json",
    },
    "GET /api/x402/content": {
      accepts: {
        scheme: "exact",
        network: config.network as `eip155:${number}`,
        payTo: config.payTo,
        price: X402_ROUTE_PRICES.contentPage,
      },
      description: "MUN Prep public educational knowledge base and course library",
      mimeType: "application/json",
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
 */
export async function processX402Request(
  request: Request,
  routePath: string,
  method: string,
  body?: unknown
): Promise<HTTPProcessResult> {
  const server = await getX402HttpServer();
  const adapter = createWebAdapter(request, body);

  return server.processHTTPRequest({
    adapter,
    path: routePath,
    method: method.toUpperCase(),
  });
}

/**
 * Converts x402 HTTPResponseInstructions into a standard web Response.
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
 * Records a verified bot microtransaction in the payments table for reporting.
 * Provider is marked as 'x402'.
 */
export async function recordX402Payment(params: {
  orderRef: string;
  amountUsd: string;
  network: string;
  payerAddress?: string;
  transactionHash?: string;
  status: "paid" | "verified";
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("payments").insert({
      uid: "00000000-0000-0000-0000-000000000000",
      order_ref: params.orderRef,
      uropay_order_id: params.transactionHash || params.orderRef,
      plan_id: "x402-bot-microtransaction",
      amount: Math.round(Number(params.amountUsd.replace("$", "")) * 100),
      status: params.status,
      currency: "USDC",
      environment: params.network.includes("84532") ? "test" : "production",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // Table may require foreign key on uid or unique index constraint in some environments.
      // Log as structured notice without throwing to avoid failing payment fulfillment.
      logger.warn("x402 payment audit record notice:", {
        error: error.message,
        orderRef: params.orderRef,
      });
    }
  } catch (err) {
    logger.warn("x402 payment recording exception:", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
