import { apiNotFound } from "@/lib/api";

export const runtime = "nodejs";

// Any /api/* path without its own route file falls through to here.
// Returning JSON (instead of Next.js's default HTML 404 page) keeps
// fetch().json() callers and scanners like ZAP from hitting
// "JSON.parse: unexpected character at line 1 column 1" on "<!DOCTYPE...".
/** GET /api/* — returns JSON 404 for unmatched API routes. */
export async function GET() {
  return apiNotFound();
}

/** POST /api/* — returns JSON 404 for unmatched API routes. */
export async function POST() {
  return apiNotFound();
}

/** PUT /api/* — returns JSON 404 for unmatched API routes. */
export async function PUT() {
  return apiNotFound();
}

/** PATCH /api/* — returns JSON 404 for unmatched API routes. */
export async function PATCH() {
  return apiNotFound();
}

/** DELETE /api/* — returns JSON 404 for unmatched API routes. */
export async function DELETE() {
  return apiNotFound();
}

/** OPTIONS /api/* — returns JSON 404 for unmatched API routes. */
export async function OPTIONS() {
  return apiNotFound();
}

/** HEAD /api/* — returns JSON 404 for unmatched API routes. */
export async function HEAD() {
  return apiNotFound();
}
