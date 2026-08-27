import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

async function source(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Security contract failed: ${message}`);
}

const migration = await source("supabase/migrations/20260827_security_hardening.sql");
const referrals = await source("lib/referrals.ts");
const entitlements = await source("lib/server/entitlements.ts");
const reconcile = await source("app/api/admin/reconcile-payments/route.ts");
const middleware = await source("proxy.ts");
const nextConfig = await source("next.config.ts");
const news = await source("app/api/news/route.ts");
const referralRoute = await source("app/[referralCode]/page.tsx");

assert(migration.includes("create or replace function public.create_first_referral_commission"), "commission RPC is missing");
assert(migration.includes("v_referral.status <> 'registered'"), "commission converted-status guard is missing");
assert(migration.includes("status = 'paid'"), "commission RPC does not require a paid payment");
assert(migration.includes("and uid = p_uid"), "commission RPC does not bind the payment to the customer");
assert(migration.includes("for update"), "commission RPC does not lock the customer referral row");
assert(migration.includes("grant execute on function public.create_first_referral_commission"), "commission RPC grant is missing");
assert(migration.includes("create or replace function public.grant_entitlement_atomic"), "entitlement RPC is missing");
assert(migration.includes("public.entitlements.status = 'active'"), "entitlement extension does not check current status atomically");
assert(migration.includes("make_interval(days => p_access_days)"), "entitlement duration is not calculated in the database");
assert(referrals.includes('rpc("create_first_referral_commission"'), "application does not call the atomic commission RPC");
assert(!referrals.includes('.from("referral_commissions")'), "application still writes commissions directly");
assert(entitlements.includes('rpc("grant_entitlement_atomic"'), "application does not call the atomic entitlement RPC");
assert(!entitlements.includes('.from("entitlements")\n      .upsert'), "application still uses read-compute-upsert entitlement mutation");
assert(reconcile.includes("requireAdmin"), "reconciliation endpoint does not require the verified admin session");
assert(!reconcile.includes("PAYMENT_RECONCILIATION_SECRET"), "static reconciliation secret remains active");
assert(reconcile.includes("checkRateLimit"), "reconciliation endpoint is not rate limited");
assert(reconcile.includes('Cache-Control", "private, no-store'), "reconciliation response is not private/no-store");
assert(middleware.includes("crypto.randomUUID"), "CSP nonce is not generated per request");
assert(middleware.includes("nonce-"), "CSP nonce source is missing");
assert(!nextConfig.includes("unsafe-eval"), "unsafe-eval remains in the static CSP configuration");
assert(news.includes("checkRateLimit"), "news endpoint is not rate limited");
assert(news.includes("Promise.allSettled"), "news endpoint lost partial-feed resilience");
assert(referralRoute.includes("notFound"), "invalid referral routes do not return 404");
assert(referralRoute.includes("REFERRAL_PATH_PATTERN"), "referral route validation is missing");

console.log("Security contract checks passed.");
