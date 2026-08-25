import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { runMunResearch } from "@/lib/ai/router";
import { requireUser } from "@/lib/server/auth";
import { assertPaidAccess } from "@/lib/server/entitlements";
import { getAdminSession } from "@/lib/server/admin-auth";

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
    // Admin bypass: check for admin session cookie first
    const adminSession = await getAdminSession();
    const authHeader = request.headers.get("Authorization");
    const isAdminBypass = authHeader === "Bearer admin-bypass" && adminSession;

    let uid: string;
    if (isAdminBypass) {
      uid = adminSession.uid;
    } else {
      const user = await requireUser(request);
      await assertPaidAccess(user.uid);
      uid = user.uid;
    }

    const body = schema.safeParse(await parseJson<unknown>(request));

    if (!body.success) {
      throw new ApiError(400, "invalid_research_request", "Add committee, agenda, and country.");
    }

    const result = await runMunResearch(body.data);

    // If streaming, return SSE response
    if (result.stream) {
      const provider = result.provider;
      const model = result.model;
      const inputSummary = {
        committee: body.data.committee,
        country: body.data.country,
        agenda: body.data.agenda.slice(0, 500),
      };

      // Tee the stream: one copy goes to client, one is collected for DB
      const [clientStream, dbStream] = result.stream.tee();

      // Background: collect content from dbStream and save to DB
      collectAndSave(dbStream, uid, provider, model, inputSummary);

      return new Response(clientStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming fallback
    await supabaseAdmin().from("ai_generations").insert({
      uid,
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

async function collectAndSave(
  stream: ReadableStream<Uint8Array>,
  uid: string,
  provider: string,
  model: string,
  inputSummary: Record<string, unknown>
) {
  try {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let content = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) content += parsed.content;
          } catch {
            // skip
          }
        }
      }
    }

    if (content) {
      await supabaseAdmin().from("ai_generations").insert({
        uid,
        tool: "mun-research",
        provider,
        model,
        input_summary: inputSummary,
        output: content,
      });
    }
  } catch (err) {
    console.error("Failed to save generation:", err);
  }
}
