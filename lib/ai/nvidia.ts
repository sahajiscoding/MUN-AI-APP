import { ApiError } from "@/lib/api";
import type { AICompletionInput, AICompletionResult } from "@/lib/ai/types";

export async function callNvidiaMiniMax(
  input: AICompletionInput
): Promise<AICompletionResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MINIMAX_MODEL || "minimaxai/minimax-m3";

  if (!apiKey) {
    throw new ApiError(
      500,
      "nvidia_not_configured",
      "NVIDIA MiniMax is not configured yet. Add NVIDIA_API_KEY."
    );
  }

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.8,
      top_p: 0.95,
      max_tokens: input.maxTokens ?? 2400,
      stream: true
    })
  });

  if (!response.ok) {
    throw new ApiError(502, "nvidia_failed", "NVIDIA MiniMax could not complete the request.");
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
    provider: "nvidia",
    model,
    stream
  } as unknown as AICompletionResult;
}
