-- MUN Prep App - Supabase Database Schema
-- Run this in the Supabase SQL editor to set up tables and RLS policies.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Users (mirrors Supabase auth.users for app-specific data)
CREATE TABLE IF NOT EXISTS public.users (
  uid         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT '',
  email        TEXT DEFAULT '',
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Delegate profiles
CREATE TABLE IF NOT EXISTS public.delegate_profiles (
  uid              UUID PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
  school           TEXT DEFAULT '',
  grade            TEXT DEFAULT '',
  experience_level TEXT DEFAULT 'intermediate',
  country          TEXT DEFAULT '',
  committee        TEXT DEFAULT '',
  agenda           TEXT DEFAULT '',
  conference_date  TEXT DEFAULT '',
  goals            TEXT DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Entitlements (paid access, server-write-only for mutations)
CREATE TABLE IF NOT EXISTS public.entitlements (
  uid                UUID PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
  status             TEXT DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'expired')),
  plan_id            TEXT,
  source             TEXT,
  latest_payment_id  TEXT,
  latest_order_id    TEXT,
  starts_at          TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- AI generations
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid           UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  tool          TEXT,
  provider      TEXT,
  model         TEXT,
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  output        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Research notes
CREATE TABLE IF NOT EXISTS public.research_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  committee   TEXT,
  agenda      TEXT,
  country     TEXT,
  title       TEXT,
  body        TEXT,
  tags        TEXT[],
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users (password-protected admin access, bypasses paywall)
CREATE TABLE IF NOT EXISTS public.admin_users (
  uid         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by TEXT DEFAULT 'system'
);

-- Webhook events (idempotency tracking for UroPay)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id            TEXT PRIMARY KEY,
  event               TEXT,
  status              TEXT NOT NULL DEFAULT 'received',
  order_ref           TEXT,
  uropay_order_id     TEXT,
  received_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegate_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events     ENABLE ROW LEVEL SECURITY;

-- Users: owner can read, insert, update (no delete)
CREATE POLICY "users_select_own"  ON public.users FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "users_insert_own"  ON public.users FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "users_update_own"  ON public.users FOR UPDATE USING (auth.uid() = uid);

-- Delegate profiles: owner can read, insert, update
CREATE POLICY "delegate_profiles_select_own" ON public.delegate_profiles FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "delegate_profiles_insert_own" ON public.delegate_profiles FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "delegate_profiles_update_own" ON public.delegate_profiles FOR UPDATE USING (auth.uid() = uid);

-- Entitlements: owner can read only (writes are server-side via service role)
CREATE POLICY "entitlements_select_own" ON public.entitlements FOR SELECT USING (auth.uid() = uid);

-- Payments: owner can read only
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (auth.uid() = uid);

-- AI generations: owner can read only
CREATE POLICY "ai_generations_select_own" ON public.ai_generations FOR SELECT USING (auth.uid() = uid);

-- Research notes: full CRUD for owner
CREATE POLICY "research_notes_select_own" ON public.research_notes FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "research_notes_insert_own" ON public.research_notes FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "research_notes_update_own" ON public.research_notes FOR UPDATE USING (auth.uid() = uid);
CREATE POLICY "research_notes_delete_own" ON public.research_notes FOR DELETE USING (auth.uid() = uid);

-- Admin users: no direct user access (service role only)

-- Webhook events: no direct user access (service role only, so no policies needed)

-- ============================================================
-- 3. HELPER: auto-create user row on signup (Supabase trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (uid, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (uid) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Course progress (tracks lesson completion and quiz scores)
CREATE TABLE IF NOT EXISTS public.course_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  completed_lessons INTEGER[] DEFAULT '{}',
  quiz_score INTEGER DEFAULT 0,
  quiz_total INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(uid, course_slug)
);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course_progress_select_own" ON public.course_progress FOR SELECT USING (auth.uid() = uid);
CREATE POLICY "course_progress_insert_own" ON public.course_progress FOR INSERT WITH CHECK (auth.uid() = uid);
CREATE POLICY "course_progress_update_own" ON public.course_progress FOR UPDATE USING (auth.uid() = uid);

-- Course analytics (certificate download events; server-side only)
CREATE TABLE IF NOT EXISTS public.certificate_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uid UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_slug TEXT NOT NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS certificate_downloads_course_idx
  ON public.certificate_downloads (course_slug, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS certificate_downloads_uid_idx
  ON public.certificate_downloads (uid, downloaded_at DESC);

ALTER TABLE public.certificate_downloads ENABLE ROW LEVEL SECURITY;
-- No client policies: inserts and aggregate reads are server-side only.

-- ============================================================
-- PAYMENTS TABLE (UroPay integration)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uid             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_ref       TEXT UNIQUE NOT NULL,
  uropay_order_id TEXT,
  plan_id         TEXT NOT NULL,
  amount          INTEGER NOT NULL CHECK (amount > 0),
  status          TEXT NOT NULL DEFAULT 'pending',
  amount_captured NUMERIC,
  commission      NUMERIC,
  transaction_fee NUMERIC,
  tax             NUMERIC,
  net_amount      NUMERIC,
  currency        TEXT NOT NULL DEFAULT 'INR',
  environment     TEXT NOT NULL DEFAULT 'production',
  event_id        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
DROP POLICY IF EXISTS "payments_update_service" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (auth.uid() = uid);


-- ============================================================
-- REFERRAL PARTNERS, ATTRIBUTION, AND COMMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 16.72 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  referred_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'converted', 'cancelled')),
  first_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  first_order_id TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_uid)
);

CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  order_id TEXT,
  plan_id TEXT NOT NULL,
  payment_amount NUMERIC(10,2) NOT NULL CHECK (payment_amount >= 0),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 16.72 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount NUMERIC(10,2) NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id)
);

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
-- No client policies: all referral operations use authenticated server routes.

CREATE INDEX IF NOT EXISTS referral_partners_code_idx ON public.referral_partners (referral_code);
CREATE INDEX IF NOT EXISTS referrals_partner_idx ON public.referrals (partner_id);
CREATE INDEX IF NOT EXISTS referrals_user_idx ON public.referrals (referred_uid);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON public.referrals (status);
CREATE INDEX IF NOT EXISTS referral_commissions_partner_idx ON public.referral_commissions (partner_id);
CREATE INDEX IF NOT EXISTS referral_commissions_status_idx ON public.referral_commissions (status);
CREATE UNIQUE INDEX IF NOT EXISTS referral_commissions_payment_uidx ON public.referral_commissions (payment_id) WHERE payment_id IS NOT NULL;
