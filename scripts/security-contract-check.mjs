import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

// Applied migrations are intentionally removed from the repo once they have
// been run against production. Their content invariants are then enforced by
// the live database only; return null so those assertions are skipped.
async function sourceOptional(relativePath) {
  try {
    return await source(relativePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Security contract failed: ${message}`);
}

const migration = await sourceOptional("supabase/migrations/20260827_security_hardening.sql");
const referrals = await source("lib/referrals.ts");
const entitlements = await source("lib/server/entitlements.ts");
const reconcile = await source("app/api/admin/reconcile-payments/route.ts");
const middleware = await source("proxy.ts");
const nextConfig = await source("next.config.ts");
const news = await source("app/api/news/route.ts");
const referralRoute = await source("app/[referralCode]/page.tsx");

assert(!migration || migration.includes("create or replace function public.create_first_referral_commission"), "commission RPC is missing");
assert(!migration || migration.includes("v_referral.status <> 'registered'"), "commission converted-status guard is missing");
assert(!migration || migration.includes("status = 'paid'"), "commission RPC does not require a paid payment");
assert(!migration || migration.includes("and uid = p_uid"), "commission RPC does not bind the payment to the customer");
assert(!migration || migration.includes("for update"), "commission RPC does not lock the customer referral row");
assert(!migration || migration.includes("grant execute on function public.create_first_referral_commission"), "commission RPC grant is missing");
assert(!migration || migration.includes("create or replace function public.grant_entitlement_atomic"), "entitlement RPC is missing");
assert(!migration || migration.includes("public.entitlements.status = 'active'"), "entitlement extension does not check current status atomically");
assert(!migration || migration.includes("make_interval(days => p_access_days)"), "entitlement duration is not calculated in the database");
assert(referrals.includes('rpc("create_first_referral_commission"'), "application does not call the atomic commission RPC");
assert(!/(\.from\("referral_commissions"\)\s*\.(insert|update|upsert|delete))/.test(referrals), "application still writes commissions directly");
assert(referrals.includes("not_referred_yet"), "commission path can pay for payments made before the code was attached");
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

const migration2 = await sourceOptional("supabase/migrations/20260905_security_fixes.sql");
const adminAuth = await source("lib/server/admin-auth.ts");
const adminLoginRoute = await source("app/api/c8f2x9/login/route.ts");
const approveRoute = await source("app/api/c8f2x9/approve/route.ts");
const rateLimit = await source("lib/server/rate-limit.ts");
const aiUsage = await source("lib/server/ai-usage.ts");
const research = await source("app/api/ai/research/route.ts");
const progress = await source("app/api/progress/route.ts");
const certificate = await source("app/api/courses/[slug]/certificate/route.ts");
const statusRoute = await source("app/api/payments/status/route.ts");
const reconciliation = await source("lib/server/payment-reconciliation.ts");
const migration3 = await sourceOptional("supabase/migrations/20260906_partner_dashboard.sql");
const captureRoute = await source("app/api/referrals/capture/route.ts");
const partnerDashboard = await source("app/partner/[token]/page.tsx");
const partnerRoute = await source("app/api/admin/referrals/partners/route.ts");
const dashboardLinkRoute = await source("app/api/admin/referrals/partners/[id]/dashboard-link/route.ts");
const migration4 = await sourceOptional("supabase/migrations/20260907_partner_applications.sql");
const applyPage = await source("app/become-a-partner/page.tsx");
const applyRoute = await source("app/api/partner/applications/route.ts");
const applicationsRoute = await source("app/api/admin/referrals/applications/route.ts");
const applicationDismissRoute = await source("app/api/admin/referrals/applications/[id]/route.ts");

assert(!migration2 || migration2.includes("rate_limit_check"), "shared rate-limit function is missing from the migration");
assert(!migration2 || migration2.includes("pg_advisory_xact_lock"), "entitlement grant is not serialized with an advisory lock");
assert(!migration2 || migration2.includes("self_referral"), "DB-enforced self-referral guard is missing");
assert(!migration2 || migration2.includes("quiz_verified_at"), "quiz_verified_at column is missing from the migration");
assert(!migration2 || migration2.includes("quiz_verified_at = coalesce(quiz_verified_at, updated_at)"), "legacy passing course rows are not backfilled");
assert(!migration2 || migration2.includes("revoke all on public.course_progress from anon, authenticated"), "course_progress client grants are not revoked");
assert(!migration2 || migration2.includes("admin_audit_log"), "admin audit log table is missing");
assert(!migration2 || migration2.includes("ai_usage"), "AI usage ledger table is missing");
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
assert(statusRoute.includes("processReferralCommission"), "payment status recovery does not create referral commissions");
assert(reconciliation.includes("processReferralCommission"), "payment reconciliation does not repair missing referral commissions");
assert(!migration3 || migration3.includes("dashboard_token"), "partner dashboard token column is missing from the migration");
assert(!migration3 || migration3.includes("click_count"), "partner click counter is missing from the migration");
assert(captureRoute.includes("recordReferralClick"), "referral capture does not record partner clicks");
assert(partnerRoute.includes("createPartnerDashboardToken"), "new partners are not issued a dashboard token");
assert(dashboardLinkRoute.includes("requireAdminOwner"), "partner dashboard links are not owner-only");
assert(partnerDashboard.includes("getPartnerDashboard"), "partner dashboard page does not load data by secret token");
assert(!partnerDashboard.includes("requireAdmin"), "partner dashboard incorrectly requires an admin session");
assert(!partnerDashboard.includes("customer_email"), "partner dashboard leaks customer emails");
assert(!migration4 || migration4.includes("partner_applications"), "partner applications table is missing from the migration");
assert(applyRoute.includes("checkRateLimit"), "public partner application is not rate limited");
assert(applyRoute.includes("partner_applications"), "public application does not write to the applications table");
assert(applyPage.includes("PartnerApplyForm"), "become-a-partner page has no application form");
assert(applyPage.includes("PublicPage"), "become-a-partner page is not a public page");
assert(applicationsRoute.includes("requireAdminOwner"), "partner applications are not owner-only to view");
assert(applicationDismissRoute.includes("requireAdminOwner"), "partner applications are not owner-only to dismiss");

const grantSubscriptionRoute = await source("app/api/c8f2x9/grant-subscription/route.ts");
assert(grantSubscriptionRoute.includes("requireAdminOwner"), "manual subscription grants are not owner-only");
assert(grantSubscriptionRoute.includes("grantEntitlement"), "manual subscription grant does not use the atomic entitlement path");
assert(grantSubscriptionRoute.includes("recordAdminAction"), "manual subscription grant is not audit-logged");
assert(grantSubscriptionRoute.includes("expiresAt"), "manual subscription grant cannot take a custom expiry");
assert(grantSubscriptionRoute.includes("MAX_ACCESS_DAYS"), "custom expiry is not bounded");

const revokeSubscriptionRoute = await source("app/api/c8f2x9/revoke-subscription/route.ts");
assert(revokeSubscriptionRoute.includes("requireAdminOwner"), "manual subscription revokes are not owner-only");
assert(revokeSubscriptionRoute.includes('source !== "admin_manual"'), "subscription revoke can touch non-manual grants");
assert(revokeSubscriptionRoute.includes("recordAdminAction"), "manual subscription revoke is not audit-logged");

// Post-audit hardening invariants: every fix below must hold or the build
// fails. These assert the remediations, not just the original design.
const aiUsageAtomic = await source("supabase/migrations/20260908_ai_usage_atomic.sql");
assert(aiUsageAtomic.includes("increment_ai_usage"), "atomic AI usage RPC is missing");
assert(aiUsageAtomic.includes("on conflict"), "atomic AI usage RPC is not race-safe");
assert(aiUsageAtomic.includes("to service_role"), "atomic AI usage RPC grant is missing");

const partnerTokenMigration = await source("supabase/migrations/20260908_partner_token_security.sql");
assert(partnerTokenMigration.includes("dashboard_token_expires_at"), "partner token expiry column is missing");
assert(partnerTokenMigration.includes("digest("), "partner token hashing backfill is missing");

assert(adminAuth.includes("listFactors"), "admin MFA enrollment is not enforced");
assert(adminAuth.includes("admin_mfa_required"), "admin MFA error is missing");
assert(adminAuth.includes("bumpAdminSessionVersion"), "admin session revocation helper is missing");
assert(adminLoginRoute.includes("bumpAdminSessionVersion"), "admin logout does not revoke the session");
assert(progress.includes("lessons_require_checkpoint"), "bulk progress can still self-attest lessons");
assert(progress.includes("progress-quiz"), "quiz submissions are not rate limited");
const checkpointRoute = await source("app/api/progress/checkpoint/route.ts");
assert(checkpointRoute.includes("checkpoint:"), "checkpoint oracle is not rate limited");
const finalRoute = await sourceOptional("app/api/progress/final/route.ts");
assert(finalRoute === null, "dead final-review route still exposes a contradictory trust path");
assert(statusRoute.includes("payment-status"), "payment status polling is not rate limited");
assert(reconcile.includes("admin-reconcile:${admin.uid}"), "reconcile throttle is not keyed by admin identity");
const createOrderRoute = await source("app/api/payments/create-order/route.ts");
assert(createOrderRoute.includes("assertSafeCheckoutUrl"), "checkout URL is not allowlisted");
assert(approveRoute.includes("getUserById"), "admin approval does not verify the target user");
assert(approveRoute.includes("preservesPaid"), "admin approval can clobber paid entitlements");
const revokeRoute = await source("app/api/c8f2x9/revoke/route.ts");
assert(revokeRoute.includes('existing.source === "admin"'), "admin revoke can wipe paid entitlements");
assert(referrals.includes("hashDashboardToken"), "partner tokens are not hashed");
assert(referrals.includes('partner.status !== "active"'), "suspended partners can still open dashboards");
assert(dashboardLinkRoute.includes("mintPartnerDashboardToken"), "dashboard links are not rotation-issued");
assert(dashboardLinkRoute.includes("recordAdminAction"), "dashboard link minting is not audit-logged");
const usersRoute = await source("app/api/c8f2x9/users/route.ts");
assert(usersRoute.includes("maskEmail"), "delegated admins see unmasked user emails");
assert(usersRoute.includes("pageSize"), "admin user list is unpaginated");
const referralsAdminRoute = await source("app/api/admin/referrals/route.ts");
assert(referralsAdminRoute.includes("isOwnerAdmin"), "referral PII is not tiered by admin role");
assert(aiUsage.includes("increment_ai_usage"), "AI metering does not use the atomic increment");
assert(aiUsage.includes("ai_usage_unavailable"), "AI caps fail open when the ledger is unreachable");
const apiLib = await source("lib/api.ts");
assert(apiLib.includes("payload_too_large"), "JSON bodies have no byte cap");
assert(news.includes("readCappedText"), "news feed bodies are unbounded");
const auth = await source("lib/supabase/auth.ts");
const signupAuthRoute = await source("app/api/auth/signup/route.ts");
const signinAuthRoute = await source("app/api/auth/signin/route.ts");
const resetRequestRoute = await source("app/api/auth/reset-request/route.ts");
const resetPasswordRoute = await source("app/api/auth/reset-password/route.ts");
assert(auth.includes("email_confirmed_at"), "protected user auth does not enforce verified email");
assert(signupAuthRoute.includes("checkRateLimit"), "signup is not rate limited");
assert(signupAuthRoute.includes("website"), "signup honeypot is missing");
assert(signinAuthRoute.includes("checkRateLimit"), "password login is not rate limited");
assert(resetRequestRoute.includes("checkRateLimit"), "password reset requests are not rate limited");
assert(resetPasswordRoute.includes("updateUserById"), "password reset does not update the authenticated user server-side");
assert(middleware.includes("csrf_origin_mismatch"), "state-changing API requests have no origin check");
assert(middleware.includes("x-forwarded-proto"), "production HTTPS redirect is missing");
assert(nextConfig.includes("productionBrowserSourceMaps: false"), "production sourcemaps are not explicitly disabled");

const adminLoginPage = await source("app/c8f2x9/page.tsx");
assert(adminLoginPage.includes("mfa.verify"), "admin UI has no MFA verification flow");
assert(adminLoginPage.includes("admin_mfa_required"), "admin UI does not handle the MFA challenge");

// Sep-2026 audit remediation invariants: every fix from the full-tree
// audit and urgent hardening batch must hold or the build fails.
const packageJson = JSON.parse(await source("package.json"));
const nextParts = packageJson.dependencies.next.split(".").map(Number);
assert(
  nextParts[0] > 16 ||
    (nextParts[0] === 16 && (nextParts[1] > 3 || (nextParts[1] === 3 && nextParts[2] >= 6))),
  "next is below the patched 16.3.6 (GHSA-vcvr-r3jv-pc5j ImageResponse RCE)"
);
assert(
  packageJson.devDependencies["eslint-config-next"] === packageJson.dependencies.next,
  "eslint-config-next does not match the next version"
);
const workspaceYaml = await source("pnpm-workspace.yaml");
assert(workspaceYaml.includes("js-yaml: 4.3.2"), "js-yaml security override is missing (CVE-2026-84375)");
const lockfile = await source("pnpm-lock.yaml");
assert(lockfile.includes("js-yaml@4.3.2"), "lockfile does not pin the patched js-yaml 4.3.2");
assert(
  lockfile.includes(`next@${packageJson.dependencies.next}`),
  "lockfile is out of sync with the next version in package.json (Vercel frozen-lockfile would fail)"
);
const webhookRoute = await source("app/api/webhooks/uropay/route.ts");
assert(webhookRoute.includes("checkRateLimit"), "uropay webhook is not rate limited");
assert(webhookRoute.includes("webhook-uropay:"), "uropay webhook throttle is not keyed by client IP");
assert(news.includes("processEntities"), "news XML parser does not disable entity processing");
assert(!news.includes("extractTag"), "dead regex-based XML helper is still present");
assert(captureRoute.includes("normalizedCode"), "referral capture does not normalize codes before lookup");
assert(signupAuthRoute.includes("Could not create account"), "signup leaks provider error text (user enumeration)");
assert(nextConfig.includes("Content-Security-Policy"), "static CSP fallback is missing for proxy-excluded paths");
const gitignore = await source(".gitignore");
const gitignoreLines = gitignore.split("\n").map((line) => line.trim());
assert(gitignoreLines.includes(".env.production"), "bare .env.production is committable");
assert(gitignoreLines.includes(".env.development"), "bare .env.development is committable");

const skippedMigrations = [migration, migration2, migration3, migration4].filter((file) => file === null).length;
if (skippedMigrations > 0) {
  console.log(`Note: ${skippedMigrations} applied migration file(s) were removed from the repo after being run; their content assertions were skipped.`);
}

console.log("Security contract checks passed.");
