# MUN Prep App Setup

This project is a Next.js app with Supabase Auth, PostgreSQL (via Supabase), Razorpay payment gates, and server-only AI provider routes.

## Local Runtime

```powershell
npx pnpm@11 install
npx pnpm@11 dev
```

## Supabase

The Supabase config is stored in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://omhnymwavnfdwhoutueo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

SUPABASE_URL=https://omhnymwavnfdwhoutueo.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://omhnymwavnfdwhoutueo.supabase.co/auth/v1/.well-known/jwks.json
```

### Supabase Auth Setup

In the Supabase dashboard:

1. **Authentication > Providers**: Enable Google and Email/Password providers.
2. **Authentication > URL Configuration**: Set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a Redirect URL.

### Supabase Database Setup

Run the SQL schema in the Supabase SQL Editor (Dashboard > SQL Editor):

```sql
-- Paste contents of supabase/schema.sql
```

This creates all tables with row-level security policies so users can only access their own data.

### Supabase Storage

A storage bucket has been created in the Supabase dashboard under Storage. Use it for file uploads, research documents, or generated exports.

## Firestore to Supabase Migration

The app previously used Firebase/Firestore. All Firebase dependencies have been removed and replaced with Supabase:

- **Auth**: Firebase Auth → Supabase Auth (email/password + Google OAuth redirect)
- **Database**: Firestore → Supabase PostgreSQL with RLS
- **Admin SDK**: Firebase Admin → Supabase service role client (`supabaseAdmin`)
- **JWT Verification**: Firebase Admin `verifyIdToken` → `jose` library with JWKS

### Old Firebase Files Removed

- `lib/firebase/client.ts`
- `lib/firebase/admin.ts`
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`

## Razorpay

Add these server-side values:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Configure the webhook URL after deployment:

```text
https://your-domain.com/api/webhooks/razorpay
```

The app grants access only after server-side signature verification or a verified webhook.

## AI Providers

Add rotated server-side keys:

```env
OPENROUTER_API_KEY=
OPENROUTER_GLM_MODEL=
NVIDIA_API_KEY=
NVIDIA_MINIMAX_MODEL=minimaxai/minimax-m3
```

The frontend never calls OpenRouter or NVIDIA directly.
