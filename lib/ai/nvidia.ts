import { ApiError } from "@/lib/api";
import { logger } from "@/lib/server/secure-logger";
import { normalizeAIUsage, type AICompletionInput, type AICompletionResult } from "@/lib/ai/types";

const DEFAULT_KIMI_MODEL = "moonshotai/kimi-k3";
const DEFAULT_RESEARCH_MODEL = "z-ai/glm-5.3-flash";
const LEGACY_RESEARCH_MODEL_ALIASES: Record<string, string> = {
  "z-ai/glm-5-3-flash": DEFAULT_RESEARCH_MODEL,
  "deepseek-ai/deepseek-v4-flash-0731": DEFAULT_RESEARCH_MODEL,
  "minimaxai/minimax-m3": DEFAULT_RESEARCH_MODEL,
};

/** Max mode: the larger reasoning model. */
export function callNvidiaKimi(input: AICompletionInput) {
  return callNvidiaModel(input, process.env.NVIDIA_KIMI_MODEL || DEFAULT_KIMI_MODEL, "nvidia-kimi");
}

/** Quick and thorough modes: the configured NVIDIA research model through NIM. */
export function callNvidiaResearch(input: AICompletionInput) {
  const configuredModel = process.env.NVIDIA_RESEARCH_MODEL?.trim() || DEFAULT_RESEARCH_MODEL;
  const model = LEGACY_RESEARCH_MODEL_ALIASES[configuredModel] || configuredModel;

  return callNvidiaModel(input, model, "nvidia");
}

function redactProviderMessage(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/nvapi-[A-Za-z0-9_-]+/gi, "[redacted]")
    .slice(0, 1000);
}

async function readProviderError(response: Response) {
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

  return redactProviderMessage(providerMessage);
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

  // GLM-5.3-Flash supports configurable reasoning effort. Keep the research
  // modes responsive while Kimi K3 remains the heavier Max-mode path.
  // Note: do NOT send `clear_thinking` — NVIDIA's validator rejects it for
  // this model (400: unsupported parameter).
  if (model === DEFAULT_RESEARCH_MODEL) {
    requestBody.reasoning_effort = "low";
  }

  if (model !== DEFAULT_KIMI_MODEL) {
    requestBody.top_p = 0.95;
  }

  // Important: do not await NVIDIA here. Returning the ReadableStream first lets
  // the Next.js route send SSE headers immediately. The upstream NVIDIA request
  // starts when the stream is consumed, so the UI no longer sits on "Connecting"
  // while waiting for NVIDIA response headers.
  //
  // `upstream` lets the route abort provider work when the client disconnects;
  // the per-attempt timeout is combined with it inside start() so cancelling a
  // stream also stops billable generation instead of leaving it running.
  const upstream = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const requestSignal = AbortSignal.any([upstream.signal, timeoutSignal]);
      let closed = false;

      const emit = (payload: Record<string, unknown>) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "text/event-stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: requestSignal,
        });

        if (!response.ok) {
          const providerMessage = await readProviderError(response);
          emit({
            error: `NVIDIA ${model} request failed (${response.status}): ${providerMessage}`,
          });
          emit({ finishReason: "error" });
          emit({ done: true });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          emit({ error: "NVIDIA returned an empty response stream." });
          emit({ finishReason: "error" });
          emit({ done: true });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let finishReason: string | undefined;
        let sawAnyData = false;

        const emitProviderError = (message: string) => {
          logger.error(`NVIDIA ${model} stream error`, {
            detail: redactProviderMessage(message).slice(0, 500),
          });
          emit({ error: `NVIDIA ${model} request failed: ${redactProviderMessage(message)}` });
          finishReason = "error";
          emit({ finishReason });
        };

        const consumeLine = (line: string) => {
          if (!line.startsWith("data: ")) return;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") return;
          sawAnyData = true;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
              error?: { message?: unknown } | string | unknown;
              message?: unknown;
            };
            // NVIDIA can deliver failures as in-stream events on a 200
            // response (unknown model, quota, key problems). Without this,
            // they are silently dropped and the client only sees an "empty
            // response".
            const providerError = parsed.error ?? parsed.message;
            if (typeof providerError === "string" && providerError) {
              emitProviderError(providerError);
              return;
            }
            if (
              providerError &&
              typeof providerError === "object" &&
              typeof (providerError as { message?: unknown }).message === "string" &&
              (providerError as { message: string }).message
            ) {
              emitProviderError((providerError as { message: string }).message);
              return;
            }
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
          if (!sawAnyData && buffer.trim()) {
            // The provider answered 200 but sent no stream events at all.
            emitProviderError(`Unexpected non-streaming response: ${buffer.trim().slice(0, 300)}`);
          }
          emit({ finishReason: finishReason || "stop" });
          emit({ done: true });
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "NVIDIA request failed.";
        emit({ error: redactProviderMessage(message) });
        emit({ finishReason: "error" });
        emit({ done: true });
      } finally {
        if (!closed) {
          closed = true;
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
    },
    async cancel(reason) {
      // The consumer went away (client disconnect or an aborted 95s/240s
      // window). Abort the upstream request so the provider stops generating.
      upstream.abort(reason instanceof Error ? reason : new Error("client_cancelled"));
    },
  });

  return { provider, model, stream, cancel: () => upstream.abort(new Error("client_cancelled")) };
}
