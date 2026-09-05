import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";

// Per-user daily AI usage ledger. Backed by the shared `ai_usage` table so
// caps hold across Vercel serverless instances. Caps are soft: concurrent
// requests that pass the pre-check together can slightly overshoot, which is
// acceptable for cost containment.

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

type UsageRow = {
  uid: string;
  day: string;
  requests: number;
  total_tokens: number;
};

async function loadUsage(uid: string, day: string): Promise<UsageRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("ai_usage")
    .select("uid, day, requests, total_tokens")
    .eq("uid", uid)
    .eq("day", day)
    .maybeSingle();

  if (error) {
    console.warn("AI usage lookup failed:", error.message);
    return null;
  }

  if (!data) return null;
  return {
    uid: data.uid,
    day: data.day,
    requests: Number(data.requests) || 0,
    total_tokens: Number(data.total_tokens) || 0,
  };
}

/**
 * Reject the request when the user has already used their daily allowance.
 * A cap of 0 disables that cap. When the ledger is unreachable the request is
 * allowed (auth itself depends on Supabase, so a healthy request path implies
 * the ledger is usually reachable too).
 */
export async function assertAiUsageAllowed(uid: string) {
  const day = todayKey();
  const current = await loadUsage(uid, day);
  if (!current) return;

  const requestCap = dailyRequestCap();
  if (requestCap > 0 && current.requests >= requestCap) {
    throw new ApiError(
      429,
      "ai_daily_limit",
      "You have reached your daily AI request limit. Please try again tomorrow."
    );
  }

  const tokenCap = dailyTokenCap();
  if (tokenCap > 0 && current.total_tokens >= tokenCap) {
    throw new ApiError(
      429,
      "ai_daily_limit",
      "You have reached your daily AI usage limit. Please try again tomorrow."
    );
  }
}

/**
 * Accumulate usage for a user for the current UTC day. Failures are logged
 * and never fail the generation they are called from.
 */
export async function recordAiUsage(
  uid: string,
  input: { promptTokens?: number; completionTokens?: number; requests?: number } = {}
) {
  const requests = Math.max(input.requests ?? 0, 0);
  const promptTokens = Math.max(input.promptTokens ?? 0, 0);
  const completionTokens = Math.max(input.completionTokens ?? 0, 0);

  if (uid && requests === 0 && promptTokens === 0 && completionTokens === 0) return;

  try {
    const day = todayKey();
    const current = await loadUsage(uid, day);
    const next: UsageRow = {
      uid,
      day,
      requests: (current?.requests ?? 0) + requests,
      total_tokens: (current?.total_tokens ?? 0) + promptTokens + completionTokens,
    };

    const { error } = await supabaseAdmin()
      .from("ai_usage")
      .upsert(
        { ...next, updated_at: new Date().toISOString() },
        { onConflict: "uid,day" }
      );

    if (error) {
      console.warn("AI usage record failed:", error.message);
    }
  } catch (error) {
    console.warn("AI usage record failed:", error instanceof Error ? error.message : "unknown error");
  }
}
