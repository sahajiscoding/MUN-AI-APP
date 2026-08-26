import { callNvidiaMiniMax } from "@/lib/ai/nvidia";
import { callOpenRouter } from "@/lib/ai/openrouter";
import { munResearchSystemPrompt } from "@/lib/ai/prompts";
import type { ChatMessage } from "@/lib/ai/types";

export type ResearchInput = {
  committee: string;
  agenda: string;
  country: string;
  experienceLevel: string;
  provider?: string;
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

  const aiInput = {
    messages,
    temperature: input.temperature ?? 0.85,
    maxTokens: input.maxTokens ?? 2600
  };

  // Use OpenRouter if explicitly requested, otherwise NVIDIA
  if (input.provider === "openrouter") {
    return callOpenRouter(aiInput);
  }
  return callNvidiaMiniMax(aiInput);
}
