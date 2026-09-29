// Security gate matrix: ~80 small, independently-runnable checks.
// Each gate is one CI-visible check via .github/workflows/security-matrix.yml.
// Run one:  node scripts/security-matrix.mjs <gate-id>
// Run all:  node scripts/security-matrix.mjs --all
// Every gate below was verified passing against the tree before being added;
// keep it that way — a failing gate blocks CI by design.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", "dist", "build"]);

function src(rel) {
  const r = resolve(root, rel);
  if (r !== root && !r.startsWith(root + sep)) throw new Error(`escapes repo root: ${rel}`);
  return readFileSync(r, "utf8");
}

function walk(dir, exts) {
  const out = [];
  const abs = resolve(root, dir);
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(join(dir, entry.name), exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const TS = [".ts", ".tsx"];
const CODE = [".ts", ".tsx", ".mjs", ".js"];
const TEXT = [".ts", ".tsx", ".mjs", ".js", ".json", ".sql", ".md", ".yml", ".yaml", ".toml", ".html", ".css"];

function filesMatching(dirs, exts, re, exclude = []) {
  const norm = exclude.map((e) => e.replace(/\\/g, "/"));
  return dirs.flatMap((d) => walk(d, exts)).filter((f) => !norm.includes(f.replace(/\\/g, "/")) && re.test(src(f)));
}

function countMatches(dirs, exts, pattern) {
  const re = new RegExp(pattern, "gi");
  let n = 0;
  for (const f of dirs.flatMap((d) => walk(d, exts))) {
    const m = src(f).match(re);
    if (m) n += m.length;
  }
  return n;
}

// This script's own gate patterns contain the substrings they scan for.
const SELF = "scripts/security-matrix.mjs";

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n").map((l) => l.trim()).filter(Boolean);
}

function nextVersion() {
  return JSON.parse(src("package.json")).dependencies.next;
}

const GATES = [
  // ---- secrets & env ----
  { id: "no-tracked-env-files", run() {
    const bad = trackedFiles().filter((p) => /^\.env(\.|$)/.test(p) && p !== ".env.example");
    if (bad.length) throw new Error(`tracked env files: ${bad.join(", ")}`);
  } },
  { id: "env-example-no-live-keys", run() {
    const s = src(".env.example");
    for (const re of [/sk-live-/, /ghp_[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /BEGIN .*PRIVATE KEY/])
      if (re.test(s)) throw new Error(`live credential pattern in .env.example: ${re}`);
  } },
  { id: "no-private-keys", run() {
    const bad = filesMatching(["app", "lib", "components", "scripts", "supabase", ".github"], TEXT, /BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY/);
    if (bad.length) throw new Error(`private key material in: ${bad.join(", ")}`);
  } },
  { id: "no-aws-keys", run() {
    const bad = filesMatching(["app", "lib", "components", "scripts"], CODE, /AKIA[0-9A-Z]{16}/);
    if (bad.length) throw new Error(`possible AWS key in: ${bad.join(", ")}`);
  } },
  { id: "no-github-pat", run() {
    const bad = filesMatching(["app", "lib", "components", "scripts"], CODE, /ghp_[A-Za-z0-9]{20,}/);
    if (bad.length) throw new Error(`possible GitHub PAT in: ${bad.join(", ")}`);
  } },
  { id: "no-admin-password", run() {
    const bad = filesMatching(["app", "lib"], TS, /ADMIN_PASSWORD/);
    if (bad.length) throw new Error(`ADMIN_PASSWORD path in: ${bad.join(", ")}`);
  } },
  { id: "next-public-allowlist", run() {
    const allowed = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SITE_URL"]);
    const bad = [];
    for (const f of walk("app", TS).concat(walk("lib", TS), walk("components", [".tsx", ".ts"]))) {
      for (const m of src(f).matchAll(/NEXT_PUBLIC_[A-Z_]+/g)) if (!allowed.has(m[0])) bad.push(`${f}:${m[0]}`);
    }
    if (bad.length) throw new Error(`non-approved public vars: ${bad.join(", ")}`);
  } },
  { id: "gitignore-env-coverage", run() {
    const s = src(".gitignore");
    for (const e of [".env", ".env.local", ".env.production", ".env.development"])
      if (!s.split("\n").map((l) => l.trim()).includes(e)) throw new Error(`missing gitignore entry: ${e}`);
  } },
  // ---- headers & transport ----
  { id: "hsts-header", run() {
    if (!/Strict-Transport-Security/.test(src("next.config.ts"))) throw new Error("HSTS missing");
  } },
  { id: "frame-deny", run() {
    if (!/X-Frame-Options.*DENY/.test(src("next.config.ts"))) throw new Error("X-Frame-Options DENY missing");
  } },
  { id: "nosniff-header", run() {
    if (!/X-Content-Type-Options.*nosniff/.test(src("next.config.ts"))) throw new Error("nosniff missing");
  } },
  { id: "referrer-policy", run() {
    if (!/Referrer-Policy.*strict-origin-when-cross-origin/.test(src("next.config.ts"))) throw new Error("Referrer-Policy missing");
  } },
  { id: "static-csp-fallback", run() {
    const s = src("next.config.ts");
    if (!/default-src 'self'/.test(s)) throw new Error("static CSP fallback missing");
    if (!/frame-ancestors 'none'/.test(s)) throw new Error("frame-ancestors missing");
  } },
  { id: "no-unsafe-eval", run() {
    if (/unsafe-eval/.test(src("next.config.ts"))) throw new Error("unsafe-eval in static CSP");
  } },
  { id: "nonce-per-request", run() {
    const s = src("proxy.ts");
    if (!/crypto\.randomUUID/.test(s)) throw new Error("per-request nonce not generated");
    if (!/nonce-/.test(s)) throw new Error("nonce source missing");
  } },
  { id: "https-redirect", run() {
    const s = src("proxy.ts");
    if (!/url\.protocol = "https:"/.test(s)) throw new Error("HTTPS upgrade missing");
    if (!/NextResponse\.redirect\(url, 308\)/.test(s)) throw new Error("308 redirect missing");
  } },
  // ---- auth ----
  { id: "server-side-session-verify", run() {
    const s = src("lib/supabase/auth.ts");
    if (!/supabase\.auth\.getUser\(/.test(s)) throw new Error("server-side getUser missing");
  } },
  { id: "unauthenticated-401", run() {
    if (!/ApiError\(401/.test(src("lib/supabase/auth.ts"))) throw new Error("401 gate missing");
  } },
  { id: "admin-login-identity", run() {
    if (!/requireUser/.test(src("app/api/c8f2x9/login/route.ts"))) throw new Error("admin login skips identity check");
  } },
  { id: "no-shared-admin-password", run() {
    if (/body\.password/.test(src("app/api/c8f2x9/login/route.ts"))) throw new Error("shared password accepted");
  } },
  { id: "owner-only-grants", run() {
    for (const f of ["app/api/c8f2x9/approve/route.ts", "app/api/admin/referrals/partners/[id]/dashboard-link/route.ts"])
      if (!/requireAdminOwner/.test(src(f))) throw new Error(`not owner-only: ${f}`);
  } },
  { id: "email-verification", run() {
    for (const f of ["app/api/auth/signin/route.ts", "lib/supabase/auth.ts"])
      if (!/email_confirmed_at/.test(src(f))) throw new Error(`no verification check: ${f}`);
  } },
  { id: "no-account-enumeration", run() {
    const s = src("app/api/auth/signup/route.ts");
    if (/already exists|user exists|email exists|email taken/i.test(s)) throw new Error("signup leaks existence");
    const leaks = filesMatching(["app/api/auth"], TS, /NextResponse\.json.*error\.message|return.*error\.message/);
    if (leaks.length) throw new Error(`raw errors to client: ${leaks.join(", ")}`);
  } },
  { id: "admin-identity-binding", run() {
    if (!/adminSessionForUid/.test(src("lib/server/admin-auth.ts"))) throw new Error("sessions not identity-bound");
  } },
  { id: "session-revocation", run() {
    if (!/revoked admin cannot/i.test(src("lib/server/admin-auth.ts"))) throw new Error("revocation check missing");
  } },
  // ---- session & MFA ----
  { id: "cookie-httponly", run() {
    if (!/httpOnly: true/.test(src("lib/server/admin-auth.ts"))) throw new Error("cookie not httpOnly");
  } },
  { id: "cookie-samesite-strict", run() {
    if (!/sameSite: "strict"/.test(src("lib/server/admin-auth.ts"))) throw new Error("cookie not SameSite=strict");
  } },
  { id: "cookie-secure-prod", run() {
    if (!/secure: process\.env\.NODE_ENV === "production"/.test(src("lib/server/admin-auth.ts"))) throw new Error("cookie not Secure in prod");
  } },
  { id: "session-4h-cap", run() {
    if (!/SESSION_MAX_AGE = 60 \* 60 \* 4/.test(src("lib/server/admin-auth.ts"))) throw new Error("session lifetime not 4h");
  } },
  { id: "secret-32-minimum", run() {
    if (!/secret\.length < 32/.test(src("lib/server/admin-auth.ts"))) throw new Error("32-char secret minimum missing");
  } },
  { id: "mfa-enforced", run() {
    const s = src("lib/server/admin-auth.ts");
    if (!/assertAdminMfaEnrolled/.test(s)) throw new Error("MFA enforcement missing");
    if (!/ADMIN_REQUIRE_MFA/.test(s)) throw new Error("MFA lever missing");
  } },
  // ---- input validation ----
  { id: "no-eval", run() {
    const bad = filesMatching(["app", "lib", "components", "scripts"], [".ts", ".tsx", ".mjs"], /\beval\(/, [SELF]);
    if (bad.length) throw new Error(`eval() in: ${bad.join(", ")}`);
  } },
  { id: "no-new-function", run() {
    const bad = filesMatching(["app", "lib", "components", "scripts"], [".ts", ".tsx", ".mjs"], /new Function\(/, [SELF]);
    if (bad.length) throw new Error(`new Function() in: ${bad.join(", ")}`);
  } },
  { id: "no-pickle", run() {
    const bad = filesMatching(["app", "lib", "scripts"], [".ts", ".mjs"], /pickle\.loads|pickle\.load/);
    if (bad.length) throw new Error(`pickle in: ${bad.join(", ")}`);
  } },
  { id: "no-weak-hashes", run() {
    const bad = filesMatching(["app", "lib"], TS, /createHash\(["'](md5|sha1)["']|createHmac\(["'](md5|sha1)["']/);
    if (bad.length) throw new Error(`weak hash in: ${bad.join(", ")}`);
  } },
  { id: "sha256-only", run() {
    const algos = new Set();
    for (const f of walk("app", TS).concat(walk("lib", TS)))
      for (const m of src(f).matchAll(/createHa(?:sh|mac)\(["']([^"']+)["']/g)) algos.add(m[1]);
    for (const a of algos) if (a !== "sha256") throw new Error(`non-sha256 hash in use: ${a}`);
    if (!algos.has("sha256")) throw new Error("no sha256 usage found");
  } },
  { id: "zod-coverage", run() {
    const n = filesMatching(["app/api"], [".ts"], /from "zod"/).length;
    if (n < 15) throw new Error(`zod coverage regressed: ${n}`);
  } },
  { id: "strict-schemas", run() {
    const n = filesMatching(["app", "lib"], TS, /\.strict\(\)/).length;
    if (n < 8) throw new Error(`strict() coverage regressed: ${n}`);
  } },
  { id: "uuid-route-ids", run() {
    const n = filesMatching(["app/api"], [".ts"], /z\.string\(\)\.uuid\(\)/).length;
    if (n < 4) throw new Error(`uuid id validation regressed: ${n}`);
  } },
  { id: "safe-json-parse", run() {
    const n = filesMatching(["app/api"], [".ts"], /parseJson|jsonError/).length;
    if (n < 25) throw new Error(`safe-helper coverage regressed: ${n}`);
  } },
  // ---- client boundary ----
  { id: "no-server-imports-in-components", run() {
    const bad = filesMatching(["components"], [".tsx", ".ts"], /supabase\/server|payments\/uropay|ai\/nvidia|server\/admin-auth/);
    if (bad.length) throw new Error(`server module in components: ${bad.join(", ")}`);
  } },
  { id: "no-dangerous-html", run() {
    const bad = filesMatching(["app", "components", "lib"], [".ts", ".tsx"], /dangerouslySetInnerHTML|\binnerHTML\b/);
    if (bad.length) throw new Error(`raw HTML rendering in: ${bad.join(", ")}`);
  } },
  { id: "nvidia-key-server-only", run() {
    const bad = filesMatching(["app", "components"], [".ts", ".tsx"], /NVIDIA_API_KEY/);
    if (bad.length) throw new Error(`NVIDIA key reachable from client: ${bad.join(", ")}`);
  } },
  { id: "service-secrets-server-only", run() {
    const bad = filesMatching(["app", "components"], [".ts", ".tsx"], /SUPABASE_SECRET_KEY|UROPAY_API_SECRET|ADMIN_SESSION_SECRET|NVIDIA_API_KEY/);
    if (bad.length) throw new Error(`server secret reachable from client: ${bad.join(", ")}`);
  } },
  // ---- rate limiting ----
  { id: "auth-endpoints-limited", run() {
    for (const f of ["app/api/auth/signin/route.ts", "app/api/auth/signup/route.ts", "app/api/auth/reset-request/route.ts", "app/api/auth/reset-password/route.ts"])
      if (!/checkRateLimit/.test(src(f))) throw new Error(`not rate limited: ${f}`);
  } },
  { id: "admin-login-limited", run() {
    if (!/checkRateLimit/.test(src("app/api/c8f2x9/login/route.ts"))) throw new Error("admin login not rate limited");
  } },
  { id: "ai-route-limited", run() {
    if (!/checkRateLimit/.test(src("app/api/ai/research/route.ts"))) throw new Error("AI route not rate limited");
  } },
  { id: "payments-limited", run() {
    if (!/checkRateLimit/.test(src("app/api/payments/create-order/route.ts"))) throw new Error("order creation not rate limited");
  } },
  { id: "webhook-limited", run() {
    if (!/checkRateLimit/.test(src("app/api/webhooks/uropay/route.ts"))) throw new Error("webhook not rate limited");
  } },
  { id: "public-forms-limited", run() {
    for (const f of ["app/api/partner/applications/route.ts", "app/api/news/route.ts", "app/api/referrals/capture/route.ts"])
      if (!/checkRateLimit/.test(src(f))) throw new Error(`not rate limited: ${f}`);
  } },
  // ---- payments ----
  { id: "webhook-verify-present", run() {
    if (!/export function verifyWebhookSignature/.test(src("lib/payments/uropay.ts"))) throw new Error("verify fn missing");
    if (!/verifyWebhookSignature/.test(src("app/api/webhooks/uropay/route.ts"))) throw new Error("route skips verification");
  } },
  { id: "timing-safe-compare", run() {
    if (!/timingSafeEqual/.test(src("lib/payments/uropay.ts"))) throw new Error("comparison not timing-safe");
  } },
  { id: "replay-window", run() {
    if (!/MAX_AGE_SECONDS/.test(src("lib/payments/uropay.ts"))) throw new Error("replay window missing");
  } },
  { id: "raw-body-verify", run() {
    if (!/rawBody/.test(src("app/api/webhooks/uropay/route.ts"))) throw new Error("raw body not used");
  } },
  { id: "webhook-idempotency", run() {
    const s = src("app/api/webhooks/uropay/route.ts");
    if (!/markWebhookEventProcessed/.test(s)) throw new Error("events not marked processed");
    if (!/already_processed/.test(s)) throw new Error("duplicate delivery not short-circuited");
  } },
  { id: "authoritative-status", run() {
    if (!/getOrderStatus/.test(src("lib/payments/uropay.ts"))) throw new Error("authoritative lookup missing");
    if (!/getOrderStatus/.test(src("app/api/webhooks/uropay/route.ts"))) throw new Error("webhook trusts notification only");
  } },
  { id: "no-static-recon-secret", run() {
    const bad = filesMatching(["app", "lib"], TS, /PAYMENT_RECONCILIATION_SECRET/);
    if (bad.length) throw new Error(`static secret in: ${bad.join(", ")}`);
  } },
  { id: "commission-repair", run() {
    if (!/processReferralCommission/.test(src("app/api/payments/status/route.ts"))) throw new Error("status recovery skips commissions");
    if (!/processReferralCommission/.test(src("lib/server/payment-reconciliation.ts"))) throw new Error("reconciliation skips commissions");
  } },
  // ---- RLS & DB ----
  { id: "rls-enabled", run() {
    const n = countMatches(["supabase"], [".sql"], "enable row level security");
    if (n < 10) throw new Error(`RLS coverage regressed: ${n}`);
  } },
  { id: "auth-uid-scoping", run() {
    const n = countMatches(["supabase"], [".sql"], "auth\\.uid\\(\\)");
    if (n < 10) throw new Error(`auth.uid() scoping regressed: ${n}`);
  } },
  { id: "no-open-policies", run() {
    const bad = filesMatching(["supabase"], [".sql"], /USING\s*\(\s*true\s*\)/i);
    if (bad.length) throw new Error(`open policy in: ${bad.join(", ")}`);
  } },
  { id: "client-revokes", run() {
    const n = filesMatching(["supabase"], [".sql"], /revoke all/i).length;
    if (n < 5) throw new Error(`client-grant revokes regressed: ${n}`);
  } },
  { id: "advisory-serialization", run() {
    const files = ["supabase/migrations/20260905_security_fixes.sql", "supabase/migrations/20260827_security_hardening.sql"].filter((f) => {
      try { src(f); return true; } catch { return false; }
    });
    const hit = files.some((f) => /pg_advisory_xact_lock/.test(src(f)));
    if (!hit) throw new Error("advisory serialization lock missing");
  } },
  { id: "self-referral-guard", run() {
    const found = walk("supabase/migrations", [".sql"]).some((f) => /self_referral/.test(src(f)));
    if (!found) throw new Error("DB self-referral guard missing");
  } },
  // ---- API hygiene ----
  { id: "api-no-store", run() {
    if (!/private, no-store/.test(src("proxy.ts"))) throw new Error("proxy no-store missing");
    if (!/private, no-store/.test(src("app/api/admin/reconcile-payments/route.ts"))) throw new Error("reconcile no-store missing");
    if (!/pathname !== "\/api\/news"/.test(src("proxy.ts"))) throw new Error("public news exception not explicit");
  } },
  { id: "vary-header", run() {
    if (!/Vary.*Authorization, Cookie/.test(src("proxy.ts"))) throw new Error("Vary header missing");
  } },
  { id: "no-stack-in-responses", run() {
    const bad = filesMatching(["app/api"], [".ts"], /"stack"|\bstack\b.*json|stack:\s*error/);
    if (bad.length) throw new Error(`stack exposure in: ${bad.join(", ")}`);
  } },
  { id: "referral-404", run() {
    const s = src("app/[referralCode]/page.tsx");
    if (!/notFound/.test(s)) throw new Error("invalid referral lacks 404");
    if (!/REFERRAL_PATH_PATTERN/.test(s)) throw new Error("referral pattern validation missing");
  } },
  { id: "no-secret-console-logs", run() {
    const bad = filesMatching(["app", "lib", "components"], [".ts", ".tsx"], /console\.(log|error|warn)\([^)]*\b(apiKey|apiSecret|secret|password|privateKey|webhookSecret|ADMIN_SESSION_SECRET|SUPABASE_SECRET_KEY|NVIDIA_API_KEY)\b/);
    if (bad.length) throw new Error(`possible secret in logs: ${bad.join(", ")}`);
  } },
  { id: "error-helpers-defined", run() {
    const s = src("lib/api.ts");
    for (const t of ["export class ApiError", "export function jsonError", "function parseJson"])
      if (!s.includes(t)) throw new Error(`missing helper: ${t}`);
  } },
  { id: "csrf-origin-check", run() {
    const s = src("proxy.ts");
    if (!/isSafeOrigin/.test(s)) throw new Error("same-origin check missing");
    if (!/csrf_origin_mismatch/.test(s)) throw new Error("CSRF rejection missing");
  } },
  // ---- supply chain ----
  { id: "lockfile-tracked", run() {
    if (!trackedFiles().includes("pnpm-lock.yaml")) throw new Error("lockfile not tracked");
  } },
  { id: "no-floating-ranges", run() {
    const p = JSON.parse(src("package.json"));
    const bad = Object.entries({ ...p.dependencies, ...p.devDependencies }).filter(([, v]) => /[\^~]/.test(v));
    if (bad.length) throw new Error(`floating ranges: ${bad.map(([k]) => k).join(", ")}`);
  } },
  { id: "jsyaml-override", run() {
    if (!/js-yaml: 4\.3\.2/.test(src("pnpm-workspace.yaml"))) throw new Error("js-yaml override missing");
  } },
  { id: "packagemanager-pin", run() {
    if (!/"packageManager": "pnpm@/.test(src("package.json"))) throw new Error("packageManager pin missing");
  } },
  { id: "no-install-hooks", run() {
    const p = JSON.parse(src("package.json")).scripts || {};
    for (const k of ["postinstall", "preinstall", "prepare"])
      if (p[k]) throw new Error(`install hook present: ${k}`);
  } },
  { id: "lockfile-next-sync", run() {
    if (!src("pnpm-lock.yaml").includes(`next@${nextVersion()}`)) throw new Error("lockfile out of sync with next version");
  } },
  // ---- meta & contract ----
  { id: "contract-asserts-floor", run() {
    const n = (src("scripts/security-contract-check.mjs").match(/assert\(/g) || []).length;
    if (n < 120) throw new Error(`contract shrank: ${n}`);
  } },
  { id: "scanner-patterns-intact", run() {
    const s = src("scripts/scan-secrets.mjs");
    for (const p of ["SUPABASE_SECRET_KEY", "ADMIN_PASSWORD", "UROPAY_", "NVIDIA_API_KEY"])
      if (!s.includes(p)) throw new Error(`scanner lost pattern: ${p}`);
  } },
  { id: "workflows-least-privilege", run() {
    const bad = walk(".github/workflows", [".yml"]).filter((f) => !/permissions:/.test(src(f)));
    if (bad.length) throw new Error(`no permissions block: ${bad.join(", ")}`);
  } },
  { id: "actions-pinned", run() {
    const bad = [];
    for (const f of walk(".github/workflows", [".yml"])) {
      if (/actions\/checkout@/.test(src(f)) && !/actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/.test(src(f))) bad.push(f);
      const floats = [...src(f).matchAll(/uses:\s*\S+@(main|master)\b/g)];
      if (floats.length) bad.push(`${f} (floating branch)`);
    }
    if (bad.length) throw new Error(`unpinned actions: ${bad.join(", ")}`);
  } },
  { id: "no-secrets-in-workflows", run() {
    const bad = [];
    for (const f of walk(".github/workflows", [".yml"]))
      if (/echo.*secrets\.|run:.*\$\{\{\s*secrets\./.test(src(f)) && !f.endsWith("workflow-hardening.yml")) bad.push(f);
    if (bad.length) throw new Error(`secrets in logs: ${bad.join(", ")}`);
  } },
  { id: "triage-log-present", run() {
    if (!/External SAST triage log/.test(src("SECURITY.md"))) throw new Error("triage log missing");
  } },
];

const map = new Map(GATES.map((g) => [g.id, g]));
const arg = process.argv[2];
if (arg === "--all") {
  let failed = 0;
  for (const g of GATES) {
    try { g.run(); console.log(`ok   ${g.id}`); }
    catch (e) { failed++; console.log(`FAIL ${g.id}: ${e.message}`); }
  }
  console.log(`${GATES.length - failed}/${GATES.length} gates passed`);
  process.exit(failed ? 1 : 0);
} else if (arg === "--ids") {
  console.log(GATES.map((g) => g.id).join("\n"));
} else if (arg && map.has(arg)) {
  try { map.get(arg).run(); console.log(`gate passed: ${arg}`); }
  catch (e) { console.error(`gate failed: ${arg}: ${e.message}`); process.exit(1); }
} else {
  console.error(`unknown gate: ${arg}\nusage: node scripts/security-matrix.mjs <gate-id|--all|--ids>`);
  process.exit(2);
}
