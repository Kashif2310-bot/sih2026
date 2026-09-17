-- Option A verification queries
-- Run via: npm run supabase:verify
--   or paste into Supabase SQL Editor after applying option_a_hosted_apply.sql
--
-- Expect:
--   ministries >= 7 (Prerna ids)
--   schemes cache: nsfdc-micro-finance, nsfdc-term-loan (optional but seeded)
--   RLS enabled on core tables
--   get_application_status_public exists

select 'ministries' as entity, count(*)::text as n from public.ministries
union all select 'departments', count(*)::text from public.departments
union all select 'schemes_cache', count(*)::text from public.schemes
union all select 'scheme_ministry_map', count(*)::text from public.scheme_ministry_map
union all select 'applicant_profiles', count(*)::text from public.applicant_profiles
union all select 'applications', count(*)::text from public.applications
union all select 'approval_cases', count(*)::text from public.approval_cases
union all select 'chain_anchors', count(*)::text from public.chain_anchors;

select id, code, name_en from public.ministries order by id;

select scheme_id, ministry_id, department_id
from public.scheme_ministry_map
order by scheme_id;

select id, verification_status, source_url
from public.schemes
where id in ('nsfdc-micro-finance', 'nsfdc-term-loan')
order by id;

select * from public.verify_rls_enabled();

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('verify_rls_enabled', 'get_application_status_public')
order by 1;
