import { ApiError } from "@/lib/api";
import { logger } from "@/lib/server/secure-logger";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getEntitlement, type Entitlement } from "@/lib/server/entitlements";
import { FREE_TRIAL_DAYS, isTrialPlanId } from "@/lib/plans";
import { getClientIp } from "@/lib/server/rate-limit";

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

/**
 * Extract and normalize the device address from a Request or raw address string.
 *
 * In web and mobile clients:
 * - Checks `x-device-address` header first if present (e.g. native app / tester).
 * - Falls back to server-resolved `getClientIp(request)`, which securely evaluates
 *   `x-vercel-forwarded-for`, `x-real-ip`, or the tail of `x-forwarded-for` without spoofing.
 * - Normalizes to lowercase and trims whitespace.
 * - Returns "unknown" if no valid address could be determined.
 */
export function getDeviceAddress(requestOrAddress?: Request | string | null): string {
  if (!requestOrAddress) return "unknown";

  if (typeof requestOrAddress === "string") {
    const trimmed = requestOrAddress.trim().toLowerCase();
    return trimmed || "unknown";
  }

  // It is a Request
  const custom = requestOrAddress.headers.get("x-device-address")?.trim();
  if (custom && custom.toLowerCase() !== "unknown") {
    return custom.toLowerCase();
  }

  const ip = getClientIp(requestOrAddress);
  return ip ? ip.trim().toLowerCase() : "unknown";
}

export type TrialGrantResult = {
  granted: boolean;
  /** True when the RPC could not be reached, so the caller must not assume anything. */
  errored: boolean;
  /** Explanatory reason when the trial was not granted. */
  reason?: "device_already_used" | "already_claimed" | "missing_device_address" | "error";
};

/**
 * Grant the free trial to an account that has never had an entitlement,
 * binding the trial to the requesting device address.
 *
 * Enforces one free trial per device: if a device address (client IP / device address)
 * has already been granted a free trial across ANY account, any subsequent grant
 * attempts on that device are blocked.
 *
 * Idempotent by construction: `start_free_trial` inserts only when no
 * entitlement row exists for the uid and the device has not been used,
 * so calling this on every authenticated request is safe and cannot extend or repeat a trial.
 *
 * Never throws. A failure here must not break a request — a paying user whose
 * trial RPC is briefly unreachable must still reach their paid tools — so the
 * error is logged and the caller falls through to the entitlement read, which
 * remains the only authority on access.
 */
export async function ensureTrialEntitlement(
  uid: string,
  deviceAddress?: string
): Promise<TrialGrantResult> {
  if (!uid) return { granted: false, errored: true };

  const cleanDevice = deviceAddress ? deviceAddress.trim().toLowerCase() : null;

  try {
    const { data, error } = await supabaseAdmin().rpc("start_free_trial", {
      p_uid: uid,
      p_days: freeTrialDays(),
      p_device_address: cleanDevice,
    });

    if (error) {
      logger.warn("Free trial grant could not be evaluated:", error.message);
      return { granted: false, errored: true, reason: "error" };
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { granted?: boolean | null }
      | null;

    const granted = Boolean(row?.granted);

    if (granted) {
      logger.info("Free trial granted", {
        uid: uid.slice(0, 8),
        days: freeTrialDays(),
        device: cleanDevice,
      });
    } else {
      logger.info("Free trial withheld (already claimed or device already used)", {
        uid: uid.slice(0, 8),
        device: cleanDevice,
      });
    }

    return {
      granted,
      errored: false,
      reason: granted ? undefined : "device_already_used",
    };
  } catch (error) {
    logger.warn(
      "Free trial grant threw:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { granted: false, errored: true, reason: "error" };
  }
}

export type ResolvedTrialEntitlement = Entitlement & {
  trialJustGranted?: boolean;
  trialDays?: number;
};

/**
 * Read an account's entitlement, starting the one-time trial if it has none yet
 * and the requesting device has not yet consumed a free trial.
 *
 * Costs one read for an account that already has access — the common case — and
 * only reaches for the grant RPC when the account is inactive, so paying users
 * never pay for a trial write on every request. Never throws: a failure to
 * grant is logged and the (inactive) entitlement is returned as-is.
 */
export async function resolveEntitlementWithTrial(
  uid: string,
  requestOrAddress?: Request | string
): Promise<ResolvedTrialEntitlement> {
  try {
    const entitlement = await getEntitlement(uid);

    if (entitlement.status === "active") {
      return {
        ...entitlement,
        trialJustGranted: false,
        trialDays: freeTrialDays(),
      };
    }

    const deviceAddress = getDeviceAddress(requestOrAddress);
    const { granted } = await ensureTrialEntitlement(uid, deviceAddress);

    if (granted) {
      const fresh = await getEntitlement(uid);
      return {
        ...fresh,
        trialJustGranted: true,
        trialDays: freeTrialDays(),
      };
    }

    return {
      ...entitlement,
      trialJustGranted: false,
      trialDays: freeTrialDays(),
    };
  } catch (error) {
    logger.warn(
      "resolveEntitlementWithTrial fell back:",
      error instanceof Error ? error.message : "unknown error"
    );
    return {
      status: "inactive",
      trialJustGranted: false,
      trialDays: freeTrialDays(),
    };
  }
}

/**
 * The gate for a paid tool: the account must end up active, either because it
 * is on a paid plan or because its one-time trial just started on this device.
 *
 * This is `assertPaidAccess` with the device-guarded trial in front of it, and it throws the
 * same 402 the paywall already handles, so no client changes are needed.
 */
export async function assertPaidAccessOrStartTrial(
  uid: string,
  requestOrAddress?: Request | string
): Promise<Entitlement> {
  const entitlement = await resolveEntitlementWithTrial(uid, requestOrAddress);

  if (entitlement.status !== "active") {
    throw new ApiError(
      402,
      "paid_access_required",
      "This tool is part of the paid MUN prep workspace."
    );
  }

  return entitlement;
}
