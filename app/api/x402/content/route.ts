import { NextResponse } from "next/server";
import { courses } from "@/lib/courses";
import { legalPages } from "@/lib/site-pages";
import { isBotRequest } from "@/lib/server/bot-detection";
import { requireUser } from "@/lib/server/auth";
import { jsonError } from "@/lib/api";
import {
  processX402Request,
  buildX402Response,
  recordX402Payment,
  X402_ROUTE_PRICES,
} from "@/lib/server/x402-server";

export const runtime = "nodejs";

const glossaryTerms = [
  { term: "Agenda", definition: "The topic or issue being discussed in a committee session." },
  { term: "Amendment", definition: "A change or addition proposed to a draft resolution." },
  { term: "Bloc", definition: "An informal alliance of delegates who share similar positions on an issue." },
  { term: "Chair", definition: "The person who presides over a committee session and enforces rules of procedure." },
  { term: "Caucus", definition: "A meeting of delegates to discuss and negotiate outside formal session." },
  { term: "Chatham House Rules", definition: "A rule where participants can share information freely but cannot attribute it to specific individuals." },
  { term: "Crisis Committee", definition: "A fast-paced committee simulating emergency situations requiring quick decisions." },
  { term: "Draft Resolution", definition: "The formal document containing proposed solutions to the agenda topic." },
  { term: "Dais", definition: "The raised platform where the chair and vice-chairs sit." },
  { term: "Delegate", definition: "A student representing a specific country in a committee." },
  { term: "Floor", definition: "The area where delegates sit; also refers to the right to speak." },
  { term: "General Assembly (GA)", definition: "The main deliberative body of the UN where all member states are represented." },
  { term: "General Speaker's List (GSL)", definition: "A list of delegates who wish to speak on the topic in formal debate." },
  { term: "Moderated Caucus", definition: "A structured debate where the chair calls on delegates to speak for short intervals on a sub-topic." },
  { term: "Motion", definition: "A formal proposal to take an action." },
  { term: "Operative Clause", definition: "The action-oriented section of a resolution that proposes specific measures." },
  { term: "Position Paper", definition: "A formal document outlining a country's stance on the agenda topic." },
  { term: "Unmoderated Caucus", definition: "A break from formal debate where delegates move freely to negotiate and form blocs." },
  { term: "Veto", definition: "The power of the 5 permanent UNSC members to block any substantive resolution." },
  { term: "Working Paper", definition: "An unofficial draft document submitted for discussion before it becomes a draft resolution." },
  { term: "Yields", definition: "When a speaker gives up remaining time — to questions, to the chair, or to another delegate." },
];

/**
 * GET /api/x402/content
 *
 * Microtransaction-gated content API for crawlers and bots.
 * Query params:
 * - resource: 'courses' | 'course' | 'glossary' | 'legal'
 * - slug: optional specific course slug or legal slug
 *
 * Bots requesting this route without payment receive standard HTTP 402 with PAYMENT-REQUIRED header.
 * Once verified/settled via x402, the content payload is returned with PAYMENT-RESPONSE headers.
 */
export async function GET(request: Request) {
  try {
    if (!isBotRequest(request)) {
      await requireUser(request);
    }

    const url = new URL(request.url);
  const resource = url.searchParams.get("resource") || "summary";
  const slug = url.searchParams.get("slug") || "";

  // Run through x402 processor for the content route
  const processResult = await processX402Request(
    request,
    "/api/x402/content",
    "GET"
  );

  if (processResult.type === "payment-error") {
    return buildX402Response(processResult);
  }

  let settlementHeaders: Record<string, string> = {};
  if (processResult.type === "payment-verified") {
    // Settle with facilitator
    const settleResult = await (
      await import("@/lib/server/x402-server")
    )
      .getX402HttpServer()
      .then((server) =>
        server.processSettlement(
          processResult.paymentPayload,
          processResult.paymentRequirements,
          processResult.declaredExtensions
        )
      );

    if (!settleResult.success) {
      return buildX402Response({ response: settleResult.response });
    }

    settlementHeaders = settleResult.headers;

    // Record verified transaction in payments ledger
    const orderRef = `x402-${crypto.randomUUID()}`;
    await recordX402Payment({
      orderRef,
      amountUsd: X402_ROUTE_PRICES.contentPage,
      network: processResult.paymentRequirements.network,
      transactionHash: settleResult.transaction,
      status: "paid",
      metadata: { resource, slug },
    });
  }

  // Construct requested content data
  let data: unknown;

  if (resource === "courses") {
    data = {
      courses: courses.map((c) => ({
        slug: c.slug,
        title: c.title,
        category: c.category,
        description: c.description,
        lessonCount: c.lessons.length,
      })),
    };
  } else if (resource === "course" && slug) {
    const course = courses.find((c) => c.slug === slug);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    data = { course };
  } else if (resource === "glossary") {
    data = { glossary: glossaryTerms };
  } else if (resource === "legal") {
    if (slug && legalPages[slug]) {
      data = { page: legalPages[slug] };
    } else {
      data = { pages: legalPages };
    }
  } else {
    data = {
      service: "MUN Prep Bot Knowledge Base",
      availableResources: [
        { resource: "courses", description: "All available MUN courses" },
        { resource: "course", query: "?resource=course&slug=mun-basics", description: "Full course with lessons" },
        { resource: "glossary", description: "Full Model UN terminology reference" },
        { resource: "legal", description: "Terms, privacy, policies, and disclosures" },
      ],
      price: X402_ROUTE_PRICES.contentPage,
      network: "Base (EVM USDC)",
    };
  }

  const response = NextResponse.json(data);
  for (const [key, value] of Object.entries(settlementHeaders)) {
    response.headers.set(key, value);
  }

    return response;
  } catch (error) {
    return jsonError(error);
  }
}
