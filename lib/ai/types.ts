export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AIProvider = "openrouter" | "nvidia";

export type AICompletionInput = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type AICompletionResult = {
  provider: AIProvider;
  model: string;
  content: string;
};
