import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  whatsapp: z.string().trim().max(40).optional(),
  note: z.string().trim().max(2000).optional(),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(500).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`partner-application:${ip}`, 5, 60 * 60 * 1000))) {
      throw new ApiError(429, "too_many_requests", "Too many applications from this connection. Try again later.");
    }

    const parsed = schema.safeParse(await parseJson<unknown>(request));
    if (!parsed.success) {
      throw new ApiError(400, "invalid_application", "Please fill in your name and a valid email address.");
    }

    // Silent success for bots that fill the honeypot.
    if (parsed.data.website) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const { error } = await supabaseAdmin().from("partner_applications").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp?.trim() || null,
      note: parsed.data.note?.trim() || null,
    });

    if (error) {
      console.error("Partner application insert failed:", error.message);
      throw new ApiError(500, "application_failed", "Could not submit your application. Please try again.");
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
