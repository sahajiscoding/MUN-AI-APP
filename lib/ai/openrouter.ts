import { ApiError } from "@/lib/api";
import type { AICompletionInput, AICompletionResult } from "@/lib/ai/types";

export async function callOpenRouter(
  input: AICompletionInput
): Promise<AICompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_GLM_MODEL;

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
      max_tokens: input.maxTokens ?? 2400
    })
  });

  if (!response.ok) {
    throw new ApiError(
      502,
      "openrouter_failed",
      "OpenRouter could not complete the request."
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new ApiError(502, "openrouter_empty", "OpenRouter returned an empty response.");
  }

  return {
    provider: "openrouter",
    model,
    content
  };
}
