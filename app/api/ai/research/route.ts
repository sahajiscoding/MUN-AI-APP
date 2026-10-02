import { z } from "zod";
import { ApiError, jsonError, parseJson } from "@/lib/api";
import { runMunResearch } from "@/lib/ai/router";
import { requireUser } from "@/lib/server/auth";
import { assertPaidAccess } from "@/lib/server/entitlements";
import { requireAdmin } from "@/lib/server/admin-auth";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { estimateAiTokens, reserveAiUsage, settleAiUsage } from "@/lib/server/ai-usage";
import { accumulateUsage, parseSSEPayload } from "@/lib/ai/sse";
import { loadChatTranscript, saveChatTranscript, type ChatTurn } from "@/lib/server/chat-storage";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logger } from "@/lib/server/secure-logger";

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
  // Intercepting proxies (e.g., ZAP, corporate gateways) can buffer or
  // mangle `text/event-stream` bodies while keeping the headers. Clients
  // that detect a damaged stream retry once with `stream: false` to get
  // the same answer as plain JSON, which passes through proxies untouched.
  stream: z.boolean().optional(),
  conversation: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(12000),
  })).max(12).superRefine((turns, context) => {
    if (turns.reduce((total, turn) => total + turn.content.length, 0) > 36_000) {
      context.addIssue({ code: "custom", message: "Conversation context is too large." });
    }
  }).optional(),
});

// Mirrors lib/ai/router.ts mode ceilings so the reservation covers the
// worst-case completion the provider is allowed to generate.
const MODE_COMPLETION_CEILINGS = { quick: 4096, thorough: 8000, max: 12000 } as const;

function completionTokenCeiling(
  mode: keyof typeof MODE_COMPLETION_CEILINGS,
  requested?: number
): number {
  const ceiling = MODE_COMPLETION_CEILINGS[mode];
  return requested && requested < ceiling ? requested : ceiling;
}

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

type StreamPersistenceDetails = Omit<GenerationDetails, "output"> & {
  reservationId: string;
  promptEstimate: number;
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
      const detail = body.error.issues[0]
        ? `${body.error.issues[0].path.join(".") || "request"}: ${body.error.issues[0].message}`
        : "invalid request";
      throw new ApiError(400, "invalid_research_request", `Your request could not be processed (${detail}). Please check your inputs and try again.`);
    }

    const ip = getClientIp(request);
    // These checks are independent of each other, so run them together
    // instead of one after another to reach the provider faster.
    const [userAllowed, ipAllowed, existing] = await Promise.all([
      checkRateLimit(`ai-user:${uid}`, 12, 60_000),
      checkRateLimit(`ai-ip:${ip}`, 30, 60_000),
      body.data.chatId ? loadOwnedChat(uid, body.data.chatId) : Promise.resolve(null),
    ]);
    if (!userAllowed || !ipAllowed) {
      throw new ApiError(429, "rate_limited", "Too many AI requests. Please wait a minute and try again.");
    }
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

    // Check-and-reserve is a single atomic RPC: the request budget and the
    // worst-case prompt+completion tokens are claimed before any provider
    // spend, so concurrent requests cannot each pass a stale reading.
    const promptEstimate = estimateAiTokens(
      [body.data.agenda, ...priorTurns.map((turn) => turn.content)].join("\n")
    );
    const completionCeiling = completionTokenCeiling(body.data.responseMode, body.data.maxTokens);
    const reservation = await reserveAiUsage(uid, promptEstimate + completionCeiling);

    let result: Awaited<ReturnType<typeof runMunResearch>>;
    try {
      result = await runMunResearch({ ...body.data, tool, conversation: priorTurns });
    } catch (error) {
      // Provider work never started or failed outright: release the budget.
      await settleAiUsage(reservation.id, 0);
      throw error;
    }

    // Belt-and-braces abort: the platform usually cancels the response stream
    // on disconnect (which propagates through persistStream), but the request
    // signal fires even in cases where the body is never consumed.
    if (typeof result.cancel === "function") {
      if (request.signal.aborted) {
        result.cancel();
      } else {
        request.signal.addEventListener("abort", () => result.cancel?.(), { once: true });
      }
    }

    if (result.stream && body.data.stream === false) {
      const collected = await collectStreamContent(result.stream);
      const collectedTokens = collected.promptTokens + collected.completionTokens;
      if (!collected.content) {
        await settleAiUsage(
          reservation.id,
          collectedTokens > 0 ? collectedTokens : promptEstimate
        );
        throw new ApiError(
          502,
          "empty_provider_response",
          collected.streamError || "The AI returned an empty response. Please try again."
        );
      }
      try {
        await saveCompletedChat({
          chatId,
          uid,
          tool,
          provider: result.provider,
          model: result.model,
          inputSummary,
          prompt: body.data.agenda,
          output: collected.content,
          turns: priorTurns.concat(
            { role: "user", content: body.data.agenda },
            { role: "assistant", content: collected.content }
          ),
        });
      } finally {
        await settleAiUsage(
          reservation.id,
          collectedTokens > 0
            ? collectedTokens
            : promptEstimate + estimateAiTokens(collected.content)
        );
      }
      return Response.json({
        content: collected.content,
        chatId,
        provider: result.provider,
        model: result.model,
        finishReason: collected.finishReason || "stop",
      });
    }

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
        reservationId: reservation.id,
        promptEstimate,
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
    const reportedTokens = (result.usage?.promptTokens ?? 0) + (result.usage?.completionTokens ?? 0);
    try {
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
    } finally {
      await settleAiUsage(
        reservation.id,
        reportedTokens > 0 ? reportedTokens : promptEstimate + estimateAiTokens(output)
      );
    }

    return Response.json({ ...result, chatId });
  } catch (error) {
    return jsonError(error);
  }
}

type CollectedStream = {
  content: string;
  finishReason?: string;
  streamError?: string;
  promptTokens: number;
  completionTokens: number;
};

// Drain a provider SSE stream fully (used by the non-streaming JSON mode).
async function collectStreamContent(source: ReadableStream<Uint8Array>): Promise<CollectedStream> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | undefined;
  let streamError: string | undefined;
  const usageTotals = { promptTokens: 0, completionTokens: 0 };

  const consumeLine = (line: string) => {
    const payload = parseSSEPayload(line);
    if (!payload.present) return;
    const parsed = payload.data as {
      content?: string;
      finishReason?: string;
      error?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (typeof parsed.error === "string" && parsed.error) streamError = parsed.error;
    if (typeof parsed.finishReason === "string") finishReason = parsed.finishReason;
    if (parsed.content) content += parsed.content;
    accumulateUsage(parsed.usage, usageTotals);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(consumeLine);
    }
    buffer += decoder.decode();
    if (buffer) consumeLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return { content, finishReason, streamError, promptTokens: usageTotals.promptTokens, completionTokens: usageTotals.completionTokens };
}

function persistStream(  source: ReadableStream<Uint8Array>,
  details: StreamPersistenceDetails
) {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let content = "";
  let buffer = "";
  let cancelled = false;
  const usageTotals = { promptTokens: 0, completionTokens: 0 };

  const consumeLine = (line: string) => {
    const payload = parseSSEPayload(line);
    if (!payload.present) return;
    const parsed = payload.data as { content?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    if (parsed.content) content += parsed.content;
    accumulateUsage(parsed.usage, usageTotals);
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
            chatId: details.chatId,
            uid: details.uid,
            tool: details.tool,
            provider: details.provider,
            model: details.model,
            inputSummary: details.inputSummary,
            prompt: details.prompt,
            output: content,
            turns: details.turns.concat({ role: "assistant", content }),
          });
        }
        if (!cancelled) controller.close();
      } catch (error) {
        if (!cancelled) controller.error(error);
      } finally {
        reader.releaseLock();
        // Settle exactly once, even when the client cancelled mid-stream or
        // persistence failed. Provider-reported usage is authoritative;
        // otherwise fall back to a conservative estimate of what was streamed.
        // (This is what keeps cancelled generations from being free.)
        const observedTokens = usageTotals.promptTokens + usageTotals.completionTokens;
        await settleAiUsage(
          details.reservationId,
          observedTokens > 0
            ? observedTokens
            : details.promptEstimate + estimateAiTokens(content)
        );
      }
    },
    async cancel(reason) {
      cancelled = true;
      // Propagate the disconnect upstream so the provider stops generating.
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
    logger.error("Failed to index generation in Supabase:", error.message);
  }
}
