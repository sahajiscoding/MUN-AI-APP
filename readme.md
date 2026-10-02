# MUN Prep App setup

MUN Prep is a Next.js application using **Supabase Auth/Postgres/Storage**, **UroPay**, and server-only AI provider routes. The frontend never calls NVIDIA directly, and no provider or payment secret belongs in browser-exposed variables.

## Local runtime

```bash
pnpm install --frozen-lockfile
pnpm dev
```

For CI and Vercel, use the frozen lockfile so dependency versions cannot change silently:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
```

## Environment variables

For local development, copy `.env.example` to `.env.local` only if you intentionally need local provider access; keep that file untracked and delete paid keys when finished. For production, add paid provider secrets manually in **Vercel → Project Settings → Environment Variables**. Never commit `.env.local`, service-role keys, provider keys, payment secrets, admin passwords, or webhook secrets. The repository and `.env.example` contain variable names only, never credential values.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=https://YOUR_PROJECT.supabase.co/auth/v1/.well-known/jwks.json

NVIDIA_API_KEY=
NVIDIA_KIMI_MODEL=moonshotai/kimi-k3
NVIDIA_RESEARCH_MODEL=z-ai/glm-5.3-flash

ADMIN_SESSION_SECRET=
ADMIN_OWNER_UIDS=

AI_DAILY_REQUEST_CAP=60
AI_DAILY_TOKEN_CAP=300000

UROPAY_API_KEY=
UROPAY_API_SECRET=
UROPAY_WEBHOOK_SECRET=
UROPAY_ENVIRONMENT=test

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`ADMIN_SESSION_SECRET` should be a random value of at least 32 characters. If it is omitted, the server-only Supabase secret is used to sign administrator sessions, but a separate secret is preferred. `ADMIN_OWNER_UIDS` is an optional comma-separated list of Supabase UIDs allowed to grant/revoke administrator access and settle commissions; when empty, the first approved administrator row is treated as the owner.

There is **no shared admin password**. Administrators sign in with their own Supabase account, and only accounts present in the `admin_users` table receive an admin session. A stranger who finds the admin URL still cannot escalate: they would need their account approved by the owner first, and account-granting is owner-only.

## Security

The full policy lives in [`SECURITY.md`](./SECURITY.md); the per-task non-negotiables live in [`AGENTS.md`](./AGENTS.md). Read both before changing any API route, migration, payment code, secret, or dependency. Summary of the enforced posture:

- **Secrets are server-only.** Provider, payment, and service-role keys are read from `process.env` in server code only (`app/api/*`, `lib/server/*`, `lib/payments/*`, `lib/ai/*`), lazily per request so rotation never needs a code change. Nothing secret goes in `NEXT_PUBLIC_*`, client components, logs, or chat.
- **Server logging is redacted.** Server code logs through `logger` from `@/lib/server/secure-logger`, which strips credential patterns, masks emails, truncates opaque IDs (UIDs, order/payment/event refs) to short prefixes, and caps line length. Never `console.log` UIDs, emails, tokens, webhook bodies, or raw error objects from server code; client code (`components/`, `lib/http.ts`) keeps plain `console` for metadata-only messages.
- **Auth first, ownership second.** Protected routes call `requireUser()`/`requireAdmin()` before any work (401 when anonymous); ID lookups additionally scope to the caller (anti-IDOR); owner-only mutations require `requireAdminOwner` (403 otherwise). Admin sessions are HttpOnly `SameSite=Strict` cookies that require the current session to have completed MFA (`aal2`), with live `session_version` + `revoked_at` revocation.
- **Money is verified, not trusted.** The UroPay webhook verifies HMAC-SHA256 with `timingSafeEqual`, a 5-minute replay window, and atomic event claims; amounts and statuses are cross-checked against the authoritative order API; entitlements and first-purchase commissions are granted by atomic database functions only.
- **Defense in depth.** RLS deny-by-default on every table, zod validation + 512KB body caps on input, per-endpoint rate limits, nonce CSP + CSRF origin checks + HTTPS enforcement at the edge (`proxy.ts`), generic production error responses, and pinned exact dependencies with a committed lockfile.

Verify with the automated gates (all must stay green; never weaken a gate to make CI pass):

```bash
corepack pnpm install --frozen-lockfile   # lockfile sync (SEC-DEP-03)
pnpm lint
pnpm typecheck
pnpm build
pnpm audit                                # full tree; must be clean
pnpm audit --prod                         # production tree; must be clean
```

The per-area security contracts are `.github/workflows/*.yml` checks (grep-based tripwires for auth, admin MFA/revocation, AI quota reservation, certificate integrity, payments, RLS, headers, etc.). Run the relevant workflow's `grep` lines locally against a change; there is no `pnpm test` runner in this repository.

## Supabase Auth

Enable Email/Password and, if desired, Google in **Authentication → Providers**. Configure the production site URL and the following redirect URLs in Supabase and Google OAuth settings:

```text
http://localhost:3000/auth/callback
https://mun-ai-app.vercel.app/auth/callback
```

The OAuth callback extracts the `code` query parameter and exchanges that code for a session. Email signup may require confirmation; the UI explicitly tells the user to check their email instead of redirecting them into a protected page without a session.

## Supabase database and Storage

Apply the canonical schema reference for a new project, then apply every migration in `supabase/migrations/` in order. The hardened data-contract migration creates or aligns:

- `ai_generations`, including the user/created-at index used by Recent chats;
- `entitlements`, including `starts_at`, expiry, and payment linkage columns;
- the single current UroPay `payments` shape;
- `webhook_events` for atomic provider-event idempotency; and
- the private `chat-history` Storage bucket with the exact `application/json` MIME allow-list.

The server writes transcript objects under `<uid>/<chat-id>.json`. Browser users never receive direct Storage access to another user’s folder. The application retains a Storage-backed listing fallback, but the database index should still be applied and monitored because it supports efficient pagination and recovery.

Run migrations through the Supabase SQL editor or the Supabase CLI connected to the correct project. Apply **all** migrations in `supabase/migrations/` in filename order before deploying code that depends on them (the 2026-10-01 set adds the per-payment entitlement ledger, admin revocation tombstones, AI quota reservations, and rate-limit retention). Verify tables, columns, indexes, RLS policies, and the bucket before enabling real payments. The newer `20260827_security_hardening.sql` migration is also required before deploying the payment webhook changes: it installs the service-role-only atomic entitlement and referral-commission functions. The existing unique payment constraint blocks duplicate delivery of one payment, while the locked referral status prevents a second first-purchase commission for the same customer. After running it, use Supabase’s schema-cache reload or wait for the cache to refresh before testing.

## UroPay

Configure the provider webhook to point to:

```text
https://mun-ai-app.vercel.app/api/webhooks/uropay
```

The webhook verifies the provider signature, replay window, order identity, environment, authoritative status, amount, and atomic event claim before granting entitlement. Do not treat a browser return URL as payment proof. Payment access is granted only after server-side verification.

## AI providers

Set the provider key only as a server-side Vercel Environment Variable. A single `NVIDIA_API_KEY` now serves every mode; use the model variables shown in `.env.example` to pin which NVIDIA model each mode uses. The application fails closed when a required provider key is absent and contains no fallback credentials. Do not paste paid keys into GitHub, source files, `.env.example`, Supabase, browser code, chat prompts, screenshots, or logs. AI requests are bounded by server-side input length, temperature, output-token, rate, and timeout limits.

## Pre-deployment checklist

Before a production release, run the lint, typecheck, build, and frozen-lockfile checks. Apply and verify Supabase migrations first. Confirm that `/api/chats`, `/api/progress`, `/api/me/entitlement`, `/api/payments/status`, and administrator endpoints return `401` without credentials. With a dedicated test account, generate a response, list Recent chats, open the transcript, verify a non-owner cannot open it, and confirm the mobile composer remains above the fixed navigation. For payments, use UroPay test mode and replay the same webhook event to verify it is acknowledged without a duplicate entitlement grant.

Security release gates (see [`SECURITY.md`](./SECURITY.md) §21–§22):

- `pnpm lint`, `pnpm typecheck`, and `pnpm build` are green; `pnpm audit` and `pnpm audit --prod` are clean; `pnpm-lock.yaml` is in sync with `package.json`. The per-area contract checks under `.github/workflows/` are grep-based tripwires, not runtime tests — no `pnpm test` script or `scripts/*.mjs` runners exist in this repository.
- RLS verification queries (§8) pass on production; migrations applied in order including `20260827_security_hardening.sql` and the 2026-10-01 hardening set (`20261001_payment_entitlement_grants.sql`, `20261001_admin_revocation_tombstones.sql`, `20261001_ai_usage_reservations.sql`, `20261001_rate_limit_retention.sql`).
- `ADMIN_SESSION_SECRET` is ≥32 random characters and distinct from `SUPABASE_SECRET_KEY`; every approved administrator has a verified TOTP factor, and the admin login path requires the session to have completed the MFA challenge (AAL2). `ADMIN_REQUIRE_MFA` is no longer used and can be deleted from Vercel.
- No secret was pasted into chat, docs, or commits during this release — if one was, rotate it first (Supabase, NVIDIA, UroPay, admin secret), verify the old value is dead, and purge it from history per the §24 playbook. A green secret scan covers tracked files and post-baseline history only; pre-baseline history is treated as compromised until rotated and purged.
- Server logs reviewed for PII/secrets: all server logging goes through `@/lib/server/secure-logger`; no `console.log` of UIDs, emails, tokens, or raw bodies remains in `app/api`, `lib/server`, `lib/payments`, or `lib/ai`.


## Referral partners and commissions

The referral system uses the existing Supabase Auth, `users`, `payments`, and `entitlements` records. Apply `supabase/migrations/20260826_referral_system.sql` after the hardened data-contract migration. It creates `referral_partners`, `referrals`, and `referral_commissions`, enables RLS, and intentionally creates no browser policies; referral attribution and commission settlement are performed by server-side routes only.

After applying the migration, create a partner from the administrator dashboard at `/admin/referrals`, or use a reviewed SQL insert such as:

```sql
insert into public.referral_partners
  (name, email, whatsapp, referral_code, status, commission_rate)
values
  ('Test Partner', 'your-email@gmail.com', '9999999999', 'MUNTEST01', 'active', 16.72);
```

The resulting referral URL is `https://mun-ai-app.vercel.app/MUNTEST01`. Active partner names are loaded from Supabase and displayed as “Referred by …”; the name is never trusted from the URL. The app stores only the normalized code in the secure, HttpOnly `mun_referral_code` cookie for 30 days. First-touch attribution is enforced by the unique customer UID constraint and is never overwritten by a later partner URL.

A commission is created only after the UroPay webhook verifies the order, payment status, amount, and event idempotency, marks the payment successful, and grants Premium. The server-side database function verifies the paid payment belongs to the referred customer and calculates the amount from the stored partner rate. Each referred customer can produce one first-purchase commission for that partner; the partner can therefore earn commissions from many different referred customers. Repeated delivery of the same webhook or later payments from an already-converted customer do not create another first-purchase commission. Failed, pending, duplicate, or browser success-page requests do not create commissions. The administrator referral dashboard can mark an unpaid record as paid; this changes only the ledger status and `paid_at`, and performs no bank or automatic payout.

Before live use, test an active referral URL, first-touch behavior with two codes, a suspended partner, a self-referral, successful payments from two different referred customers, a second payment from an already-converted customer, a failed/pending payment, duplicate webhook delivery, a non-referred purchase, and manual settlement. Referral tables and the security-hardening migration must be present before testing; if they are absent, payment webhook entitlement/commission processing will fail closed and the provider event will remain retryable until the migration is applied.

The payment-reconciliation endpoint is now protected by the existing verified administrator session at `/api/admin/reconcile-payments`; it no longer accepts a static `x-reconciliation-secret` header. Log in through the existing administrator flow before invoking it, and remove any old scheduler or Vercel environment variable that referenced `PAYMENT_RECONCILIATION_SECRET`.


## Google OAuth callback

Google sign-in uses the existing Supabase browser client to start OAuth and the server-side Supabase SSR client at `/auth/callback` to exchange the authorization code and write the normal Supabase session cookies. The callback accepts only a same-origin `next` destination, handles provider errors generically, and never logs authorization codes, access tokens, refresh tokens, client secrets, or service keys.

For production, Supabase Authentication → URL Configuration must use `https://mun-ai-app.vercel.app` as the site URL and include `https://mun-ai-app.vercel.app/auth/callback` as a redirect URL. The Google Cloud OAuth client used by Supabase must authorize the Supabase callback URL `https://<actual-project-ref>.supabase.co/auth/v1/callback`; do not substitute the Vercel callback URL in Google Cloud. The exact project reference must be taken from the production Supabase project rather than guessed.

Supabase Authentication → Providers → Google must be enabled with the matching Google client ID and secret. Vercel must provide the variables actually referenced by this repository, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus the server-only `SUPABASE_SECRET_KEY`. Never add the service key or Google client secret to a `NEXT_PUBLIC_*` variable.


## AI provider configuration

AI requests are authenticated server-side and continue to use the existing paid-access and request-rate controls. Every mode runs through NVIDIA NIM (`https://integrate.api.nvidia.com/v1/chat/completions`) using the server-only `NVIDIA_API_KEY`, and only the model differs: **Max** uses `moonshotai/kimi-k3` (`NVIDIA_KIMI_MODEL`), while **Thorough** and **Quick** use `z-ai/glm-5.3-flash` (`NVIDIA_RESEARCH_MODEL`), with Quick on the smaller output budget and Thorough on the larger one. There is deliberately no base-URL variable — the NVIDIA endpoint is fixed — and no second provider is configured, so an absent `NVIDIA_API_KEY` disables AI features instead of falling back to another vendor. Do not expose provider keys through any `NEXT_PUBLIC_*` variable. The NVIDIA key previously pasted into chat must be rotated before use.


## License

MUN Prep is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

Copyright (C) 2026 the MUN Prep contributors. See [LICENSE](./LICENSE) for the full text.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

Because this app is served over a network, section 13 applies: anyone who interacts with a deployed copy is entitled to the Corresponding Source. Keep this repository public and keep the deployed code matching the committed code. If you incorporate third-party AGPL code (for example `bible-strong-avatar-lab` packages or sources), preserve its copyright notices and document your modifications as section 5(a) requires.
