import { ApiError } from "@/lib/api";
import { normalizeAIUsage, type AICompletionInput, type AICompletionResult } from "@/lib/ai/types";

const DEFAULT_KIMI_MODEL = "moonshotai/kimi-k3";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-ai/deepseek-v4-flash-0731";
const RETIRED_MINIMAX_MODEL = "minimaxai/minimax-m3";

/** Max mode: the larger reasoning model. */
export function callNvidiaKimi(input: AICompletionInput) {
  return callNvidiaModel(input, process.env.NVIDIA_KIMI_MODEL || DEFAULT_KIMI_MODEL, "nvidia-kimi");
}

/**
 * Quick and thorough modes: DeepSeek V4 Flash-0731 through NVIDIA NIM.
 *
 * Keep backward compatibility with the old NVIDIA_MINIMAX_MODEL variable so
 * an existing deployment that still contains the retired MiniMax model value
 * automatically falls back to the current DeepSeek model instead of failing.
 */
export function callNvidiaDeepSeek(input: AICompletionInput) {
  const configuredModel = process.env.NVIDIA_DEEPSEEK_MODEL?.trim() || process.env.NVIDIA_MINIMAX_MODEL?.trim();
  const model = !configuredModel || configuredModel === RETIRED_MINIMAX_MODEL
    ? DEFAULT_DEEPSEEK_MODEL
    : configuredModel;

  return callNvidiaModel(input, model, "nvidia");
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

  const requestBody: Record<string, unknown> = {
    model,
    messages: input.messages,
    temperature: input.temperature ?? 0.8,
    max_tokens: maxTokens,
    stream: true,
  };

  // DeepSeek V4 Flash supports top_p, but its documented request contract does
  // not require the stream_options extension, so keep the body conservative.
  if (model !== DEFAULT_KIMI_MODEL) {
    requestBody.top_p = 0.95;
  }

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    let providerMessage = "Unknown NVIDIA provider error.";

    try {
      const raw = await response.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            error?: { message?: string } | string;
            message?: string;
          };
          const error = parsed.error;
          providerMessage =
            typeof error === "string"
              ? error
              : error?.message || parsed.message || raw;
        } catch {
          providerMessage = raw;
        }
      }
    } catch {
      // Keep the generic fallback if the provider response cannot be read.
    }

    // Never expose credentials or an excessively large provider response.
    providerMessage = providerMessage
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(/nvapi-[A-Za-z0-9_-]+/gi, "[redacted]")
      .slice(0, 1000);

    throw new ApiError(
      502,
      "nvidia_failed",
      `NVIDIA ${model} request failed (${response.status}): ${providerMessage}`,
    );
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
