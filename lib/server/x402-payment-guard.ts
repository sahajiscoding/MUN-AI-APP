/**
 * SERVER-ONLY MODULE — never import from client components.
 *
 * x402 one-payment-one-grant guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * The x402 reference stack has no HTTP-layer idempotency. Its own
 * specification states that replay is prevented because "each authorization
 * includes a unique 32-byte nonce" and "EIP-3009 contracts inherently prevent
 * nonce reuse at the smart contract level" — which protects the TOKEN, not the
 * SERVICE. `/verify` is stateless, so a captured `PAYMENT-SIGNATURE` verifies
 * successfully every time it is presented.
 *
 * Against a facilitator that is authoritative for single-use, on-chain state
 * happens to save you. Against any facilitator that is not (a broadcast-only
 * storefront, a `settlement_pending`/optimistic settle path, a degraded RPC, a
 * facilitator that reports success before a receipt, or a cache-permitting
 * intermediary), one signed payment produces N grants.
 *
 * This module makes "one signed payment ⇒ at most one granted resource" an
 * invariant owned by this application, independent of facilitator behaviour.
 *
 * HOW THE IDENTITY IS DERIVED
 * ---------------------------
 * Only from cryptographically SIGNED fields:
 *
 *   sha256("x402-v1|" || network || "|" || asset || "|" || payer || "|" || nonce)
 *
 * `payer` + `nonce` is exactly the tuple that is single-use on chain, so a
 * client cannot produce two distinct identities from one authorization, and
 * cannot reuse one identity across two authorizations. The client-supplied
 * `resource` object and the `payment-identifier` extension id are deliberately
 * NOT part of the identity: both are attacker-controlled, so they are recorded
 * for diagnostics and never used as the security control.
 */

import { createHash } from "crypto";
import { logger } from "@/lib/server/secure-logger";

/** Fields extracted from a verified payment payload. */
export interface X402PaymentIdentity {
  /** Deterministic, signature-derived, single-use identity. */
  identity: string;
  /** Payer address from the signed authorization, when the payload exposes one. */
  payer: string | null;
  /** Single-use nonce from the signed authorization, when exposed. */
  nonce: string | null;
  /** CAIP-2 network from the payment requirements. */
  network: string;
  /** Token contract address from the payment requirements. */
  asset: string | null;
  /** Authorized amount in atomic units, when exposed. */
  amountAtomic: string | null;
  /** Hash of the signature, for correlation in logs and the ledger. */
  signatureHash: string;
  /**
   * True when the payload matched a known scheme shape (EIP-3009 or Permit2).
   * False means the identity fell back to hashing the whole payload, which
   * still rejects byte-identical replays but is a weaker signal.
   */
  strong: boolean;
}

export type X402ClaimOutcome =
  | { ok: true; identity: string; alreadyClaimed: false }
  | {
      ok: false;
      reason: "replay";
      identity: string;
      /** Resource the payment was originally consumed for, when known. */
      claimedResource?: string;
      /** Unix millis of the original claim, when known. */
      claimedAt?: number;
    }
  | { ok: false; reason: "store_unavailable"; identity: string };

export interface X402ClaimRecord {
  paymentIdentity: string;
  resourceKey: string;
  network: string;
  asset: string | null;
  payer: string | null;
  amountAtomic: string | null;
  transactionHash: string | null;
  /** Reserved for the `payment-identifier` extension id, when a client sends one. */
  paymentIdHint: string | null;
  claimedAt: number;
}

export interface X402ClaimStore {
  /**
   * Atomically reserve `identity`. MUST be a single atomic operation: two
   * concurrent calls for the same identity may not both succeed.
   */
  insert(record: X402ClaimRecord): Promise<"inserted" | "duplicate">;
  /** Non-authoritative fast lookup used to reject obvious replays early. */
  lookup(identity: string): Promise<Pick<X402ClaimRecord, "resourceKey" | "claimedAt"> | null>;
  /** Number of claims made by `payer` since `since` (inclusive). */
  countSince(payer: string, since: Date): Promise<number>;
}

/* ------------------------------------------------------------------ */
/* Identity derivation                                                */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(source: Record<string, unknown> | null, key: string): string | null {
  if (!source) return null;
  const value = source[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Extracts the single-use authorization tuple from a payment payload.
 *
 * Supports the two EVM shapes the `exact` scheme can produce:
 * - EIP-3009: `payload.authorization` = { from, nonce, value, validBefore }
 * - Permit2:  `payload.permit2Authorization` = { from, nonce, deadline, ... }
 */
function extractAuthorization(payloadBody: unknown): {
  from: string | null;
  nonce: string | null;
  amount: string | null;
  shape: "eip3009" | "permit2" | "unknown";
} {
  const body = asRecord(payloadBody);

  const eip3009 = asRecord(body?.authorization);
  if (eip3009) {
    return {
      from: readString(eip3009, "from"),
      nonce: readString(eip3009, "nonce"),
      amount: readString(eip3009, "value"),
      shape: "eip3009",
    };
  }

  const permit2 = asRecord(body?.permit2Authorization);
  if (permit2) {
    return {
      from: readString(permit2, "from"),
      nonce: readString(permit2, "nonce"),
      amount: readString(asRecord(permit2.permitted), "amount") ?? readString(permit2, "amount"),
      shape: "permit2",
    };
  }

  return { from: null, nonce: null, amount: null, shape: "unknown" };
}

/**
 * Derives the deterministic, single-use identity for a verified payment.
 *
 * Never throws: a payload whose shape is not recognised falls back to hashing
 * the whole payload, so the guard degrades to "reject byte-identical replays"
 * rather than failing open.
 */
export function deriveX402PaymentIdentity(
  paymentPayload: unknown,
  paymentRequirements: unknown
): X402PaymentIdentity {
  const payload = asRecord(paymentPayload);
  const requirements = asRecord(paymentRequirements);

  const network = readString(requirements, "network") ?? "unknown";
  const asset = readString(requirements, "asset");
  const signature = readString(payload, "signature") ?? "";
  const signatureHash = sha256Hex(signature || JSON.stringify(payload?.payload ?? null));

  const { from, nonce, amount, shape } = extractAuthorization(payload?.payload);
  const strong = shape !== "unknown" && Boolean(from) && Boolean(nonce);

  if (!strong) {
    logger.warn("x402 payment guard: unrecognised payload shape, falling back to payload hash", {
      shape,
      hasPayer: Boolean(from),
      hasNonce: Boolean(nonce),
    });
  }

  const identity = strong
    ? sha256Hex(`x402-v1|${network}|${asset ?? ""}|${from}|${nonce}`)
    : sha256Hex(`x402-fallback-v1|${network}|${asset ?? ""}|${signatureHash}`);

  return {
    identity,
    payer: from,
    nonce,
    network,
    asset,
    amountAtomic: amount ?? readString(requirements, "amount") ?? null,
    signatureHash,
    strong,
  };
}

/* ------------------------------------------------------------------ */
/* Stores                                                             */
/* ------------------------------------------------------------------ */

/** True when the backend Supabase credentials needed by the store are present. */
function hasSupabaseCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/**
 * In-process store. Used by the test suite and local development when Supabase
 * is not configured. Single-instance only — never sufficient for production,
 * which is why the durable Supabase store is preferred whenever credentials
 * exist and the route fails closed when that store errors.
 */
class MemoryClaimStore implements X402ClaimStore {
  private readonly claims = new Map<string, X402ClaimRecord>();

  async insert(record: X402ClaimRecord): Promise<"inserted" | "duplicate"> {
    if (this.claims.has(record.paymentIdentity)) return "duplicate";
    this.claims.set(record.paymentIdentity, record);
    return "inserted";
  }

  async lookup(identity: string) {
    const found = this.claims.get(identity);
    return found ? { resourceKey: found.resourceKey, claimedAt: found.claimedAt } : null;
  }

  async countSince(payer: string, since: Date) {
    const cutoff = since.getTime();
    let count = 0;
    for (const claim of this.claims.values()) {
      if (claim.payer === payer && claim.claimedAt >= cutoff) count++;
    }
    return count;
  }

  clear() {
    this.claims.clear();
  }
}

/**
 * Durable store backed by `public.x402_payment_claims`.
 *
 * Uniqueness comes from the table PRIMARY KEY, so the duplicate check is the
 * database's own atomic constraint rather than a read-then-write race.
 */
class SupabaseClaimStore implements X402ClaimStore {
  async insert(record: X402ClaimRecord): Promise<"inserted" | "duplicate"> {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const admin = supabaseAdmin();

    const { error } = await admin.from("x402_payment_claims").insert({
      payment_identity: record.paymentIdentity,
      resource_key: record.resourceKey,
      network: record.network,
      asset: record.asset,
      payer: record.payer,
      amount_atomic: record.amountAtomic,
      transaction_hash: record.transactionHash,
      payment_id_hint: record.paymentIdHint,
      claimed_at: new Date(record.claimedAt).toISOString(),
    });

    if (!error) return "inserted";

    // 23505 = unique_violation → the signed authorization was already consumed.
    if (error.code === "23505") return "duplicate";

    throw new Error(`x402 claim store insert failed: ${error.message}`);
  }

  async lookup(identity: string) {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("x402_payment_claims")
      .select("resource_key, claimed_at")
      .eq("payment_identity", identity)
      .maybeSingle();

    if (error) throw new Error(`x402 claim store lookup failed: ${error.message}`);
    if (!data) return null;

    const claimedAt = Date.parse(String(data.claimed_at));
    return {
      resourceKey: String(data.resource_key),
      claimedAt: Number.isFinite(claimedAt) ? claimedAt : Date.now(),
    };
  }

  async countSince(payer: string, since: Date) {
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const admin = supabaseAdmin();

    const { count, error } = await admin
      .from("x402_payment_claims")
      .select("payment_identity", { count: "exact", head: true })
      .eq("payer", payer)
      .gte("claimed_at", since.toISOString());

    if (error) throw new Error(`x402 claim store count failed: ${error.message}`);
    return count ?? 0;
  }
}

const memoryStore = new MemoryClaimStore();

let overriddenStore: X402ClaimStore | null = null;

function store(): X402ClaimStore {
  if (overriddenStore) return overriddenStore;
  return hasSupabaseCredentials() ? new SupabaseClaimStore() : memoryStore;
}

/** Test seam: clears the in-process store. No effect on the Supabase store. */
export function resetX402ClaimStoreForTests(): void {
  memoryStore.clear();
  overriddenStore = null;
}

/**
 * Test seam: force a specific store, or pass `null` to restore auto-selection.
 * Used to prove the pipeline fails closed when the store is unreachable.
 */
export function setX402ClaimStoreForTests(replacement: X402ClaimStore | null): void {
  overriddenStore = replacement;
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export interface ClaimX402PaymentParams {
  identity: X402PaymentIdentity;
  /**
   * The specific resource the payment is being consumed for. Recorded on the
   * claim so a cross-resource replay is distinguishable from an honest retry.
   */
  resourceKey: string;
  transactionHash?: string | null;
  /** Optional `payment-identifier` extension id, recorded for correlation only. */
  paymentIdHint?: string | null;
}

/**
 * Atomically consumes a verified payment.
 *
 * Call this AFTER settlement succeeds and BEFORE the resource is released, and
 * never serve the resource when the outcome is not `ok: true`.
 */
export async function claimX402Payment(
  params: ClaimX402PaymentParams
): Promise<X402ClaimOutcome> {
  const { identity, resourceKey, transactionHash, paymentIdHint } = params;

  const record: X402ClaimRecord = {
    paymentIdentity: identity.identity,
    resourceKey,
    network: identity.network,
    asset: identity.asset,
    payer: identity.payer,
    amountAtomic: identity.amountAtomic,
    transactionHash: transactionHash ?? null,
    paymentIdHint: paymentIdHint ?? null,
    claimedAt: Date.now(),
  };

  try {
    const result = await store().insert(record);

    if (result === "duplicate") {
      // Best-effort detail for the log only; the rejection itself does not
      // depend on this lookup succeeding.
      let claimedResource: string | undefined;
      let claimedAt: number | undefined;
      try {
        const existing = await store().lookup(identity.identity);
        claimedResource = existing?.resourceKey;
        claimedAt = existing?.claimedAt;
      } catch {
        // Ignore: the duplicate decision is already authoritative.
      }

      logger.error("SECURITY: x402 payment replay rejected", {
        identity: identity.identity.slice(0, 16),
        payer: identity.payer,
        requestedResource: resourceKey,
        claimedResource,
      });

      return { ok: false, reason: "replay", identity: identity.identity, claimedResource, claimedAt };
    }

    return { ok: true, identity: identity.identity, alreadyClaimed: false };
  } catch (error) {
    // FAIL CLOSED. If the guard cannot record the claim we cannot prove this
    // payment is single-use, so the resource must not be released. Serving
    // here would re-open exactly the replay hole this module closes.
    logger.error("x402 payment guard store unavailable — refusing to grant", {
      identity: identity.identity.slice(0, 16),
      error: error instanceof Error ? error.message : String(error),
    });

    return { ok: false, reason: "store_unavailable", identity: identity.identity };
  }
}

/**
 * Cheap pre-settlement check for an obvious replay, so a duplicate does not
 * cost a facilitator round trip and on-chain gas.
 *
 * NON-AUTHORITATIVE: it must never be the reason a resource is granted. The
 * authoritative decision is always `claimX402Payment`.
 */
export async function isX402PaymentClaimed(identity: string): Promise<boolean> {
  try {
    return (await store().lookup(identity)) !== null;
  } catch {
    // Treat an unreadable store as "not known claimed" so the authoritative
    // post-settlement claim still runs (and fails closed there if needed).
    return false;
  }
}

/** Deterministic ledger reference so a duplicate ledger write conflicts. */
export function x402OrderRef(identity: string): string {
  return `x402-${identity.slice(0, 40)}`;
}

/**
 * Counts how many payments `payer` has consumed since `since`.
 *
 * Machine callers have no `auth.users` row, so the human per-user AI ledger
 * (`ai_usage_daily`, which references `auth.users`) cannot track them. This is
 * the machine-side equivalent: an exact request count per payer, derived from
 * the same atomic claims table that enforces single-use.
 *
 * Throws when the store is unreadable so the caller can fail closed — a bot
 * budget that silently reads as "zero used" would be no budget at all.
 */
export async function countPayerClaimsSince(payer: string, since: Date): Promise<number> {
  return store().countSince(payer, since);
}

/** Start of the current UTC day, matching the human AI ledger's date bucketing. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
