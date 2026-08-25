import { callNvidiaMiniMax } from "@/lib/ai/nvidia";
import { callOpenRouter } from "@/lib/ai/openrouter";
import { munResearchSystemPrompt } from "@/lib/ai/prompts";
import type { AIProvider } from "@/lib/ai/types";

export type ResearchInput = {
  committee: string;
  agenda: string;
  country: string;
  experienceLevel: string;
  provider?: AIProvider;
};

export async function runMunResearch(input: ResearchInput) {
  const messages = [
    {
      role: "system" as const,
      content: munResearchSystemPrompt
    },
    {
      role: "user" as const,
      content: `Prepare a MUN research brief.

Committee: ${input.committee}
Agenda: ${input.agenda}
Country: ${input.country}
Delegate experience level: ${input.experienceLevel}

Make it useful for debate, speeches, POIs, and draft resolution planning.`
    }
  ];

  if (input.provider === "nvidia") {
    return callNvidiaMiniMax({ messages, temperature: 0.85, maxTokens: 2600 });
  }

  return callOpenRouter({ messages, temperature: 0.7, maxTokens: 2600 });
}
