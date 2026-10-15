import { NextResponse } from "next/server";
import { X402_ROUTE_PRICES } from "@/lib/server/x402-server";

export const runtime = "nodejs";

/**
 * GET /api/x402
 *
 * Public discovery and entrypoint for the MUN Prep x402 microtransaction rail.
 * - If query parameters (e.g. ?resource=courses) or x402 payment headers are present,
 *   redirects the caller to /api/x402/content with the parameters preserved.
 * - Otherwise, returns the service discovery metadata, route catalog, and available resources.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // If the caller is targeting a specific content resource or presents x402 payment headers,
  // route them to the dedicated content handler.
  const hasResourceParam = url.searchParams.has("resource") || url.searchParams.has("slug");
  const hasPaymentHeaders =
    request.headers.has("payment-signature") ||
    request.headers.has("PAYMENT-SIGNATURE") ||
    request.headers.has("x-payment") ||
    request.headers.has("X-PAYMENT");

  if (hasResourceParam || hasPaymentHeaders) {
    const redirectUrl = new URL(`/api/x402/content${url.search}`, url.origin);
    return NextResponse.redirect(redirectUrl, 307);
  }

  const discoveryData = {
    service: "MUN Prep x402 API",
    version: "2.0",
    protocol: "x402",
    description: "Machine-to-machine micropayment API for AI research and Model UN educational content.",
    endpoints: {
      content: {
        path: "/api/x402/content",
        method: "GET",
        price: X402_ROUTE_PRICES.contentPage,
        description: "Educational knowledge base, courses, glossary, and legal documents for crawlers and bots",
        parameters: {
          resource: {
            type: "string",
            enum: ["courses", "course", "glossary", "legal", "summary"],
            description: "Educational resource collection to retrieve",
            default: "summary",
          },
          slug: {
            type: "string",
            description: "Optional course or legal document slug identifier",
          },
        },
      },
      research: {
        path: "/api/ai/research",
        method: "POST",
        price: X402_ROUTE_PRICES.aiResearch,
        description: "AI-powered Model UN research, speech drafting, and committee strategy queries",
      },
    },
    availableResources: [
      { resource: "courses", description: "All available MUN courses" },
      { resource: "course", query: "?resource=course&slug=mun-basics", description: "Full course with lessons" },
      { resource: "glossary", description: "Full Model UN terminology reference" },
      { resource: "legal", description: "Terms, privacy, policies, and disclosures" },
    ],
  };

  return NextResponse.json(discoveryData, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

/** OPTIONS /api/x402 — declares supported methods. */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, HEAD, OPTIONS",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

/** HEAD /api/x402 — returns 200 OK headers without body. */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
