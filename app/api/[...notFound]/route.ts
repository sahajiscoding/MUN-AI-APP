import { apiNotFound } from "@/lib/api";

export const runtime = "nodejs";

// Any /api/* path without its own route file falls through to here.
// Returning JSON (instead of Next.js's default HTML 404 page) keeps
// fetch().json() callers and scanners like ZAP from hitting
// "JSON.parse: unexpected character at line 1 column 1" on "<!DOCTYPE...".
export async function GET() {
  return apiNotFound();
}

export async function POST() {
  return apiNotFound();
}

export async function PUT() {
  return apiNotFound();
}

export async function PATCH() {
  return apiNotFound();
}

export async function DELETE() {
  return apiNotFound();
}

export async function OPTIONS() {
  return apiNotFound();
}

export async function HEAD() {
  return apiNotFound();
}
