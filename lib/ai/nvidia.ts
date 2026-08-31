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
      max_tokens: input.maxTokens ?? 2400,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: AbortSignal.timeout(90_000),
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
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
                usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
              };
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));

              const usage = normalizeAIUsage(parsed.usage);
              if (usage) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage })}\n\n`));
            } catch {
              // Ignore malformed provider chunks.
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

  return { provider, model, stream };
}
