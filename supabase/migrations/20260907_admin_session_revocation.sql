-- Admin session revocation support.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.admin_users.session_version IS 'Increment to revoke all active admin JWT sessions for this administrator.';

NOTIFY pgrst, 'reload schema';
