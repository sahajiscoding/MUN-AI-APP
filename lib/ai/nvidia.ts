import { ApiError } from "@/lib/api";
import type { AICompletionInput, AICompletionResult } from "@/lib/ai/types";

export async function callNvidiaMiniMax(
  input: AICompletionInput
): Promise<AICompletionResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MINIMAX_MODEL ?? "minimaxai/minimax-m3";

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
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      temperature: input.temperature ?? 0.8,
      top_p: 0.95,
      max_tokens: input.maxTokens ?? 2400,
      stream: false
    })
  });

  if (!response.ok) {
    throw new ApiError(502, "nvidia_failed", "NVIDIA MiniMax could not complete the request.");
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new ApiError(502, "nvidia_empty", "NVIDIA MiniMax returned an empty response.");
  }

  return {
    provider: "nvidia",
    model,
    content
  };
}
