-- Course analytics: one row per certificate download event.
-- Apply this migration in Supabase before using the admin analytics dashboard.
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
