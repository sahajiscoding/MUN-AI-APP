import { ApiError } from "@/lib/api";
import { logger } from "@/lib/server/secure-logger";
import { supabaseAdmin } from "@/lib/supabase/server";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function envCap(name: string, fallback: number) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : fallback;
}

function dailyRequestCap() {
  return envCap("AI_DAILY_REQUEST_CAP", 60);
}

function dailyTokenCap() {
  return envCap("AI_DAILY_TOKEN_CAP", 300_000);
}

/**
 * Rough token estimate used only when the provider never reported usage
 * (cancelled/partial streams). Four characters per token is the standard
 * heuristic; it is intentionally conservative for metering purposes.
 */
export function estimateAiTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export type AiUsageReservation = {
  id: string;
  reservedTokens: number;
};

/**
 * Atomically checks daily limits and reserves both the request and its maximum
 * prompt/completion budget before any provider work begins. Missing RPCs or
 * ledger errors fail closed; there is deliberately no read-then-write fallback.
 */
export async function reserveAiUsage(uid: string, reservedTokens: number): Promise<AiUsageReservation> {
  const safeReservation = Math.max(0, Math.floor(reservedTokens));
  if (!uid || safeReservation > 1_000_000) {
    throw new ApiError(400, "invalid_ai_usage_reservation", "AI usage could not be reserved.");
  }

  const { data, error } = await supabaseAdmin().rpc("reserve_ai_usage", {
    p_uid: uid,
    p_day: todayKey(),
    p_request_cap: dailyRequestCap(),
    p_token_cap: dailyTokenCap(),
    p_reserved_tokens: safeReservation,
  });

  if (error) {
    logger.error("Atomic AI usage reservation failed:", error.message);
    throw new ApiError(503, "ai_usage_unavailable", "AI usage could not be verified right now. Please try again in a moment.");
  }

  const result = (Array.isArray(data) ? data[0] : data) as
    | { reservation_id?: string | null; allowed?: boolean }
    | null;
  if (!result?.allowed || typeof result.reservation_id !== "string") {
    throw new ApiError(
      429,
      "ai_daily_limit",
      "You have reached your daily AI usage limit. Please try again tomorrow."
    );
  }

  return { id: result.reservation_id, reservedTokens: safeReservation };
}

/**
 * Settle exactly once. A failed settlement leaves the reservation in place,
 * which is conservative: it can temporarily consume the user's daily budget
 * but cannot make the cap fail open.
 */
export async function settleAiUsage(reservationId: string, actualTokens: number): Promise<boolean> {
  const safeTokens = Math.max(0, Math.floor(actualTokens));
  if (!reservationId || safeTokens > 1_000_000) {
    logger.error("AI usage settlement rejected: invalid reservation or token count.");
    return false;
  }

  try {
    const { data, error } = await supabaseAdmin().rpc("settle_ai_usage", {
      p_reservation_id: reservationId,
      p_actual_tokens: safeTokens,
    });
    if (error) {
      logger.error("AI usage settlement failed:", error.message);
      return false;
    }
    return data === true;
  } catch (error) {
    logger.error("AI usage settlement failed:", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}
