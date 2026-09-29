# SECURITY.md — MUN-AI-APP Security Policy, Controls & Checklists

> **Status:** living document. Update it whenever a control changes, a new route/table/secret is added, or an incident teaches us something.
> **Stack:** Next.js 16 + React 19 + Supabase (`@supabase/ssr`, `supabase-js`) + NVIDIA NIM + UroPay. Package manager `pnpm@11.19.0`.
> **Companion rules:** `AGENTS.md` (non-negotiable per-task rules) is the law; this file is the *how* — the full check inventory, the rationale, and the copy-paste verification commands.
> **Automated gates:** `scripts/security-contract-check.mjs` + `scripts/scan-secrets.mjs` (run via `pnpm test`), `pnpm typecheck`, `.github/workflows/security.yml` on every push/PR to `main`.

---

## 0. How to use this file

1. **Before writing any code**, read the section that matches your change (API route → §8 + §10; DB migration → §9; payment code → §16; new secret → §4; new dependency → §19).
2. **Before opening a PR**, run the full gate in §20 and tick the PR checklist in §25.
3. **Before deploying**, run the Vercel checklist in §21.
4. **After any incident**, follow §23, then add the regression check here and to `scripts/security-contract-check.mjs`.

Check IDs (`SEC-ENV-01`, `SEC-AUTH-04`, …) are stable references — cite them in PR reviews (`"violates SEC-API-02"`).

---

## 1. Reporting a vulnerability

* **Do NOT open a public issue** for a suspected vulnerability.
* Report privately to the repo owner with: affected file/route, steps to reproduce, impact assessment, and whether exploit traffic is visible in logs.
* Expected response: acknowledgement within 48h, fix or mitigation plan within 7 days for High/Critical.
* Safe-harbor: good-faith researchers who avoid data exfiltration, service disruption, and social engineering will not face legal action.

---

## 2. Supported versions

| Branch / tag | Status | Notes |
|---|---|---|
| `main` (HEAD) | ✅ Supported | Only deployable branch. Every push runs `.github/workflows/security.yml`. |
| Older commits | ❌ Unsupported | May contain remediated issues (see §22 history). Upgrade to HEAD. |

---

## 3. What we protect (asset inventory)

| Asset | Where it lives | Impact if compromised |
|---|---|---|
| `SUPABASE_SECRET_KEY` (service role, bypasses RLS) | Vercel env only, read in `lib/supabase/server.ts:45` | Full DB read/write |
| `ADMIN_SESSION_SECRET` (≥32 chars, signs admin cookie) | Vercel env only, enforced `lib/server/admin-auth.ts:22-35` | Admin impersonation |
| `NVIDIA_API_KEY` | Vercel env only, used `lib/ai/nvidia.ts:114` server-side | Spend abuse on our quota |
| `UROPAY_API_KEY` / `UROPAY_API_SECRET` / `UROPAY_WEBHOOK_SECRET` | Vercel env only, used `lib/payments/uropay.ts:5-7` | Payment forgery / theft |
| User JWTs (Supabase Auth) | Supabase auth cookies + `Authorization: Bearer` runtime tokens | Account takeover |
| `admin_session` cookie | `httpOnly, Secure(prod), SameSite=Strict, 4h` (`lib/server/admin-auth.ts:98-104`) | Admin takeover |
| Payments + entitlements + referral commissions | `payments`, `entitlements`, `referral_commissions` tables | Money loss / free access |
| PII (emails, WhatsApp, names) | `users`, `referral_partners`, `partner_applications` | Privacy breach |

---

## 4. Secrets & environment management

### 4.1 Rules

* **SEC-ENV-01:** NEVER commit `.env`, `.env.local`, `.env.production`, `.env.development`, `.env.test`, or any `*.local` file. Only `.env.example` (empty placeholders) may be tracked. Enforced by `.gitignore` + `scripts/scan-secrets.mjs:17-21`.
* **SEC-ENV-02:** NEVER put secrets in `NEXT_PUBLIC_*`, `VITE_*`, or `REACT_APP_*` variables — these are bundled into client JS. Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` may be public.
* **SEC-ENV-03:** NEVER hardcode credentials in source. All secrets come from `process.env` read **server-side only** (`app/api/*`, `lib/server/*`, `lib/payments/*`, `lib/ai/*`).
* **SEC-ENV-04:** NEVER log secrets — no `console.log(apiKey)`, no raw webhook bodies/headers/signatures in logs. NVIDIA layer must call `redactProviderMessage()` (`lib/ai/nvidia.ts:25-30`).
* **SEC-ENV-05:** NEVER paste real keys into chat, docs, tickets, or commit messages. `SETUP.md:131` records a past chat paste — that key must stay rotated.
* **SEC-ENV-06:** `.env.example` must contain placeholders only (`UROPAY_ENVIRONMENT=test`, host allowlists, model names are fine; no real values).
* **SEC-ENV-07:** Production secrets live in exactly one place: the Vercel project environment. No copies in Notion, email, or local backups.
* **SEC-ENV-08:** Secret rotation must be possible without a code change (lazy `process.env` reads preferred over module-load caching).

### 4.2 Verification

```bash
# Only .env.example may be tracked
git ls-files | grep -E "^\.env"   # expect: .env.example only
# No secret assignments with real values in tracked files
node scripts/scan-secrets.mjs
# No NEXT_PUBLIC secret plumbing
grep -rn "NEXT_PUBLIC_.*SECRET\|NEXT_PUBLIC_.*PRIVATE\|SUPABASE_SECRET" app components lib --include="*.ts" --include="*.tsx" | grep -v "server.ts\|SETUP\|AGENTS\|SECURITY"
# Confirm client bundle boundary: must print nothing
grep -rln "supabase/server\|payments/uropay\|ai/nvidia\|server/admin-auth" components/
```

### 4.3 Adding a new secret (procedure)

1. Add `NAME=` (empty) to `.env.example` with a comment saying server-only.
2. Add the `NAME\s*=` pattern to `scripts/scan-secrets.mjs` `keyPatterns` if it is a high-value credential.
3. Read it only in server code; add a `getRequiredEnv()` fail-closed helper call.
4. Set the real value in Vercel env (all environments that need it), never in chat.
5. Tick §25 PR checklist.

---

## 5. Authentication

### 5.1 Rules

* **SEC-AUTH-01:** EVERY API route returning/modifying user data MUST call `requireUser()` (or `requireAdmin()` for admin routes) as the **first statement inside the handler**, before any DB/network work. (`lib/supabase/auth.ts:10-37`, re-exported by `lib/server/auth.ts:5-7`.)
* **SEC-AUTH-02:** Unauthenticated requests to protected endpoints MUST return **401** (`invalid_token`). Never 200 with an error flag, never redirect from an API.
* **SEC-AUTH-03:** `requireUser` MUST verify server-side: `Authorization: Bearer` → `supabaseAdmin().auth.getUser(token)`; else cookie `createClient().auth.getUser()`. Never trust a client-supplied `uid`.
* **SEC-AUTH-04:** Email verification MUST be enforced: `!user.email_confirmed_at` → 403, and login (`app/api/auth/signin/route.ts:27-29`) must reject unverified users.
* **SEC-AUTH-05:** OAuth callback MUST use `exchangeCodeForSession`, a same-origin `getSafeNext()` check, and a generic `?error=oauth_callback_failed` redirect. No open redirects, no provider error text to the client. (`app/auth/callback/route.ts:6-44`.)
* **SEC-AUTH-06:** Login/signup/reset endpoints MUST be rate-limited (see §15) and MUST NOT leak whether an email exists beyond what is unavoidable. Signup MUST return a generic failure (`app/api/auth/signup/route.ts:43`).
* **SEC-AUTH-07:** Password hashing is delegated to Supabase Auth (`signUp`, `signInWithPassword`, `admin.updateUserById`). NEVER implement custom password storage; NEVER use MD5/SHA-1/plain SHA-256 for passwords.
* **SEC-AUTH-08:** Client components (`components/auth-provider.tsx`, `components/protected-route.tsx`) are UX guards only. Real enforcement is always API-side.

### 5.2 Verification

```bash
# Every protected route must reference its gate
for f in app/api/chats/route.ts app/api/me/route.ts app/api/profile/route.ts app/api/progress/route.ts "app/api/chats/[id]/route.ts"; do grep -L "requireUser\|requireAdmin" "$f"; done  # expect: no output
# No raw error.message leaks in auth routes
grep -rn "error.message" app/api/auth/  # expect: only console.error lines
```

---

## 6. Admin access, sessions & MFA

### 6.1 Rules

* **SEC-ADM-01:** Admin identity comes ONLY from the `admin_users` table + live Supabase user lookup (`adminSessionForUid`, `lib/server/admin-auth.ts:44-78`). No shared passwords — `ADMIN_PASSWORD` must not appear in app code (contract asserts this).
* **SEC-ADM-02:** `ADMIN_SESSION_SECRET` MUST be ≥32 random chars, MUST fail closed when missing/short, and MUST NOT fall back to `SUPABASE_SECRET_KEY` (cryptographic separation).
* **SEC-ADM-03:** Admin cookie MUST be `httpOnly:true, secure:(NODE_ENV==production), sameSite:"strict", maxAge:4h, path:/`, host-only (no `Domain`). Clearing MUST re-assert path.
* **SEC-ADM-04:** Every admin request MUST re-validate JWT (issuer/audience) AND the live `admin_users.session_version`. Revoked/deleted admins → `null` → 401. (`getAdminSession:111-146`.)
* **SEC-ADM-05:** Admin promotion (`app/api/c8f2x9/login/route.ts`) requires `requireUser` + `adminSessionForUid` (approved row + MFA). Logout MUST bump session version + clear cookie.
* **SEC-ADM-06:** MFA is mandatory: `assertAdminMfaEnrolled` requires a `verified` TOTP factor; bypass ONLY via `ADMIN_REQUIRE_MFA=false` which MUST `console.error` loudly. Never set false except a live emergency.
* **SEC-ADM-07:** Owner-only mutations (grants, revokes, partner management, commission payout, payment reconcile) MUST use `requireAdminOwner` → 403 `admin_owner_required` for non-owners. (`isOwnerAdmin` = `ADMIN_OWNER_UIDS` allowlist, else first-approved bootstrap owner.)
* **SEC-ADM-08:** Destructive admin actions MUST be audit-logged (`admin_audit_log`) and MUST guard self-revoke and scope (e.g. revoke only `source=admin` entitlements).
* **SEC-ADM-09:** PII in admin APIs MUST be owner-gated: non-owners get masked emails / blanked contact fields (`maskEmail`, blanked `customer_email`/whatsapp/notes).

### 6.2 Verification

```bash
grep -rn "requireAdminOwner" app/api/admin app/api/c8f2x9 | wc -l   # expect: >0, every mutating admin route
grep -rn "ADMIN_PASSWORD" app lib | grep -v scripts/               # expect: no output
node -e "console.log(process.env.ADMIN_SESSION_SECRET?.length >= 32 ? 'secret length OK' : 'SECRET MISSING/SHORT')"
```

---

## 7. Authorization & ownership (anti-IDOR)

* **SEC-API-01:** EVERY route taking a resource ID MUST scope the query to the caller: `.eq("uid", user.uid)` (or equivalent) AND verify `stored.uid === uid` after fetch. Authentication alone is NOT enough.
* **SEC-API-02:** EVERY list endpoint MUST clamp pagination (`limit 1..100`, `page*pageSize` numeric-clamped) — see `app/api/chats/route.ts:12-15`, `app/api/c8f2x9/users/route.ts:31-32`.
* **SEC-API-03:** NEVER trust client-supplied identity fields. Certificate route MUST ignore client `name` and use `user.name/email` (`app/api/courses/[slug]/certificate/route.ts:13-17,93`).
* **SEC-API-04:** Dynamic route params MUST be allowlisted: `legal/[slug]` → `legalPages[slug]`, `status/[state]` → `states.has(state)`, referral paths → `REFERRAL_PATH_PATTERN`, partner tokens → `^[a-f0-9]{48}$`.

### Current route matrix (re-verify on every new route)

| Route | Gate | Ownership |
|---|---|---|
| `api/ai/research` | `requireUser` (+admin fallback), `assertPaidAccess` | `loadOwnedChat` `.eq(id).eq(uid)` |
| `api/chats`, `api/chats/[id]` | `requireUser` | `.eq(uid)` + `storedChat.uid===uid` |
| `api/me`, `api/me/entitlement`, `api/profile` | `requireUser` | `uid:user.uid` upserts, `.eq(uid)` reads |
| `api/progress`, `api/progress/checkpoint` | `requireUser` | `.eq(uid).eq(course_slug)` |
| `api/payments/create-order`, `api/payments/status` | `requireUser` + limits | insert `uid:user.uid`; updates `.eq(id).eq(uid)` |
| `api/courses/[slug]/certificate` | `requireUser` + limit | `.eq(uid).eq(course_slug)` |
| `api/referrals/apply` | `requireUser` + limit | `applyReferralCodeToUser(user.uid, …)` |
| `api/admin/*`, `api/c8f2x9/*` | `requireAdmin` / `requireAdminOwner` | owner-only for mutations |
| `api/auth/*`, `api/news`, `api/referrals/capture`, `api/partner/applications`, `api/webhooks/uropay` | public by design (limits / HMAC / honeypot) | N/A — see their sections |

---

## 8. Supabase Row Level Security

* **SEC-DB-01:** RLS MUST be enabled on EVERY table before deployment. Default policy: **deny all**. (`supabase/schema.sql:92-99` + every migration.)
* **SEC-DB-02:** NEVER `USING (true)` or bare `FOR ALL` without a `WHERE` condition.
* **SEC-DB-03:** Owner-readable tables use `USING (auth.uid() = uid)` for SELECT only; all writes go through service-role server routes. Tables `admin_users`, `webhook_events`, `rate_limits`, `ai_usage`, `admin_audit_log`, `referral_*`, `certificate_downloads`, `partner_applications` have **no client policies** (service role only).
* **SEC-DB-04:** `SECURITY DEFINER` functions MUST set `search_path` (`public, pg_temp` or empty) and `REVOKE … FROM anon, authenticated`.
* **SEC-DB-05:** Money/commission/entitlement mutations MUST be atomic RPCs (`grant_entitlement_atomic` with `pg_advisory_xact_lock`, `create_first_referral_commission` with row `FOR UPDATE` lock + converted-status guard + `uid = p_uid` binding). App code MUST NOT write `referral_commissions`/`entitlements` directly.
* **SEC-DB-06:** Apply migrations in order; never bootstrap a fresh DB from `schema.sql` alone (it has known ordering footnotes — see audit).

### Verification (run in Supabase SQL editor)

```sql
-- 1. RLS enabled everywhere?
select tablename from pg_tables where schemaname='public'
except select tablename from pg_tables where schemaname='public' and rowsecurity;
-- expect: 0 rows
-- 2. No open policies?
select * from pg_policies where qual = 'true' or with_check = 'true';
-- expect: 0 rows
-- 3. Sensitive tables have zero client policies?
select tablename, count(*) from pg_policies
where tablename in ('admin_users','webhook_events','rate_limits','ai_usage','admin_audit_log')
group by 1; -- expect: 0 rows
```

---

## 9. Input validation

* **SEC-IN-01:** ALL user input MUST be validated server-side with `zod` `safeParse` (`trim/min/max/uuid/email/enum`) or an equivalently strict manual check. Client validation is UX only.
* **SEC-IN-02:** JSON bodies MUST go through `parseJson` (512KB cap, `lib/api.ts:46-57`).
* **SEC-IN-03:** IDs in URLs MUST be format-checked (`UUID_PATTERN`, `/^[a-zA-Z0-9-]+$/` + length caps) before DB use.
* **SEC-IN-04:** Numeric pagination/sizes MUST be `Number()`-parsed and clamped.
* **SEC-IN-05:** Webhook payloads MUST be shape-checked (`trim/normalizeStatus/toNumberOrNull`) AND re-verified against the authoritative provider API — never trust webhook amounts/status alone.
* **SEC-IN-06:** Referral codes MUST match `^[A-Z0-9][A-Z0-9_-]{2,31}$` after trim/uppercase (`capture/route.ts:17`), matching `normalizeCode()` downstream.
* **SEC-IN-07:** Public forms SHOULD carry a honeypot (`website` empty) + dual IP/email-hash rate limits (`partner/applications`).

---

## 10. XSS & output encoding

* **SEC-XSS-01:** NEVER `dangerouslySetInnerHTML`, `v-html`, or `innerHTML` with user/LLM content unless sanitized with DOMPurify. Current tree: zero sinks (verified).
* **SEC-XSS-02:** LLM markdown MUST render through `Streamdown` with `rehype-sanitize` + `linkSafety` + `isSafeExternalUrl` (`http(s)` only). Any `https://evil.com` link from a prompt-injected model is still clickable — treat as phishing risk, never auto-trust.
* **SEC-XSS-03:** React text nodes auto-escape — keep it that way. Server `cleanText()` strips tags before storage (`news/route.ts:180-185`).
* **SEC-XSS-04:** `decodeHTMLEntities()` triple-decodes — safe only because output stays in text nodes. Re-audit instantly if any sink is introduced.

```bash
grep -rn "dangerouslySetInnerHTML\|innerHTML\|__html" app components lib --include="*.tsx" --include="*.ts"  # expect: no app hits
```

---

## 11. SQL / query injection

* **SEC-SQL-01:** NEVER concatenate user input into SQL. Use the Supabase query builder (parameterized) or RPCs with named params.
* **SEC-SQL-02:** NEVER interpolate into `.or()/.filter()/.textSearch()` strings.
* **Verification:** `grep -rn "\.query(\|execute_sql\|textSearch\|\\.raw(" app lib` must show no raw SQL with interpolation.

---

## 12. SSRF / URL fetching

* **SEC-SSRF-01:** NEVER fetch a user-supplied URL without: `http/https` scheme allowlist, no `userinfo`, DNS-resolve + private-IP deny (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`).
* **Current posture (safe, keep it):** `news/route.ts` fetches only hardcoded allowlisted feeds + category allowlist, 10s timeout, 2MB cap, 30/min/IP; `nvidia.ts` fixed endpoint; `uropay.ts` hardcoded `https://api.uropai.in` + `encodeURIComponent(orderId)`; checkout URLs validated by `assertSafeCheckoutUrl` (`https:` + `UROPAY_ALLOWED_HOSTS`).
* **If link-preview/image-proxy is ever added**, SEC-SSRF-01 becomes mandatory — add the IP-block check before shipping.

---

## 13. Files, uploads & generated documents

* **SEC-FILE-01:** No user file uploads exist today (verified: no `formData/multer/busboy`). If added: validate magic bytes (not extension), rename to UUID server-side, store off-origin (S3/R2/GCS), never execute.
* **SEC-FILE-02:** Server-generated JSON (`lib/server/chat-storage.ts`) MUST gate on `UUID_PATTERN`, fixed `chatPath()=uid/chatId.json`, `application/json`, private bucket.
* **SEC-FILE-03:** Generated PDFs (`certificate/route.ts`) MUST strip non-printable chars (`safePdfText`), derive filename from allowlisted `slug`, set `Content-Disposition` safely — no header injection.

---

## 14. XML parsing

* **SEC-XML-01:** `XMLParser` MUST set `processEntities:false` (set in `news/route.ts:42-46`) — `fast-xml-parser` does not fetch external DTD (no classic XXE) but entity expansion is a DoS vector. Keep the 2MB cap + 10s timeout.
* **SEC-XML-02:** NEVER build `RegExp` from user input (dead `extractTag` removed for this reason).

---

## 15. Security headers, cookies & transport

* **SEC-HDR-01:** Global headers (`next.config.ts`): `nosniff`, `DENY`, `strict-origin-when-cross-origin`, `HSTS preload`, `COOP/CORP same-origin`, `poweredByHeader:false`, `productionBrowserSourceMaps:false`.
* **SEC-HDR-02:** Per-request CSP with nonce (`proxy.ts:4-20,57-64`): `default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `script-src 'self' 'nonce-…'`, `upgrade-insecure-requests`. Static fallback in `next.config.ts` covers matcher-excluded static paths.
* **SEC-HDR-03:** `Cache-Control: private, no-store` + `Vary: Authorization, Cookie` on `/api/*` (except public cacheable `/api/news`).
* **SEC-HDR-04:** Production HTTP → 308 HTTPS redirect (`proxy.ts:40-48`).
* **SEC-CKY-01:** Session cookies MUST be `httpOnly:true, secure:true(prod), sameSite:'lax'` minimum. Admin uses `Strict`; referral uses `Lax`. Supabase auth cookies are intentionally NOT `HttpOnly` (required by `@supabase/ssr` browser client) — accepted deviation, compensated by CSP + zero sinks.
* **No `helmet` package needed** — Next.js `headers()` is the equivalent.

---

## 16. CORS & CSRF

* **SEC-CORS-01:** NEVER `origin:'*'`. No wildcard CORS exists in tree (only doc mentions). Default same-origin.
* **SEC-CORS-02:** NEVER combine `origin:'*'` with `credentials:true`.
* **SEC-CSRF-01:** State-changing methods MUST pass the same-origin check (`proxy.ts:50-55`, 403 `csrf_origin_mismatch`). Missing `Origin` is allowed (curl/server-to-server); admin cookie CSRF is covered by `SameSite=Strict`.
* **Verification:** `grep -rn "Access-Control-Allow-Origin\|origin.*\*\|credentials.*true" app lib proxy.ts next.config.ts` must show no wildcard grant.

---

## 17. Rate limiting

Implementation: DB-backed `rpc(rate_limit_check)` + `getClientIp` (prefers `x-vercel-forwarded-for`/`x-real-ip`, else LAST `XFF` — never the spoofable head). In-memory `Map` is dev fallback only.

| Endpoint | Bucket | Limit |
|---|---|---|
| `auth/signin` | `login:{ip}` | 8/min |
| `auth/signup` | `signup:{ip}` | 5/10min (+honeypot) |
| `auth/reset-request`, `reset-password` | per-IP | 5/10min |
| `c8f2x9/login` | `admin-login:{ip}` | 5/min |
| `ai/research` | per-user + per-IP + daily ledger | 12/min/user, 30/min/IP, caps `AI_DAILY_REQUEST_CAP=60` / `AI_DAILY_TOKEN_CAP=300000` |
| `payments/create-order` | user + IP | 10/5min |
| `payments/status` | user | throttled |
| `news` | `news:{ip}` | 30/min |
| `referrals/capture` | `referral-capture:{ip}` | 30/min |
| `webhooks/uropay` | `webhook-uropay:{ip}` | 60/min (added Sep 2026) |
| `partner/applications` | IP + email-hash | 5/hr IP, 2/day email |
| `progress/checkpoint`, `certificate` | user | dual buckets / 10/min |

* **SEC-RL-01:** Login/register/reset/password/admin/AI/payment/webhook/partner/news endpoints MUST have limits. Read-only authed lists SHOULD have light buckets where enumeration matters.
* **SEC-RL-02:** NEVER trust `X-Forwarded-For` head for limiting. NEVER trust it for auth decisions.
* **SEC-RL-03:** Production MUST rely on the shared Supabase table (survives serverless churn); treat memory fallback as dev-only and alert if it engages in prod.

---

## 18. Payments (UroPay) — webhook & lifecycle

* **SEC-PAY-01:** Webhook MUST verify HMAC-SHA256 over the raw body with `timingSafeEqual`, require `x-timestamp/x-nonce/x-signature`, enforce a 5-min replay window, fail closed when the secret is missing. Reject → 401. (`lib/payments/uropay.ts:155-257`, `route.ts:78-87`.)
* **SEC-PAY-02:** Idempotency MUST be atomic: insert `webhook_events(event_id PK)` first; `23505` → `already_processed`; delete the claim on exception; guard payment writes with `.eq("status","pending")`; entitlements via `grant_entitlement_atomic` same-payment guard.
* **SEC-PAY-03:** NEVER trust webhook amounts/status. MUST cross-check via authoritative `getOrderStatus`, verify order-ID, environment, and `amount` equality; mismatch → 409, unknown → 502.
* **SEC-PAY-04:** Handle the FULL lifecycle: `paid` (grant + commission + recovery when paid-but-entitlement-missing), `failed`/`expired` (record, no grant). Unknown statuses → 502.
* **SEC-PAY-05:** Checkout URLs MUST pass `assertSafeCheckoutUrl` (`https:` + `UROPAY_ALLOWED_HOSTS`). No blind redirects.
* **SEC-PAY-06:** `GET` on webhook MUST return 405 + `Allow: POST`. Never log raw bodies/signatures.
* **Note:** Stripe-style `subscription.*` events are N/A — UroPay is one-time `paid/failed/expired`.

---

## 19. Errors, logging & privacy

* **SEC-ERR-01:** Production API errors MUST be generic (`{"error":"Something went wrong"}` / controlled `{error,code}`). NEVER leak stack traces, SQL errors, file paths, or library names. Central `jsonError` (`lib/api.ts:14-27`) + generic `app/error.tsx`.
* **SEC-ERR-02:** Full error details go to server logs only. Auth failures MUST NOT distinguish "email not found" vs "wrong password" beyond what is unavoidable; signup MUST NOT echo provider text.
* **SEC-ERR-03:** Debug/dev error pages MUST be off in production (`productionBrowserSourceMaps:false`).
* **SEC-LOG-01:** Logs MUST NOT contain secrets, raw bodies, tokens, or full PII. NVIDIA redaction is mandatory. Webhook logs print hostnames/statuses, never keys.
* **Verification:** `grep -rn "stack\|sql\|\\.db\|node_modules" app/api --include="*.ts" | grep -i "Response.json\|return.*json"` must show no leakage paths.

---

## 20. Dependencies & supply chain

* **SEC-DEP-01:** Verify a package exists on the official registry with history before installing.
* **SEC-DEP-02:** Pin EXACT versions (no `^`/`~`). `packageManager: pnpm@11.19.0`. Commit `pnpm-lock.yaml`.
* **SEC-DEP-03:** NEVER commit with a stale lockfile — Vercel builds with `--frozen-lockfile` and FAILS the deploy (learned Sep 2026: `next` bump without lockfile broke the build). Always `pnpm install` (or `--lockfile-only`) after touching `package.json`.
* **SEC-DEP-04:** Triage Dependabot alerts promptly. Known case: `next 16.3.5` RCE (GHSA-vcvr-r3jv-pc5j) → fixed at `16.3.6`. `fast-xml-parser 5.11.0` is NOT affected by CVE-2026-73569 (<5.10.1).
* **SEC-DEP-05:** Prefer Excel-2007-era formula functions in any spreadsheet logic; LibreOffice-evaluable only (project-specific guard from `xlsx` skill, kept for completeness).
* **Verification:** `pnpm audit`, `node scripts/scan-secrets.mjs`, `pnpm typecheck`, `pnpm lint`.

---

## 21. CI gates (must stay green)

`.github/workflows/security.yml` runs on push/PR to `main`: checkout (full history) → `corepack enable` → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test` (= contract check + secret scan).

```bash
pnpm typecheck
pnpm test            # security-contract-check.mjs + scan-secrets.mjs
pnpm lint
node scripts/scan-secrets.mjs   # targeted re-run
```

* **SEC-CI-01:** NEVER weaken a gate to make CI pass. If `security-contract-check` fails, fix the code, not the assertion.
* **SEC-CI-02:** The secret scanner covers tracked files + post-baseline history. It does NOT absolve old history — see §22.

---

## 22. Vercel deployment checklist

- [ ] `pnpm-lock.yaml` in sync with `package.json` (else `--frozen-lockfile` fails the build).
- [ ] Env set in Vercel (not in repo): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `NVIDIA_API_KEY`, `NVIDIA_KIMI_MODEL`, `NVIDIA_RESEARCH_MODEL`, `ADMIN_SESSION_SECRET` (≥32 chars), `ADMIN_REQUIRE_MFA=true`, `UROPAY_API_KEY/SECRET/WEBHOOK_SECRET/ENVIRONMENT/ALLOWED_HOSTS`, `NEXT_PUBLIC_SITE_URL` (prod origin).
- [ ] `ADMIN_REQUIRE_MFA` is `true`; `ADMIN_OWNER_UIDS` set for multi-admin setups.
- [ ] Supabase Auth → Google provider enabled with matching client ID/secret.
- [ ] Migrations applied in order; RLS verification queries in §8 pass on prod.
- [ ] `pnpm test` + `pnpm typecheck` green; Dependabot alerts triaged.

---

## 23. Git history & incident lessons

* **Lesson 2026-09 (committed `.env.local` with real Supabase keys, since deleted):** keys live forever in history. ACTION: rotate `SUPABASE_SECRET_KEY`, verify old key dead, purge with BFG/`filter-repo` + force-push with team coordination.
* **Lesson 2026-09 (hardcoded `ADMIN_PASSWORD` fallbacks + passwords in commit messages):** remediated in tree (only detector patterns remain). ACTION: never reuse either password; purge history.
* **Lesson 2026-09 (NVIDIA key pasted in chat, noted `SETUP.md:131`):** ACTION: rotate `NVIDIA_API_KEY`, delete chat copy.
* **Lesson 2026-09 (Next 16.3.5 RCE + stale lockfile breaking Vercel):** ACTION done in tree (`16.3.6` + lockfile). Keep Dependabot triage in §20.
* **SEC-HIST-01:** `scripts/scan-secrets.mjs` baseline covers recent history only — a green scan does NOT mean old history is clean. Treat pre-baseline secrets as compromised until rotated + purged.

---

## 24. Incident response playbook

1. **Contain:** revoke/rotate the exposed credential FIRST (Supabase dashboard, NVIDIA, UroPay, `ADMIN_SESSION_SECRET`), bump `session_version` to kill admin sessions.
2. **Assess:** `git log -S '<secret>'`, Vercel + Supabase logs for anomalous use (new admins, grants, payouts, AI spend spikes).
3. **Eradicate:** purge history (BFG/`filter-repo`), force-push with team coordination, delete chat/doc copies.
4. **Recover:** re-deploy, re-run §8 RLS queries + §21 gates, monitor 48h.
5. **Learn:** add a regression assertion to `scripts/security-contract-check.mjs` + a row here in §27.

---

## 25. PR checklist (paste into every PR touching app/lib/supabase)

- [ ] Auth gate first in handler (`requireUser`/`requireAdmin`), 401 on anonymous (SEC-AUTH-01/02)
- [ ] Ownership scoping on every ID lookup (SEC-API-01)
- [ ] Server-side zod validation; no client-only checks (SEC-IN-01)
- [ ] No `dangerouslySetInnerHTML`/raw SQL/user-URL fetch added (SEC-XSS-01, SEC-SQL-01, SEC-SSRF-01)
- [ ] Rate limit present or N/A justified (SEC-RL-01)
- [ ] No secrets/PII in code, logs, or responses (SEC-ENV-01..05, SEC-ERR-01)
- [ ] RLS/migration implications reviewed; verification queries pass (SEC-DB-01..04)
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` green; lockfile in sync (SEC-CI-01, SEC-DEP-03)

---

## 26. Per-area deep checklists

### API route authoring

- [ ] `export const runtime = "nodejs"` where Node APIs/crypto are used.
- [ ] `parseJson` cap respected; `safeParse` (not `parse`) except where a throw is intentionally mapped.
- [ ] Errors via `ApiError` + `jsonError`; no `error.message` from providers to clients.
- [ ] `Cache-Control: private, no-store` on non-GET or sensitive GETs.
- [ ] New public endpoint? Add rate limit + document the bucket in §17.

### Supabase migration authoring

- [ ] `ENABLE ROW LEVEL SECURITY` on new tables; explicit `SELECT`-own or no-policy (service-only) with a comment saying which.
- [ ] `REVOKE … FROM anon, authenticated` where clients must have zero grants.
- [ ] Functions: `SECURITY DEFINER SET search_path`, minimal grants, advisory locks for money paths.
- [ ] Backfill legacy rows where a new `NOT NULL`/verified column changes semantics.

### Admin feature authoring

- [ ] `requireAdmin` minimum; `requireAdminOwner` for grants/money/partners/reconcile.
- [ ] Audit log write; self-revoke blocked; PII masked for non-owners.
- [ ] MFA path untouched; no `ADMIN_REQUIRE_MFA=false` outside emergency.

### AI feature authoring

- [ ] Server-only provider key, fixed endpoint, `redactProviderMessage` on errors.
- [ ] `assertPaidAccess` + per-user/IP limit + daily ledger check before spend.
- [ ] Output rendered only via sanitized `Streamdown` path.

---

## 27. Audit log

| Date | Scope | Result |
|---|---|---|
| 2026-09-29 | Full-tree audit (36 routes, lib, RLS, headers, payments) | 2 Critical (historical secrets), 1 High (Next RCE), Medium/Low gaps — see report in chat |
| 2026-09-29 | Urgent fixes `a8fee17` | Next 16.3.6, generic signup error, `.gitignore` bare-env, webhook 60/min throttle, XML `processEntities:false`, strict referral regex, static CSP fallback |
| 2026-09-29 | Lockfile fix `27d3935` | `pnpm-lock.yaml` synced to 16.3.6; Vercel `--frozen-lockfile` unblocked |
| 2026-09-29 | This file created | Codifies all of the above as durable checks |
| 2026-09-29 | Contract checks 115 → 129 | 14 new executable asserts: Next ≥16.3.6, eslint-config match, js-yaml override + lockfile pin, lockfile/manifest sync, webhook throttle, XML `processEntities`, dead helper removal, referral normalization, generic signup error, static CSP fallback, bare `.env.*` gitignore |
| 2026-09-29 | SAST triage (25 findings) | 4 fixed: client UUID gate on admin id interpolation (`components/referral-admin-panel.tsx`), repo-root containment in `security-contract-check.mjs`/`scan-secrets.mjs`/`release.mjs`. Rest are scanner false positives, see §28. `new RegExp` finding already gone ( feed parser uses literal regexes). |

---

## 28. External SAST triage log (false-positive dispositions)

Naive scanners flag identifier substrings and dialect-specific SQL. Do not
"fix" these by renaming — each was verified by reading the code:

* `pnpm-lock.yaml` "hardcoded tokens" (`js-tokens`, `comma-separated-tokens`,
  `space-separated-tokens`) — npm package names, not credentials.
* `dashboard_token` / `dashboard_token_expires_at` — DB column names; the
  stored value is always `hashDashboardToken(...)`, never the raw bearer.
* `total_tokens`, `p_tokens`, `max_tokens` — AI usage counters, not secrets.
* `access_token` / `refresh_token` in `components/auth-provider.tsx` —
  Supabase session field names, never hardcoded values.
* `supabase/schema.sql` + `supabase/migrations/*` SQL "compatibility" findings
  (`RETURN`, `$$`, `$`, `SET QUOTED_IDENTIFIER`) — the scanner parsed
  PostgreSQL/plpgsql as T-SQL/ANSI. The files deploy via Supabase; do not
  "fix" valid plpgsql to satisfy a wrong dialect.
* `apply-patch-fixes.ps1` `$matches` — PowerShell automatic variable.
* `lifecycle-pages.tsx` "object injection" — static-literal lookup keyed by a
  string-union type; no dynamic property access.
* `fetch(/api/.../${id})` in admin components — same-origin relative URLs
  (not SSRF); every id is UUID-gated client-side (`adminResourcePath`) and
  `z.string().uuid()` server-side.

---

## Appendix A — One-command verification suite

```bash
pnpm typecheck && pnpm test && pnpm lint
git ls-files | grep -E "^\.env"          # expect: .env.example only
grep -rn "ADMIN_PASSWORD" app lib | grep -v scripts/   # expect: empty
grep -rn "dangerouslySetInnerHTML" app components lib  # expect: empty
grep -rn "origin.*\*.*credentials\|Access-Control-Allow-Origin.*\*" app lib proxy.ts next.config.ts  # expect: empty
```

## Appendix B — File map (where each control lives)

* Edge: `proxy.ts` (CSP nonce, CSRF, HTTPS, cache) · `next.config.ts` (headers + static CSP fallback)
* Auth: `lib/supabase/auth.ts` · `lib/server/auth.ts` · `lib/supabase/server.ts` · `lib/supabase/proxy.ts` · `lib/server/admin-auth.ts`
* Guardrails: `lib/api.ts` (errors + body cap) · `lib/server/rate-limit.ts` (limits + IP) · `lib/server/ai-usage.ts` (daily caps)
* Money: `lib/payments/uropay.ts` · `app/api/webhooks/uropay/route.ts` · `lib/server/entitlements.ts` · `lib/server/payment-reconciliation.ts` · `lib/referrals.ts`
* AI: `lib/ai/nvidia.ts` · `lib/ai/router.ts` · `app/api/ai/research/route.ts`
* Data: `supabase/schema.sql` · `supabase/migrations/*` · `lib/server/chat-storage.ts` · `lib/server/course-progress.ts`
* Gates: `scripts/security-contract-check.mjs` · `scripts/scan-secrets.mjs` · `.github/workflows/security.yml`
