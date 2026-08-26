# MUN Prep App setup

MUN Prep is a Next.js application using **Supabase Auth/Postgres/Storage**, **UroPay**, and server-only AI provider routes. The frontend never calls NVIDIA or OpenRouter directly, and no provider or payment secret belongs in browser-exposed variables.

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

Copy `.env.example` to `.env.local` and fill values locally. Never commit `.env.local`, service-role keys, provider keys, payment secrets, admin passwords, or webhook secrets.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=
SUPABASE_JWKS_URL=https://YOUR_PROJECT.supabase.co/auth/v1/.well-known/jwks.json

OPENROUTER_API_KEY=
OPENROUTER_GLM_MODEL=
NVIDIA_API_KEY=
NVIDIA_MINIMAX_MODEL=minimaxai/minimax-m3

ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=

UROPAY_API_KEY=
UROPAY_API_SECRET=
UROPAY_WEBHOOK_SECRET=
UROPAY_ENVIRONMENT=test

NEXT_PUBLIC_SITE_URL=http://localhost:3000
PAYMENT_RECONCILIATION_SECRET=
```

`ADMIN_SESSION_SECRET` should be a random value of at least 32 characters. If it is omitted, the server-only Supabase secret is used to sign administrator sessions, but a separate secret is preferred. Admin provisioning is deliberate: the application no longer creates a default administrator or accepts a fallback password.

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

Run migrations through the Supabase SQL editor or the Supabase CLI connected to the correct project. Verify tables, columns, indexes, RLS policies, and the bucket before enabling real payments.

## UroPay

Configure the provider webhook to point to:

```text
https://mun-ai-app.vercel.app/api/webhooks/uropay
```

The webhook verifies the provider signature, replay window, order identity, environment, authoritative status, amount, and atomic event claim before granting entitlement. Do not treat a browser return URL as payment proof. Payment access is granted only after server-side verification.

## AI providers

Set the provider keys only as server-side Vercel/environment variables. The application fails closed when a provider key is absent; it does not contain fallback credentials. AI requests are bounded by server-side input length, temperature, output-token, rate, and timeout limits.

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

A commission is created only after the UroPay webhook verifies the order, payment status, amount, and event idempotency, marks the payment successful, and grants Premium. The server converts verified paise to rupees and calculates the commission from the partner’s stored rate. Failed, pending, duplicate, or browser success-page requests do not create commissions. The administrator referral dashboard can mark an unpaid record as paid; this changes only the ledger status and `paid_at`, and performs no bank or automatic payout.

Before live use, test an active referral URL, first-touch behavior with two codes, a suspended partner, a self-referral, a successful weekly payment, a successful monthly payment, a failed/pending payment, duplicate webhook delivery, a non-referred purchase, and manual settlement. Referral tables must be present before testing; if they are absent, normal homepage and payment flows continue without referral attribution, while the server logs the unavailable referral lookup.


## Google OAuth callback

Google sign-in uses the existing Supabase browser client to start OAuth and the server-side Supabase SSR client at `/auth/callback` to exchange the authorization code and write the normal Supabase session cookies. The callback accepts only a same-origin `next` destination, handles provider errors generically, and never logs authorization codes, access tokens, refresh tokens, client secrets, or service keys.

For production, Supabase Authentication → URL Configuration must use `https://mun-ai-app.vercel.app` as the site URL and include `https://mun-ai-app.vercel.app/auth/callback` as a redirect URL. The Google Cloud OAuth client used by Supabase must authorize the Supabase callback URL `https://<actual-project-ref>.supabase.co/auth/v1/callback`; do not substitute the Vercel callback URL in Google Cloud. The exact project reference must be taken from the production Supabase project rather than guessed.

Supabase Authentication → Providers → Google must be enabled with the matching Google client ID and secret. Vercel must provide the variables actually referenced by this repository, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, plus the server-only `SUPABASE_SECRET_KEY`. Never add the service key or Google client secret to a `NEXT_PUBLIC_*` variable.


## Daily AI token allowance

The application enforces a server-side allowance of 100,000 AI tokens per authenticated Supabase user per UTC calendar day. Apply `supabase/migrations/20260826_ai_usage_daily.sql` after the core data-contract migrations. The migration creates `ai_usage_daily` plus a UUID-keyed `ai_usage_reservations` ledger, denies direct browser access, and installs atomic `reserve_ai_tokens`, `reconcile_ai_tokens`, and `release_ai_tokens` RPCs callable only by `service_role`. Reservation settlement is terminal-state protected, so duplicate stream finalizers cannot double-charge or release another request's reservation.

The daily period is identified by `(uid, usage_date)` where `usage_date` is calculated in UTC. The next day therefore starts with a new row and zero usage; no cron job, nightly reset, logout, SQL reset, or manual admin action is required. The optional server-only `AI_DAILY_TOKEN_LIMIT` variable may override the default, but it is bounded and must never be exposed as a `NEXT_PUBLIC_` variable. The authenticated `/api/me/ai-usage` endpoint supplies the frontend display values.

Before production activation, verify that two concurrent AI requests cannot reserve more than the remaining allowance, that rejected requests return HTTP 429 with `daily_token_limit_reached`, that provider usage metadata is captured when available, that failed/empty streams release unused reservations, that client cancellation settles the reservation, that duplicate settlement is a no-op, and that a new UTC date produces a fresh allowance. When a provider does not return usage metadata, the server conservatively settles the full pre-reserved upper bound rather than undercounting. The administrator dashboard includes a read-only AI Usage view once the usage table and existing `users` table are available.
