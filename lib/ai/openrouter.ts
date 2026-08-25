import { ApiError } from "@/lib/api";
import type { AICompletionInput, AICompletionResult } from "@/lib/ai/types";

export async function callOpenRouter(
  input: AICompletionInput
): Promise<AICompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY || "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";
  const model = process.env.OPENROUTER_GLM_MODEL || "z-ai/glm-5.2:free";

  if (!apiKey || !model) {
    throw new ApiError(
      500,
      "openrouter_not_configured",
      "OpenRouter is not configured yet. Add OPENROUTER_API_KEY and OPENROUTER_GLM_MODEL."
    );
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://munprepapp.local",
      "X-Title": "MUN Prep App"
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 2400,
      stream: true
    })
  });

  if (!response.ok) {
    throw new ApiError(
      502,
      "openrouter_failed",
      "OpenRouter could not complete the request."
    );
  }

  // Return a ReadableStream for the client to consume
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
                const parsed = JSON.parse(data);
                const content = parsed?.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
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
}
