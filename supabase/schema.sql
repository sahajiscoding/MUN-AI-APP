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
  expires_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Payment orders
CREATE TABLE IF NOT EXISTS public.payment_orders (
  order_id           TEXT PRIMARY KEY,
  uid                UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  email              TEXT,
  plan_id            TEXT,
  amount             INTEGER,
  currency           TEXT DEFAULT 'INR',
  razorpay_order_id  TEXT,
  status             TEXT DEFAULT 'created',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  payment_id           TEXT PRIMARY KEY,
  uid                  UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  plan_id              TEXT,
  order_id             TEXT,
  razorpay_order_id    TEXT,
  razorpay_payment_id  TEXT,
  verified             BOOLEAN DEFAULT FALSE,
  source               TEXT,
  raw_event            TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- AI generations
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid           UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  tool          TEXT,
  provider      TEXT,
  model         TEXT,
  input_summary JSONB,
  output        TEXT,
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

-- Webhook events (idempotency tracking for Razorpay)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id            TEXT PRIMARY KEY,
  event               TEXT,
  status              TEXT,
  razorpay_order_id   TEXT,
  received_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegate_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders     ENABLE ROW LEVEL SECURITY;
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

-- Payment orders: owner can read only
CREATE POLICY "payment_orders_select_own" ON public.payment_orders FOR SELECT USING (auth.uid() = uid);

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
