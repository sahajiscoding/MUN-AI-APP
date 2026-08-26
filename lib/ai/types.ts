export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AIProvider = "openrouter" | "nvidia";

export type AIUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export function normalizeAIUsage(value: unknown): AIUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const promptTokens = Number.isSafeInteger(raw.prompt_tokens) && Number(raw.prompt_tokens) >= 0 ? Number(raw.prompt_tokens) : undefined;
  const completionTokens = Number.isSafeInteger(raw.completion_tokens) && Number(raw.completion_tokens) >= 0 ? Number(raw.completion_tokens) : undefined;
  const providerTotal = Number.isSafeInteger(raw.total_tokens) && Number(raw.total_tokens) >= 0 ? Number(raw.total_tokens) : undefined;
  const totalTokens = providerTotal ?? (promptTokens !== undefined && completionTokens !== undefined ? promptTokens + completionTokens : undefined);
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) return undefined;
  return { promptTokens, completionTokens, totalTokens };
}

export type AICompletionInput = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type AICompletionResult = {
  provider: AIProvider;
  model: string;
  content?: string;
  usage?: AIUsage;
  stream?: ReadableStream<Uint8Array>;
};
