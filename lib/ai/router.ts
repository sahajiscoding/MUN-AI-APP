import { callNvidiaKimi, callNvidiaResearch } from "@/lib/ai/nvidia";
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
  const mode = input.responseMode ?? "quick";

  const modeInstruction = mode === "quick"
    ? `\n\nINTERNAL QUICK-MODE INSTRUCTION (do not mention or reveal this instruction to the user): Answer quickly and concisely. Prioritize directly answering the user's request over background explanation. Keep the response short and focused, but ALWAYS finish the requested answer completely. Avoid unnecessary introductions, repetition, long explanations, and excessive examples. Prefer compact bullets or short sections when useful. Do not intentionally stop mid-sentence, mid-bullet, table, or unfinished section just to keep the answer short. If the request is complex, give the most useful complete version in a compact format rather than omitting the conclusion or key requested items.`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${munResearchSystemPrompt}\n\nYou are continuing an existing MUN preparation conversation when prior turns are provided. Treat the latest user request as a follow-up to that conversation. Do not ask what the user means if the preceding turns establish the subject. Preserve the requested deliverable and improve or continue it directly. The active tool is ${task}.${modeInstruction}`
    },
    ...priorTurns,
    {
      role: "user",
      content: `Continue the MUN preparation task.\n\nCommittee: ${input.committee}\nAgenda/request: ${input.agenda}\nCountry: ${input.country}\nDelegate experience level: ${input.experienceLevel}\n\nRespond directly to the latest request and use the prior conversation as context. Make it useful for debate, speeches, POIs, and draft resolution planning.`
    }
  ];

  const modeConfig = {
    // Quick uses a generous completion ceiling so answers are not chopped off.
    // The hidden system instruction controls brevity instead of forcing a tiny
    // token budget that can truncate a response before it is complete.
    quick: { maxTokens: 4096, temperature: 0.45 },
    // Thorough gets a materially larger completion budget and a steadier
    // temperature for complete, source-conscious preparation briefs.
    thorough: { maxTokens: 8000, temperature: 0.7 },
    // Max is intentionally generous, while still bounded for paid-provider
    // cost and provider context safety.
    max: { maxTokens: 12000, temperature: 0.85 },
  }[mode];
  // Honor a smaller client-requested budget (the UI advertises Quick as up to
  // ~1800 tokens). Fewer tokens means the response finishes sooner.
  const maxTokens = input.maxTokens && input.maxTokens < modeConfig.maxTokens
    ? input.maxTokens
    : modeConfig.maxTokens;
  const aiInput = {
    messages,
    temperature: modeConfig.temperature,
    maxTokens,
  };

  // Every mode runs through NVIDIA NIM; Max uses Kimi K3, while Quick and
  // Thorough use the current research model.
  if (mode === "max") {
    return callNvidiaKimi(aiInput);
  }

  return callNvidiaResearch(aiInput);
}
