export function estimateAiReservation(input: {
  prompt: string;
  committee: string;
  country: string;
  experienceLevel: string;
  priorTurns: Array<{ content: string }>;
  maxTokens: number;
  limit: number;
}) {
  // Conservative upper bound: one token per UTF-16 code unit, plus the
  // requested output budget. This prevents missing provider usage metadata
  // from allowing a request to escape the daily cap.
  const inputUpperBound =
    1_500 +
    input.prompt.length +
    input.committee.length +
    input.country.length +
    input.experienceLevel.length +
    input.priorTurns.reduce((total, turn) => total + turn.content.length, 0);
  return Math.max(1, Math.min(input.limit, inputUpperBound + input.maxTokens));
}

export function actualUsageOrFallback(
  usage: { totalTokens?: number } | undefined,
  fallback: number,
) {
  const actual = usage?.totalTokens;
  if (typeof actual === "number" && Number.isSafeInteger(actual) && actual >= 0) return actual;
  return Math.max(0, Math.floor(fallback));
}
