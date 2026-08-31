import { ApiError } from "@/lib/api";
import { normalizeAIUsage, type AICompletionInput, type AICompletionResult } from "@/lib/ai/types";

const DEFAULT_BASE_URL = "https://api.gmi-serving.com";
const DEFAULT_MODEL = "MiniMaxAI/MiniMax-M3";

type AnthropicStreamEvent = {
  type?: string;
  delta?: { type?: string; text?: string };
  message?: { usage?: { input_tokens?: number } };
  usage?: { input_tokens?: number; output_tokens?: number };
};

export async function callGmiMiniMax(
  input: AICompletionInput,
): Promise<AICompletionResult> {
  const apiKey = process.env.GMI_CLOUD_API_KEY;
  const baseUrl = (process.env.GMI_CLOUD_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.GMI_MINIMAX_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new ApiError(
      500,
      "gmi_not_configured",
      "MiniMax M3 is not configured yet. Add GMI_CLOUD_API_KEY.",
    );
  }

  const systemMessage = input.messages.find((message) => message.role === "system")?.content;
  const messages = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? 2600,
      temperature: input.temperature ?? 0.85,
      ...(systemMessage ? { system: systemMessage } : {}),
      messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    throw new ApiError(502, "gmi_failed", "GMI Cloud MiniMax could not complete the request.");
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }

            try {
              const parsed = JSON.parse(data) as AnthropicStreamEvent;
              const text = parsed.delta?.type === "text_delta" ? parsed.delta.text : undefined;
              if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));

              const usage = normalizeAIUsage({
                prompt_tokens: parsed.usage?.input_tokens ?? parsed.message?.usage?.input_tokens,
                completion_tokens: parsed.usage?.output_tokens,
              });
              if (usage) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage })}\n\n`));
            } catch {
              // Ignore provider keep-alives and malformed partial events.
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return {
    provider: "gmi",
    model,
    stream,
  };
}
