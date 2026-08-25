import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { runMunResearch } from "@/lib/ai/router";
import { requireUser } from "@/lib/server/auth";
import { assertPaidAccess } from "@/lib/server/entitlements";

export const runtime = "nodejs";

const schema = z.object({
  committee: z.string().min(2),
  agenda: z.string().min(5),
  country: z.string().min(2),
  experienceLevel: z.string().min(2),
  provider: z.enum(["openrouter", "nvidia"]).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    await assertPaidAccess(user.uid);

    const body = schema.safeParse(await parseJson<unknown>(request));

    if (!body.success) {
      throw new ApiError(400, "invalid_research_request", "Add committee, agenda, and country.");
    }

    const result = await runMunResearch(body.data);

    await supabaseAdmin().from("ai_generations").insert({
      uid: user.uid,
      tool: "mun-research",
      provider: result.provider,
      model: result.model,
      input_summary: {
        committee: body.data.committee,
        country: body.data.country,
        agenda: body.data.agenda.slice(0, 500),
      },
      output: result.content,
    });

    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
