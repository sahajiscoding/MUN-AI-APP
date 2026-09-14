import { ApiError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/server";

// Per-user daily AI usage ledger. Backed by the shared `ai_usage` table so
// caps hold across Vercel serverless instances.
//
// Failure posture is fail-closed-or-cached, never fail-open: if the ledger
// is unreachable and there is no fresh cached reading, generation is refused
// with 503 rather than granted for free. (Auth itself depends on Supabase,
// so a fully healthy request path implies a reachable ledger; the only
// window this closes is partial/table-level outages — exactly when an
// attacker would otherwise get unlimited free usage.)

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

type UsageRead = { ok: true; row: UsageRow | null } | { ok: false };

// Last-known-good readings, used only when the ledger is unreachable.
// Short TTL: a stale cache must never grant far beyond the caps.
const usageCache = new Map<string, { requests: number; total_tokens: number; fetchedAt: number }>();
const USAGE_CACHE_TTL_MS = 5 * 60_000;

function cacheKey(uid: string, day: string) {
  return `${uid}:${day}`;
}

function readCache(uid: string, day: string): UsageRow | null {
  const cached = usageCache.get(cacheKey(uid, day));
  if (!cached || Date.now() - cached.fetchedAt > USAGE_CACHE_TTL_MS) {
    if (cached) usageCache.delete(cacheKey(uid, day));
    return null;
  }
  return { uid, day, requests: cached.requests, total_tokens: cached.total_tokens };
}

function writeCache(row: UsageRow) {
  usageCache.set(cacheKey(row.uid, row.day), {
    requests: row.requests,
    total_tokens: row.total_tokens,
    fetchedAt: Date.now(),
  });
  if (usageCache.size > 5000) {
    const oldest = usageCache.keys().next();
    if (!oldest.done) usageCache.delete(oldest.value);
  }
}

async function readUsage(uid: string, day: string): Promise<UsageRead> {
  const { data, error } = await supabaseAdmin()
    .from("ai_usage")
    .select("uid, day, requests, total_tokens")
    .eq("uid", uid)
    .eq("day", day)
    .maybeSingle();

  if (error) {
    // Loud: ledger failure directly affects billing-adjacent enforcement.
    console.error("AI usage lookup failed:", error.message);
    return { ok: false };
  }

  if (!data) return { ok: true, row: null };
  const row: UsageRow = {
    uid: data.uid,
    day: data.day,
    requests: Number(data.requests) || 0,
    total_tokens: Number(data.total_tokens) || 0,
  };
  writeCache(row);
  return { ok: true, row };
}

function capExceeded(row: UsageRow): "requests" | "tokens" | null {
  const requestCap = dailyRequestCap();
  if (requestCap > 0 && row.requests >= requestCap) return "requests";
  const tokenCap = dailyTokenCap();
  if (tokenCap > 0 && row.total_tokens >= tokenCap) return "tokens";
  return null;
}

function dailyLimitError(kind: "requests" | "tokens") {
  return new ApiError(
    429,
    "ai_daily_limit",
    kind === "requests"
      ? "You have reached your daily AI request limit. Please try again tomorrow."
      : "You have reached your daily AI usage limit. Please try again tomorrow."
  );
}

/**
 * Reject the request when the user has already used their daily allowance.
 * A cap of 0 disables that cap. When the ledger is unreachable, a fresh
 * cached reading is enforced instead; with neither, the request is refused
 * (503) rather than allowed unbounded.
 */
export async function assertAiUsageAllowed(uid: string) {
  const day = todayKey();
  const read = await readUsage(uid, day);

  if (read.ok) {
    if (!read.row) return;
    const exceeded = capExceeded(read.row);
    if (exceeded) throw dailyLimitError(exceeded);
    return;
  }

  const cached = readCache(uid, day);
  if (cached) {
    const exceeded = capExceeded(cached);
    if (exceeded) throw dailyLimitError(exceeded);
    return;
  }

  throw new ApiError(
    503,
    "ai_usage_unavailable",
    "AI usage could not be verified right now. Please try again in a moment."
  );
}

/**
 * Accumulate usage for a user for the current UTC day. Metering must never
 * break generation, so failures are logged — but the primary path is an
 * atomic in-database increment (no read-compute-write race), with the legacy
 * read-modify-write kept only as a fallback for databases where the
 * increment_ai_usage migration has not been applied yet.
 */
export async function recordAiUsage(
  uid: string,
  input: { promptTokens?: number; completionTokens?: number; requests?: number } = {}
) {
  const requests = Math.max(input.requests ?? 0, 0);
  const promptTokens = Math.max(input.promptTokens ?? 0, 0);
  const completionTokens = Math.max(input.completionTokens ?? 0, 0);

  if (uid && requests === 0 && promptTokens === 0 && completionTokens === 0) return;

  const tokens = promptTokens + completionTokens;

  try {
    const { error } = await supabaseAdmin().rpc("increment_ai_usage", {
      p_uid: uid,
      p_day: todayKey(),
      p_requests: requests,
      p_tokens: tokens,
    });

    if (!error) {
      usageCache.delete(cacheKey(uid, todayKey()));
      return;
    }

    // 42883 = undefined_function: migration not applied yet. Anything else is
    // also survivable for metering, but logged loudly.
    console.error("AI usage atomic increment failed, using legacy path:", error.message);
    await recordAiUsageLegacy(uid, requests, tokens);
  } catch (error) {
    console.error("AI usage record failed:", error instanceof Error ? error.message : "unknown error");
  }
}

async function recordAiUsageLegacy(uid: string, requests: number, tokens: number) {
  try {
    const day = todayKey();
    const read = await readUsage(uid, day);
    const current = read.ok ? read.row : null;
    const next: UsageRow = {
      uid,
      day,
      requests: (current?.requests ?? 0) + requests,
      total_tokens: (current?.total_tokens ?? 0) + tokens,
    };

    const { error } = await supabaseAdmin()
      .from("ai_usage")
      .upsert(
        { ...next, updated_at: new Date().toISOString() },
        { onConflict: "uid,day" }
      );

    if (error) {
      console.error("AI usage record failed:", error.message);
    } else {
      writeCache(next);
    }
  } catch (error) {
    console.error("AI usage record failed:", error instanceof Error ? error.message : "unknown error");
  }
}
