import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { runMunResearch } from "@/lib/ai/router";
import { requireUser } from "@/lib/server/auth";
import { assertPaidAccess } from "@/lib/server/entitlements";
import { requireAdmin } from "@/lib/server/admin-auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { loadChatTranscript, saveChatTranscript, type ChatTurn } from "@/lib/server/chat-storage";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  committee: z.string().trim().min(2).max(160),
  agenda: z.string().trim().min(5).max(6000),
  country: z.string().trim().min(2).max(120),
  experienceLevel: z.string().trim().min(2).max(40),
  tool: z.enum(["research", "country-profile", "position-paper", "speech", "poi", "resolution"]).optional(),
  responseMode: z.enum(["quick", "thorough", "max"]).default("quick"),
  maxTokens: z.number().int().min(256).max(12000).optional(),
  temperature: z.number().min(0).max(1.5).optional(),
  chatId: z.string().uuid().optional(),
  conversation: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(12000),
  })).max(12).superRefine((turns, context) => {
    if (turns.reduce((total, turn) => total + turn.content.length, 0) > 36_000) {
      context.addIssue({ code: "custom", message: "Conversation context is too large." });
    }
  }).optional(),
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
  turns: ChatTurn[];
};

type StreamPersistenceDetails = Omit<GenerationDetails, "output">;

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

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`ai-user:${uid}`, 12, 60_000) || !checkRateLimit(`ai-ip:${ip}`, 30, 60_000)) {
      throw new ApiError(429, "rate_limited", "Too many AI requests. Please wait a minute and try again.");
    }

    const body = schema.safeParse(await parseJson<unknown>(request));
    if (!body.success) {
      const detail = body.error.issues[0]
        ? `${body.error.issues[0].path.join(".") || "request"}: ${body.error.issues[0].message}`
        : "invalid request";
      throw new ApiError(400, "invalid_research_request", `Your request could not be processed (${detail}). Please check your inputs and try again.`);
    }

    const existing = body.data.chatId ? await loadOwnedChat(uid, body.data.chatId) : null;
    if (body.data.chatId && !existing) {
      throw new ApiError(404, "chat_not_found", "That saved chat could not be found.");
    }

    const chatId = body.data.chatId || crypto.randomUUID();
    const priorTurns = limitTurns(existing?.turns ?? body.data.conversation ?? []);
    const tool = existing?.tool || body.data.tool || "research";
    const inputSummary = existing?.inputSummary ?? {
      committee: body.data.committee,
      country: body.data.country,
      agenda: body.data.agenda.slice(0, 500),
    };
    const result = await runMunResearch({ ...body.data, tool, conversation: priorTurns });

    if (result.stream) {
      const persistedStream = persistStream(result.stream, {
        chatId,
        uid,
        tool,
        provider: result.provider,
        model: result.model,
        inputSummary,
        prompt: body.data.agenda,
        turns: priorTurns.concat({ role: "user", content: body.data.agenda }),
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
      turns: priorTurns.concat(
        { role: "user", content: body.data.agenda },
        { role: "assistant", content: output }
      ),
    });

    return Response.json({ ...result, chatId });
  } catch (error) {
    return jsonError(error);
  }
}

function persistStream(
  source: ReadableStream<Uint8Array>,
  details: StreamPersistenceDetails
) {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let content = "";
  let buffer = "";
  let cancelled = false;

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

  return new ReadableStream<Uint8Array>({
    async start(controller) {
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
        if (!cancelled && content) {
          await saveCompletedChat({
            ...details,
            output: content,
            turns: details.turns.concat({ role: "assistant", content }),
          });
        }
        if (!cancelled) controller.close();
      } catch (error) {
        if (!cancelled) controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      cancelled = true;
      await reader.cancel(reason);
    },
  });
}

function limitTurns(turns: ChatTurn[]) {
  const selected: ChatTurn[] = [];
  let total = 0;
  for (const turn of turns.slice(-12).reverse()) {
    const content = turn.content.trim().slice(0, 12_000);
    if (!content || total + content.length > 36_000) break;
    selected.unshift({ role: turn.role, content });
    total += content.length;
  }
  return selected;
}

async function loadOwnedChat(uid: string, chatId: string) {
  const stored = await loadChatTranscript(uid, chatId);
  if (stored && stored.uid === uid) return stored;

  const { data, error } = await supabaseAdmin()
    .from("ai_generations")
    .select("id, uid, tool, provider, model, input_summary, output, created_at")
    .eq("id", chatId)
    .eq("uid", uid)
    .maybeSingle();

  if (error || !data) return null;
  const summary = (data.input_summary ?? {}) as Record<string, unknown>;
  const prompt = typeof summary.agenda === "string" ? summary.agenda : "";
  const output = typeof data.output === "string" ? data.output : "";
  const rawTurns = Array.isArray(summary.turns) ? summary.turns : [];
  const turns = rawTurns.length > 0 ? limitTurns(rawTurns as ChatTurn[]) : [
    ...(prompt ? [{ role: "user" as const, content: prompt }] : []),
    ...(output ? [{ role: "assistant" as const, content: output }] : []),
  ];

  return {
    id: data.id,
    uid: data.uid,
    tool: data.tool,
    provider: data.provider,
    model: data.model,
    inputSummary: summary,
    prompt,
    output,
    turns,
    createdAt: data.created_at,
  };
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
    turns: details.turns,
    createdAt: new Date().toISOString(),
  });

  const { error } = await supabaseAdmin().from("ai_generations").upsert({
    id: details.chatId,
    uid: details.uid,
    tool: details.tool,
    provider: details.provider,
    model: details.model,
    input_summary: { ...details.inputSummary, turns: details.turns },
    output: details.output,
    created_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) {
    console.error("Failed to index generation in Supabase:", error.message);
  }
}
