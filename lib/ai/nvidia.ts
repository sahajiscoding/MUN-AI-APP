import { ApiError } from "@/lib/api";
import { normalizeAIUsage, type AICompletionInput, type AICompletionResult } from "@/lib/ai/types";

const DEFAULT_MINIMAX_MODEL = "minimaxai/minimax-m3";
const DEFAULT_KIMI_MODEL = "moonshotai/kimi-k3";

export function callNvidiaMiniMax(input: AICompletionInput) {
  return callNvidiaModel(input, process.env.NVIDIA_MINIMAX_MODEL || DEFAULT_MINIMAX_MODEL, "nvidia");
}

export function callNvidiaKimi(input: AICompletionInput) {
  return callNvidiaModel(input, process.env.NVIDIA_KIMI_MODEL || DEFAULT_KIMI_MODEL, "nvidia-kimi");
}

async function callNvidiaModel(
  input: AICompletionInput,
  model: string,
  provider: "nvidia" | "nvidia-kimi",
): Promise<AICompletionResult> {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new ApiError(
      500,
      "nvidia_not_configured",
      "The NVIDIA AI provider is not configured yet. Add NVIDIA_API_KEY.",
    );
  }

  const maxTokens = input.maxTokens ?? 12_000;
  const timeoutMs = maxTokens <= 2_000 ? 75_000 : 240_000;
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.8,
      top_p: 0.95,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new ApiError(502, "nvidia_failed", "The NVIDIA AI provider could not complete the request.");
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
          const parsed = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string };
              finish_reason?: string | null;
            }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          };
          const choice = parsed.choices?.[0];
          const content = choice?.delta?.content;
          if (content) emit({ content });

          const usage = normalizeAIUsage(parsed.usage);
          if (usage) emit({ usage });

          if (choice?.finish_reason) {
            finishReason = choice.finish_reason;
            emit({ finishReason });
          }
        } catch {
          // Ignore malformed provider chunks while preserving the rest of the stream.
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

  return { provider, model, stream };
}
