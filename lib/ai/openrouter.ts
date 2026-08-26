import { ApiError } from "@/lib/api";
import { normalizeAIUsage, type AICompletionInput, type AICompletionResult } from "@/lib/ai/types";

export async function callOpenRouter(
  input: AICompletionInput
): Promise<AICompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_GLM_MODEL || "z-ai/glm-5.2:free";

  if (!apiKey || !model) {
    throw new ApiError(
      500,
      "openrouter_not_configured",
      "OpenRouter is not configured yet. Add OPENROUTER_API_KEY and OPENROUTER_GLM_MODEL."
    );
  }

  // Retry up to 2 times on rate limit
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mun-ai-app.vercel.app",
          "X-Title": "MUN Prep App"
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 2400,
          stream: true
        }),
        signal: AbortSignal.timeout(90_000)
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg = errBody?.error?.message || `OpenRouter returned ${response.status}`;

        // Rate limited — retry
        if (response.status === 429) {
          lastError = new Error(`Rate limited. ${errMsg}`);
          continue;
        }

        throw new ApiError(502, "openrouter_failed", errMsg);
      }

      // Success — return streaming response
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") {
                    controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                    continue;
                  }
                  try {
                    const parsed = JSON.parse(data) as {
                      choices?: Array<{ delta?: { content?: string } }>;
                      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                    };
                    const content = parsed?.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(
                        new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
                      );
                    }
                    const usage = normalizeAIUsage(parsed.usage);
                    if (usage) {
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ usage })}\n\n`));
                    }
                  } catch {
                    // skip malformed chunks
                  }
                }
              }
            }
          } catch (err) {
            controller.error(err);
          } finally {
            controller.close();
          }
        }
      });

      return {
        provider: "openrouter",
        model,
        stream
      } as unknown as AICompletionResult;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new ApiError(
    502,
    "openrouter_failed",
    lastError?.message || "OpenRouter is busy. Try Mid (MiniMax) instead, or retry in a few seconds."
  );
}
