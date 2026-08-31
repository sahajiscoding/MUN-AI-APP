import { ApiError } from "@/lib/api";
import { normalizeAIUsage, type AICompletionInput, type AICompletionResult } from "@/lib/ai/types";

const DEFAULT_BASE_URL = "https://api.gmi-serving.com";
const DEFAULT_MODEL = "MiniMaxAI/MiniMax-M3";

 type AnthropicStreamEvent = {
  type?: string;
  delta?: { type?: string; text?: string };
  message?: { usage?: { input_tokens?: number } };
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string | null;
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
  const maxTokens = input.maxTokens ?? 8_000;
  const timeoutMs = maxTokens <= 2_000 ? 75_000 : 180_000;

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
      max_tokens: maxTokens,
      temperature: input.temperature ?? 0.85,
      ...(systemMessage ? { system: systemMessage } : {}),
      messages,
      stream: true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
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
      let closed = false;
      let finishReason: string | undefined;

      const emit = (payload: Record<string, unknown>) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const consumeLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as AnthropicStreamEvent;
          const text = parsed.delta?.type === "text_delta" ? parsed.delta.text : undefined;
          if (text) emit({ content: text });

          const usage = normalizeAIUsage({
            prompt_tokens: parsed.usage?.input_tokens ?? parsed.message?.usage?.input_tokens,
            completion_tokens: parsed.usage?.output_tokens,
          });
          if (usage) emit({ usage });

          if (parsed.stop_reason) {
            finishReason = parsed.stop_reason;
            emit({ finishReason });
          }
        } catch {
          // Ignore provider keep-alives and malformed partial events.
        }
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
        emit({ finishReason: finishReason || "stop" });
      } catch (error) {
        if (!closed) controller.error(error);
        closed = true;
        return;
      } finally {
        reader.releaseLock();
        if (!closed) {
          closed = true;
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
    },
  });

  return {
    provider: "gmi",
    model,
    stream,
  };
}
