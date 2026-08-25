import { callNvidiaMiniMax } from "@/lib/ai/nvidia";
import { munResearchSystemPrompt } from "@/lib/ai/prompts";

export type ResearchInput = {
  committee: string;
  agenda: string;
  country: string;
  experienceLevel: string;
  provider?: string;
  maxTokens?: number;
  temperature?: number;
};

export async function runMunResearch(input: ResearchInput) {
  const messages = [
    {
      role: "system" as const,
      content: munResearchSystemPrompt
    },
    {
      role: "user" as const,
      content: `Prepare a MUN research brief.\n\nCommittee: ${input.committee}\nAgenda: ${input.agenda}\nCountry: ${input.country}\nDelegate experience level: ${input.experienceLevel}\n\nMake it useful for debate, speeches, POIs, and draft resolution planning.`
    }
  ];

  return callNvidiaMiniMax({
    messages,
    temperature: input.temperature ?? 0.85,
    maxTokens: input.maxTokens ?? 2600
  });
}
