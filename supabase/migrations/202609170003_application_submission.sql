-- Phase 5 — application submission columns (Option A reconciled).
-- Additive on Adita applications table (application_id text PK).
-- Does not restore UUID ApplicationRecord as the identity model.

alter table public.applications
  add column if not exists government_reference_id text;

alter table public.applications
  add column if not exists submission_idempotency_key text;

-- Lets legacy UUID ApplicationPersistenceService.submit() use an atomic
-- null-check guard when that compat path is wired to Supabase.
create index if not exists applications_submission_idempotency_key_idx
  on public.applications (submission_idempotency_key)
  where submission_idempotency_key is not null;
