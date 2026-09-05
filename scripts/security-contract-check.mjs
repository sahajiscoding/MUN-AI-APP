import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const migration2 = await source("supabase/migrations/20260905_security_fixes.sql");
const adminAuth = await source("lib/server/admin-auth.ts");
const adminLoginRoute = await source("app/api/c8f2x9/login/route.ts");
const approveRoute = await source("app/api/c8f2x9/approve/route.ts");
const rateLimit = await source("lib/server/rate-limit.ts");
const aiUsage = await source("lib/server/ai-usage.ts");
const research = await source("app/api/ai/research/route.ts");
const progress = await source("app/api/progress/route.ts");
const certificate = await source("app/api/courses/[slug]/certificate/route.ts");

assert(migration2.includes("rate_limit_check"), "shared rate-limit function is missing from the migration");
assert(migration2.includes("pg_advisory_xact_lock"), "entitlement grant is not serialized with an advisory lock");
assert(migration2.includes("self_referral"), "DB-enforced self-referral guard is missing");
assert(migration2.includes("quiz_verified_at"), "quiz_verified_at column is missing from the migration");
assert(migration2.includes("quiz_verified_at = coalesce(quiz_verified_at, updated_at)"), "legacy passing course rows are not backfilled");
assert(migration2.includes("revoke all on public.course_progress from anon, authenticated"), "course_progress client grants are not revoked");
assert(migration2.includes("admin_audit_log"), "admin audit log table is missing");
assert(migration2.includes("ai_usage"), "AI usage ledger table is missing");
assert(rateLimit.includes("x-vercel-forwarded-for"), "rate limiter does not prefer platform-controlled IP headers");
assert(rateLimit.includes("export async function checkRateLimit"), "rate limiting is not DB-backed async");
assert(aiUsage.includes("assertAiUsageAllowed"), "AI daily allowance enforcement is missing");
assert(aiUsage.includes("ai_daily_limit"), "AI daily limit error is missing");
assert(research.includes("getClientIp"), "AI route still trusts the first x-forwarded-for entry");
assert(research.includes("assertAiUsageAllowed"), "AI route does not enforce the daily usage allowance");
assert(progress.includes("quizAnswers"), "progress endpoint does not accept server-graded quiz submissions");
assert(progress.includes("buildCourseReviewQuestions"), "progress endpoint does not grade against the canonical review questions");
assert(certificate.includes("quiz_verified_at"), "certificate route does not require a server-verified quiz pass");
assert(nextConfig.includes("Strict-Transport-Security"), "HSTS header is missing");
assert(!adminAuth.includes("ADMIN_PASSWORD"), "shared admin password path still exists");
assert(adminAuth.includes("adminSessionForUid"), "admin sessions are not bound to a Supabase identity");
assert(adminAuth.includes("requireAdminOwner"), "owner-tier enforcement is missing");
assert(adminLoginRoute.includes("requireUser"), "admin login does not verify a Supabase identity");
assert(!adminLoginRoute.includes("body.password"), "admin login still accepts a shared password");
assert(approveRoute.includes("requireAdminOwner"), "admin grants are not owner-only");

console.log("Security contract checks passed.");
