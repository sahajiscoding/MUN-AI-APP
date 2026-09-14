import { callNvidiaKimi, callNvidiaDeepSeek } from "@/lib/ai/nvidia";
import { munResearchSystemPrompt } from "@/lib/ai/prompts";
import type { ChatMessage } from "@/lib/ai/types";

export type ResearchInput = {
  committee: string;
  agenda: string;
  country: string;
  experienceLevel: string;
  responseMode?: "quick" | "thorough" | "max";
  maxTokens?: number;
  temperature?: number;
  tool?: string;
  conversation?: ChatMessage[];
};

export async function runMunResearch(input: ResearchInput) {
  const priorTurns = (input.conversation ?? []).slice(-12);
  const task = input.tool && input.tool !== "research" ? input.tool.replace(/-/g, " ") : "research brief";
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${munResearchSystemPrompt}\n\nYou are continuing an existing MUN preparation conversation when prior turns are provided. Treat the latest user request as a follow-up to that conversation. Do not ask what the user means if the preceding turns establish the subject. Preserve the requested deliverable and improve or continue it directly. The active tool is ${task}.`
    },
    ...priorTurns,
    {
      role: "user",
      content: `Continue the MUN preparation task.\n\nCommittee: ${input.committee}\nAgenda/request: ${input.agenda}\nCountry: ${input.country}\nDelegate experience level: ${input.experienceLevel}\n\nRespond directly to the latest request and use the prior conversation as context. Make it useful for debate, speeches, POIs, and draft resolution planning.`
    }
  ];

  const mode = input.responseMode ?? "quick";
  const modeConfig = {
    // Keep Quick concise and low-latency, but leave enough room for a useful
    // structured answer instead of truncating it during a table or checklist.
    quick: { maxTokens: 1800, temperature: 0.45 },
    // Thorough gets a materially larger completion budget and a steadier
    // temperature for complete, source-conscious preparation briefs.
    thorough: { maxTokens: 8000, temperature: 0.7 },
    // Max is intentionally generous, while still bounded for paid-provider
    // cost and provider context safety.
    max: { maxTokens: 12000, temperature: 0.85 },
  }[mode];
  const aiInput = {
    messages,
    temperature: modeConfig.temperature,
    maxTokens: modeConfig.maxTokens,
  };

  // Every mode runs through NVIDIA NIM; only the model differs. Max gets the
  // larger reasoning model, quick and thorough get DeepSeek V4 Flash.
  if (mode === "max") {
    return callNvidiaKimi(aiInput);
  }

  return callNvidiaDeepSeek(aiInput);
}
