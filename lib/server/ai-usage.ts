import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";
import { actualUsageOrFallback, estimateAiReservation } from "@/lib/server/ai-usage-logic";

export { actualUsageOrFallback, estimateAiReservation } from "@/lib/server/ai-usage-logic";

export const DEFAULT_AI_DAILY_TOKEN_LIMIT = 100_000;

function configuredLimit() {
  const parsed = Number(process.env.AI_DAILY_TOKEN_LIMIT);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 10_000_000) {
    return DEFAULT_AI_DAILY_TOKEN_LIMIT;
  }
  return parsed;
}

export const AI_DAILY_TOKEN_LIMIT = configuredLimit();

type UsageRow = {
  reservation_id?: string | null;
  usage_date: string;
  tokens_used: number | string;
  reserved_tokens: number | string;
  allowed?: boolean;
};

export type AiUsageSnapshot = {
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  resetAt: string;
};

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

function nextUtcMidnight() {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

function asSafeInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("Invalid AI usage counter returned by database.");
  }
  return number;
}

function snapshot(row: UsageRow | null | undefined): AiUsageSnapshot {
  const used = asSafeInteger(row?.tokens_used ?? 0);
  const reserved = asSafeInteger(row?.reserved_tokens ?? 0);
  return {
    limit: AI_DAILY_TOKEN_LIMIT,
    used,
    reserved,
    remaining: Math.max(AI_DAILY_TOKEN_LIMIT - used - reserved, 0),
    resetAt: nextUtcMidnight(),
  };
}

export async function getDailyAiUsage(uid: string): Promise<AiUsageSnapshot> {
  const { data, error } = await supabaseAdmin()
    .from("ai_usage_daily")
    .select("usage_date, tokens_used, reserved_tokens")
    .eq("uid", uid)
    .eq("usage_date", utcDate())
    .maybeSingle();

  if (error) throw new Error("Could not read daily AI usage.");
  return snapshot(data as UsageRow | null);
}

export async function reserveAiTokens(uid: string, amount: number) {
  const reservation = Math.max(1, Math.min(AI_DAILY_TOKEN_LIMIT, Math.floor(amount)));
  const { data, error } = await supabaseAdmin().rpc("reserve_ai_tokens", {
    p_uid: uid,
    p_tokens: reservation,
    p_limit: AI_DAILY_TOKEN_LIMIT,
  });

  if (error) throw new Error("Could not reserve daily AI usage.");
  const row = (Array.isArray(data) ? data[0] : data) as UsageRow | null;
  if (!row) throw new Error("Could not reserve daily AI usage.");

  const used = asSafeInteger(row.tokens_used);
  const reserved = asSafeInteger(row.reserved_tokens);
  const remaining = Math.max(AI_DAILY_TOKEN_LIMIT - used - reserved, 0);
  const usage: AiUsageSnapshot = {
    limit: AI_DAILY_TOKEN_LIMIT,
    used,
    reserved,
    remaining,
    resetAt: nextUtcMidnight(),
  };

  if (row.allowed !== true) {
    throw new ApiError(
      429,
      "daily_token_limit_reached",
      `You have reached your ${AI_DAILY_TOKEN_LIMIT.toLocaleString()}-token AI allowance for today.`,
      {
        limit: usage.limit,
        used: usage.used,
        remaining: usage.remaining,
        resetAt: usage.resetAt,
      },
    );
  }

  if (!row.reservation_id) throw new Error("Could not create daily AI usage reservation.");
  return { reservation: row.reservation_id, reservedTokens: reservation, usage };
}

export async function reconcileAiTokens(uid: string, reservationId: string, actual: number) {
  const safeActual = Math.max(0, Math.min(Math.floor(actual), AI_DAILY_TOKEN_LIMIT));
  const { data, error } = await supabaseAdmin().rpc("reconcile_ai_tokens", {
    p_uid: uid,
    p_reservation_id: reservationId,
    p_actual: safeActual,
    p_limit: AI_DAILY_TOKEN_LIMIT,
  });
  if (error) throw new Error("Could not reconcile daily AI usage.");
  const row = (Array.isArray(data) ? data[0] : data) as UsageRow | null;
  return snapshot(row);
}

export async function releaseAiTokens(uid: string, reservationId: string) {
  const { data, error } = await supabaseAdmin().rpc("release_ai_tokens", {
    p_uid: uid,
    p_reservation_id: reservationId,
    p_limit: AI_DAILY_TOKEN_LIMIT,
  });
  if (error) throw new Error("Could not release daily AI usage.");
  const row = (Array.isArray(data) ? data[0] : data) as UsageRow | null;
  return snapshot(row);
}

