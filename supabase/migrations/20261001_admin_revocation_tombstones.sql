-- Keep a monotonic revocation marker when an admin is removed. Deleting the
-- allowlist row and later recreating it with session_version=1 could reactivate
-- an unexpired version-1 cookie.
--
-- Deploy order: apply before the matching code deploy. This migration also
-- bumps every existing admin session_version, which signs out all admin panels
-- once (they can sign back in immediately).

begin;

alter table public.admin_users
  add column if not exists revoked_at timestamptz;

-- Invalidate every admin cookie issued before this migration.
update public.admin_users
   set session_version = coalesce(session_version, 1) + 1;

create or replace function public.revoke_admin_user(p_uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  if p_uid is null then
    raise exception 'invalid_admin_uid';
  end if;

  update public.admin_users
     set revoked_at = now(),
         session_version = coalesce(session_version, 1) + 1
   where uid = p_uid
     and revoked_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.bump_admin_session_version(p_uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  if p_uid is null then
    raise exception 'invalid_admin_uid';
  end if;

  update public.admin_users
     set session_version = coalesce(session_version, 1) + 1
   where uid = p_uid
     and revoked_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.revoke_admin_user(uuid) from public, anon, authenticated;
revoke all on function public.bump_admin_session_version(uuid) from public, anon, authenticated;
grant execute on function public.revoke_admin_user(uuid) to service_role;
grant execute on function public.bump_admin_session_version(uuid) to service_role;

commit;
