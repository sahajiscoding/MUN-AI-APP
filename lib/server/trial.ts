import { ApiError } from "@/lib/api";
import { logger } from "@/lib/server/secure-logger";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEntitlement, type Entitlement } from "@/lib/server/entitlements";
import { FREE_TRIAL_DAYS, isTrialPlanId } from "@/lib/plans";

/** Read a bounded integer from the environment, falling back when invalid. */
function envInt(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

/** Days of free access granted to a new account. Bounded to match the RPC. */
export function freeTrialDays() {
  return envInt("AI_FREE_TRIAL_DAYS", FREE_TRIAL_DAYS, 1, 30);
}

/**
 * Daily token budget for a trial account.
 *
 * The trial lifts the *request* limit (see `trialUsageLimits`) but not the cost
 * ceiling, because "unlimited prompts" must not mean "unbounded spend on a free
 * account". This is set well above anything a person can type — a delegate
 * prepping hard for a conference uses a few hundred thousand tokens across the
 * whole trial — so it is invisible in normal use and binds only on a script.
 */
export function trialDailyTokenCap() {
  // The floor is not arbitrary: a single request reserves its prompt plus the
  // full completion ceiling (up to ~18,000 tokens at the trial's maximum), so a
  // cap below that would make every request fail and the trial unusable. If a
  // tighter allowance than this is wanted, shorten the trial instead.
  return envInt("AI_TRIAL_DAILY_TOKEN_CAP", 1_000_000, 100_000, 5_000_000);
}

/**
 * Usage limits for a trial account: unlimited requests, bounded tokens.
 *
 * `requestCap: 0` means "no request cap" to `reserve_ai_usage`, which is what
 * makes the trial genuinely unlimited in the sense the feature promises.
 */
export function trialUsageLimits() {
  return { requestCap: 0, tokenCap: trialDailyTokenCap() };
}

/** True when an entitlement is the one-time free trial rather than paid access. */
export function isTrialEntitlement(entitlement: Entitlement | null | undefined) {
  return Boolean(
    entitlement &&
      entitlement.status === "active" &&
      isTrialPlanId(entitlement.planId)
  );
}

export type TrialGrantResult = {
  granted: boolean;
  /** True when the RPC could not be reached, so the caller must not assume anything. */
  errored: boolean;
};

/**
 * Grant the free trial to an account that has never had an entitlement.
 *
 * Idempotent by construction: `start_free_trial` inserts only when no
 * entitlement row exists for the uid, so calling this on every authenticated
 * request is safe and cannot extend or repeat a trial.
 *
 * Never throws. A failure here must not break a request — a paying user whose
 * trial RPC is briefly unreachable must still reach their paid tools — so the
 * error is logged and the caller falls through to the entitlement read, which
 * remains the only authority on access.
 */
export async function ensureTrialEntitlement(uid: string): Promise<TrialGrantResult> {
  if (!uid) return { granted: false, errored: true };

  try {
    const { data, error } = await supabaseAdmin().rpc("start_free_trial", {
      p_uid: uid,
      p_days: freeTrialDays(),
    });

    if (error) {
      logger.warn("Free trial grant could not be evaluated:", error.message);
      return { granted: false, errored: true };
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { granted?: boolean | null }
      | null;

    const granted = Boolean(row?.granted);

    if (granted) {
      logger.info("Free trial granted", {
        uid: uid.slice(0, 8),
        days: freeTrialDays(),
      });
    }

    return { granted, errored: false };
  } catch (error) {
    logger.warn(
      "Free trial grant threw:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { granted: false, errored: true };
  }
}

/**
 * Read an account's entitlement, starting the one-time trial if it has none yet.
 *
 * Costs one read for an account that already has access — the common case — and
 * only reaches for the grant RPC when the account is inactive, so paying users
 * never pay for a trial write on every request. Never throws: a failure to
 * grant is logged and the (inactive) entitlement is returned as-is.
 */
export async function resolveEntitlementWithTrial(uid: string): Promise<Entitlement> {
  const entitlement = await getEntitlement(uid);

  if (entitlement.status === "active") return entitlement;

  const { granted } = await ensureTrialEntitlement(uid);
  return granted ? getEntitlement(uid) : entitlement;
}

/**
 * The gate for a paid tool: the account must end up active, either because it
 * is on a paid plan or because its one-time trial just started.
 *
 * This is `assertPaidAccess` with the trial in front of it, and it throws the
 * same 402 the paywall already handles, so no client changes are needed.
 */
export async function assertPaidAccessOrStartTrial(uid: string): Promise<Entitlement> {
  const entitlement = await resolveEntitlementWithTrial(uid);

  if (entitlement.status !== "active") {
    throw new ApiError(
      402,
      "paid_access_required",
      "This tool is part of the paid MUN prep workspace."
    );
  }

  return entitlement;
}
