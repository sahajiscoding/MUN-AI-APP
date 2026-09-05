# MUN Prep App setup

MUN Prep is a Next.js application using **Supabase Auth/Postgres/Storage**, **UroPay**, and server-only AI provider routes. The frontend never calls NVIDIA or GMI Cloud directly, and no provider or payment secret belongs in browser-exposed variables.

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
GMI_CLOUD_API_KEY=
GMI_CLOUD_BASE_URL=https://api.gmi-serving.com
GMI_MINIMAX_MODEL=MiniMaxAI/MiniMax-M3

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

Run migrations through the Supabase SQL editor or the Supabase CLI connected to the correct project. Verify tables, columns, indexes, RLS policies, and the bucket before enabling real payments. The newer `20260827_security_hardening.sql` migration is also required before deploying the payment webhook changes: it installs the service-role-only atomic entitlement and referral-commission functions. The existing unique payment constraint blocks duplicate delivery of one payment, while the locked referral status prevents a second first-purchase commission for the same customer. After running it, use Supabase’s schema-cache reload or wait for the cache to refresh before testing.

## UroPay

Configure the provider webhook to point to:

```text
https://mun-ai-app.vercel.app/api/webhooks/uropay
```

The webhook verifies the provider signature, replay window, order identity, environment, authoritative status, amount, and atomic event claim before granting entitlement. Do not treat a browser return URL as payment proof. Payment access is granted only after server-side verification.

## AI providers

Set the provider keys only as server-side Vercel Environment Variables. Add `NVIDIA_API_KEY` for Max and `GMI_CLOUD_API_KEY` for Quick/Thorough; use the model and base-URL variables shown in `.env.example`. The application fails closed when a required provider key is absent and contains no fallback credentials. Do not paste paid keys into GitHub, source files, `.env.example`, Supabase, browser code, chat prompts, screenshots, or logs. AI requests are bounded by server-side input length, temperature, output-token, rate, and timeout limits.

## Pre-deployment checklist

Before a production release, run the lint, typecheck, build, and frozen-lockfile checks. Apply and verify Supabase migrations first. Confirm that `/api/chats`, `/api/progress`, `/api/me/entitlement`, `/api/payments/status`, and administrator endpoints return `401` without credentials. With a dedicated test account, generate a response, list Recent chats, open the transcript, verify a non-owner cannot open it, and confirm the mobile composer remains above the fixed navigation. For payments, use UroPay test mode and replay the same webhook event to verify it is acknowledged without a duplicate entitlement grant.


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

AI requests are authenticated server-side and continue to use the existing paid-access and request-rate controls. **Max** uses NVIDIA’s `moonshotai/kimi-k3` through the server-only `NVIDIA_API_KEY`. **Thorough** and **Quick** use GMI Cloud’s Anthropic-compatible `/v1/messages` endpoint with `MiniMaxAI/MiniMax-M3` through the server-only `GMI_CLOUD_API_KEY`; Quick uses the smaller output budget and Thorough uses the larger one. Set `GMI_CLOUD_BASE_URL=https://api.gmi-serving.com` unless your GMI Cloud account provides a different base URL. Do not expose provider keys through any `NEXT_PUBLIC_*` variable. The NVIDIA key previously pasted into chat must be rotated before use.
