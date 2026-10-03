export type SSEPayload = { present: true; data: unknown } | { present: false };

export type TokenUsageState = {
  promptTokens: number;
  completionTokens: number;
};

/**
 * Extracts and JSON-parses a single SSE `data:` line. Heartbeats, `[DONE]`
 * markers, non-data lines, and malformed JSON all come back as
 * `{ present: false }` so every stream consumer can skip them uniformly.
 */
export function parseSSEPayload(line: string): SSEPayload {
  if (!line.startsWith("data: ")) return { present: false };
  const data = line.slice(6).trim();
  if (!data || data === "[DONE]") return { present: false };
  try {
    return { present: true, data: JSON.parse(data) };
  } catch {
    // Ignore incomplete or provider-specific SSE lines.
    return { present: false };
  }
}

type RawUsage = {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
};

/**
 * Merges provider-reported token usage into running totals, keeping the
 * highest values seen. Guards against non-integer payloads from providers.
 */
export function accumulateUsage(usage: RawUsage | undefined, state: TokenUsageState) {
  if (!usage) return;
  if (Number.isSafeInteger(usage.prompt_tokens) && (usage.prompt_tokens as number) > state.promptTokens) {
    state.promptTokens = usage.prompt_tokens as number;
  }
  if (Number.isSafeInteger(usage.completion_tokens) && (usage.completion_tokens as number) > state.completionTokens) {
    state.completionTokens = usage.completion_tokens as number;
  }
}

/**
 * Reads an SSE byte stream to completion, invoking `onPayload` with each
 * parsed JSON `data:` payload. Heartbeats, `[DONE]` markers, and malformed
 * lines are skipped. `onChunk` fires for every raw byte chunk (useful when
 * the stream must also be forwarded). If `signal` aborts, the reader is
 * cancelled with the abort reason and the pending read rejects. The reader
 * is released when done.
 */
export async function consumeSSEStream(
  source: ReadableStream<Uint8Array>,
  onPayload: (data: unknown) => void,
  onChunk?: (value: Uint8Array) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const dispatch = (line: string) => {
    const payload = parseSSEPayload(line);
    if (payload.present) onPayload(payload.data);
  };
  const abortListener = () => {
    void reader.cancel(signal?.reason).catch(() => {
      // The stream may already be closed; cancellation still propagates.
    });
  };
  signal?.addEventListener("abort", abortListener, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk?.(value);
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(dispatch);
    }
    buffer += decoder.decode();
    if (buffer) dispatch(buffer);
  } finally {
    signal?.removeEventListener("abort", abortListener);
    reader.releaseLock();
  }
}
