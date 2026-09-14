-- Course progress is required by the course list, gated lessons, quizzes, and certificates.
-- Safe to run more than once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_slug TEXT NOT NULL,
  completed_lessons INTEGER[] NOT NULL DEFAULT '{}',
  quiz_score INTEGER NOT NULL DEFAULT 0,
  quiz_total INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_progress_user_course_unique UNIQUE (uid, course_slug)
);

CREATE INDEX IF NOT EXISTS course_progress_uid_idx
  ON public.course_progress (uid, updated_at DESC);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_progress_select_own" ON public.course_progress;
CREATE POLICY "course_progress_select_own"
  ON public.course_progress FOR SELECT
  USING (auth.uid() = uid);

DROP POLICY IF EXISTS "course_progress_insert_own" ON public.course_progress;
CREATE POLICY "course_progress_insert_own"
  ON public.course_progress FOR INSERT
  WITH CHECK (auth.uid() = uid);

DROP POLICY IF EXISTS "course_progress_update_own" ON public.course_progress;
CREATE POLICY "course_progress_update_own"
  ON public.course_progress FOR UPDATE
  USING (auth.uid() = uid)
  WITH CHECK (auth.uid() = uid);

GRANT SELECT, INSERT, UPDATE ON public.course_progress TO authenticated;
GRANT ALL ON public.course_progress TO service_role;

COMMENT ON TABLE public.course_progress IS 'Per-user MUN course lesson, quiz, and completion progress.';

NOTIFY pgrst, 'reload schema';
