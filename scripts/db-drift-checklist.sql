-- Live-database drift checklist (READ-ONLY — safe to run in production).
--
-- Background: the app authorizes exclusively through the service role, so
-- Row-Level Security is the last line of defense and the RPC bodies are the
-- money logic. Run every section in the Supabase SQL editor after each
-- deploy. Every row must read PASS. Any FAIL means production has drifted
-- from supabase/ in this repo: stop and reconcile before shipping further.
--
-- Conventions: check_name identifies the invariant; status is PASS or FAIL;
-- detail carries the offending object when FAIL.

-- 1. RLS must be enabled on every application table. -------------------------
select
  'rls_enabled:' || tablename as check_name,
  case when rowsecurity then 'PASS' else 'FAIL' end as status,
  'relname=' || tablename as detail
from pg_tables
where schemaname = 'public'
  and tablename in (
    'users', 'delegate_profiles', 'research_notes', 'entitlements', 'payments',
    'ai_generations', 'course_progress', 'certificate_downloads',
    'webhook_events', 'admin_users', 'referral_partners', 'referrals',
    'referral_commissions', 'rate_limits', 'ai_usage', 'admin_audit_log',
    'partner_applications'
  );

-- 2. No permissive policies (USING(true), FOR ALL, or browser writes on
--    tables the app treats as service-role-only). Expect zero rows. ---------
select
  'no_permissive_policy' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(tablename || '.' || policyname, ', '), 'none') as detail
from pg_policies
where schemaname = 'public'
  and (
    qual = 'true'
    or with_check = 'true'
    or cmd <> 'SELECT'
  )
  and tablename in (
    'users', 'delegate_profiles', 'research_notes', 'entitlements', 'payments',
    'ai_generations', 'course_progress', 'certificate_downloads',
    'webhook_events', 'admin_users', 'referral_partners', 'referrals',
    'referral_commissions', 'rate_limits', 'ai_usage', 'admin_audit_log',
    'partner_applications'
  );

-- 3. Browser roles must have no direct grants on service-role-only tables. --
select
  'no_browser_grants:course_progress' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(grantee || ':' || privilege_type, ', '), 'none') as detail
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'course_progress'
  and grantee in ('anon', 'authenticated', 'public');

-- 4. Security-critical RPCs exist, are SECURITY DEFINER with pinned
--    search_path, and are executable by service_role only. -------------------
select
  'rpc_present:' || p.proname as check_name,
  case
    when p.oid is null then 'FAIL'
    when p.prosecdef
      and p.proconfig::text like '%search_path=public, pg_temp%'
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and has_function_privilege('service_role', p.oid, 'execute')
    then 'PASS'
    else 'FAIL'
  end as status,
  'secdef=' || coalesce(p.prosecdef::text, 'missing') as detail
from (values
  ('grant_entitlement_atomic'),
  ('create_first_referral_commission'),
  ('rate_limit_check'),
  ('increment_ai_usage')
) as want(name)
left join pg_proc p
  on p.proname = want.name
  and p.pronamespace = 'public'::regnamespace;

-- 5. Anti-double-spend / first-touch uniqueness indexes must exist. ---------
select
  'unique_index:' || want.name as check_name,
  case when i.indexname is null then 'FAIL' else 'PASS' end as status,
  coalesce('index=' || i.indexname, 'missing') as detail
from (values
  ('referral_commissions', 'payment_id'),
  ('referrals', 'referred_uid'),
  ('payments', 'order_ref')
) as want(tbl, col)
left join pg_indexes i
  on i.schemaname = 'public'
  and i.tablename = want.tbl
  and i.indexdef like '%UNIQUE%'
  and i.indexdef like '%' || want.col || '%';

-- 6. Security columns added by recent migrations must exist. ----------------
select
  'column_present:' || want.tbl || '.' || want.col as check_name,
  case when c.column_name is null then 'FAIL' else 'PASS' end as status,
  coalesce('type=' || c.data_type, 'missing') as detail
from (values
  ('admin_users', 'session_version'),
  ('referral_partners', 'dashboard_token_expires_at'),
  ('course_progress', 'quiz_verified_at'),
  ('ai_usage', 'updated_at')
) as want(tbl, col)
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = want.tbl
  and c.column_name = want.col;

-- 7. No plaintext dashboard tokens may remain (64-char SHA-256 hex only). ---
select
  'dashboard_tokens_hashed' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  count(*)::text || ' plaintext token(s) remain' as detail
from public.referral_partners
where dashboard_token is not null
  and length(dashboard_token) <> 64;

-- 8. Chat-history storage bucket must be private with zero browser policies.
select
  'storage_chat_history_private' as check_name,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg('public=' || public::text, ', '), 'missing') as detail
from storage.buckets
where id = 'chat-history' and public = false;

select
  'storage_chat_history_no_policies' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  coalesce(string_agg(policyname, ', '), 'none') as detail
from storage.policies
where bucket_id = 'chat-history';
