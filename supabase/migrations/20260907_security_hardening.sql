-- Security hardening: distributed rate limits and server-only execution.
-- Apply this migration before relying on global rate limits in production.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_row public.rate_limit_buckets%ROWTYPE;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR length(p_key) > 240
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100000
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_rate_limit_input';
  END IF;

  INSERT INTO public.rate_limit_buckets(bucket_key, window_started_at, request_count, updated_at)
  VALUES (p_key, v_now, 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET request_count = CASE
        WHEN public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN 1
        ELSE public.rate_limit_buckets.request_count + 1
      END,
      window_started_at = CASE
        WHEN public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN v_now
        ELSE public.rate_limit_buckets.window_started_at
      END,
      updated_at = v_now
  RETURNING * INTO v_row;

  RETURN v_row.request_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- Remove stale buckets opportunistically; this is safe and bounded.
DELETE FROM public.rate_limit_buckets
WHERE updated_at < NOW() - INTERVAL '2 days';

NOTIFY pgrst, 'reload schema';
