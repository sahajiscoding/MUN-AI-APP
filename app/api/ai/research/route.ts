import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { runMunResearch } from "@/lib/ai/router";
import { requireUser } from "@/lib/server/auth";
import { assertPaidAccess } from "@/lib/server/entitlements";
import { requireAdmin } from "@/lib/server/admin-auth";
import { saveChatTranscript } from "@/lib/server/chat-storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  committee: z.string().min(2),
  agenda: z.string().min(5),
  country: z.string().min(2),
  experienceLevel: z.string().min(2),
  tool: z.enum(["research", "country-profile", "position-paper", "speech", "poi", "resolution"]).optional(),
  provider: z.enum(["openrouter", "nvidia"]).optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
});

type GenerationDetails = {
  chatId: string;
  uid: string;
  tool: string;
  provider: string;
  model: string;
  inputSummary: Record<string, unknown>;
  prompt: string;
  output: string;
};

export async function POST(request: Request) {
  try {
    let uid: string;
    try {
      const user = await requireUser(request);
      await assertPaidAccess(user.uid);
      uid = user.uid;
    } catch (error) {
      // A regular user who lacks Premium must still receive the paywall error;
      // only a separately verified administrator session may bypass it.
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
      const admin = await requireAdmin();
      uid = admin.uid;
    }

    const body = schema.safeParse(await parseJson<unknown>(request));
    if (!body.success) {
      throw new ApiError(400, "invalid_research_request", "Add committee, agenda, and country.");
    }

    const chatId = crypto.randomUUID();
    const tool = body.data.tool || "research";
    const inputSummary = {
      committee: body.data.committee,
      country: body.data.country,
      agenda: body.data.agenda.slice(0, 500),
    };
    const result = await runMunResearch(body.data);

    if (result.stream) {
      const persistedStream = persistStream(result.stream, {
        chatId,
        uid,
        tool,
        provider: result.provider,
        model: result.model,
        inputSummary,
        prompt: body.data.agenda,
      });

      return new Response(persistedStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "X-Chat-Id": chatId,
        },
      });
    }

    const output = result.content || "";
    await saveCompletedChat({
      chatId,
      uid,
      tool,
      provider: result.provider,
      model: result.model,
      inputSummary,
      prompt: body.data.agenda,
      output,
    });

    return Response.json({ ...result, chatId });
  } catch (error) {
    return jsonError(error);
  }
}

function persistStream(
  source: ReadableStream<Uint8Array>,
  details: Omit<GenerationDetails, "output">
) {
  const reader = source.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const decoder = new TextDecoder();
      let content = "";
      let buffer = "";

      const consumeLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as { content?: string };
          if (parsed.content) content += parsed.content;
        } catch {
          // Ignore incomplete or provider-specific SSE lines.
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          controller.enqueue(value);
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          lines.forEach(consumeLine);
        }

        buffer += decoder.decode();
        if (buffer) consumeLine(buffer);
        if (content) await saveCompletedChat({ ...details, output: content });
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function saveCompletedChat(details: GenerationDetails) {
  await saveChatTranscript({
    id: details.chatId,
    uid: details.uid,
    tool: details.tool,
    provider: details.provider,
    model: details.model,
    inputSummary: details.inputSummary,
    prompt: details.prompt,
    output: details.output,
    createdAt: new Date().toISOString(),
  });

  const { error } = await supabaseAdmin().from("ai_generations").insert({
    id: details.chatId,
    uid: details.uid,
    tool: details.tool,
    provider: details.provider,
    model: details.model,
    input_summary: details.inputSummary,
    output: details.output,
  });

  if (error) {
    console.error("Failed to index generation in Supabase:", error.message);
  }
}
