-- Phase 3 official-source discovery AUDIT log (Option A reconciled).
--
-- IMPORTANT: Do NOT use public.scheme_retrievals here.
-- That table belongs to Kashif's live-scheme-retrieval Edge Function
-- (see 0001_scheme_assistant_schema.sql: source/query/status/result_count).
--
-- This table is a separate audit sink for Backend Phase 3 discovery adapters
-- (officialSource/*). Discovery is additive enrichment — schemes.ts remains SoT.

create table if not exists public.official_discovery_retrievals (
  id uuid primary key default gen_random_uuid(),
  source_adapter_id text not null,
  pass_type text not null,
  query_signature text not null,
  ok boolean not null,
  record_count integer not null default 0,
  latency_ms integer not null default 0,
  error_message text,
  attempted_at timestamptz not null default now()
);

create index if not exists official_discovery_retrievals_adapter_idx
  on public.official_discovery_retrievals (source_adapter_id, attempted_at desc);
create index if not exists official_discovery_retrievals_attempted_at_idx
  on public.official_discovery_retrievals (attempted_at desc);

alter table public.official_discovery_retrievals enable row level security;

-- Service-role writes only (no is_admin() — that helper lived in archived Phase 1/2 RLS).
-- Demo honesty: allow anon read of operational diagnostics; never invent secrets.
drop policy if exists official_discovery_retrievals_public_read on public.official_discovery_retrievals;
create policy official_discovery_retrievals_public_read
  on public.official_discovery_retrievals for select using (true);

comment on table public.official_discovery_retrievals is
  'Audit log for Backend Phase 3 officialSchemeDiscovery adapters. Separate from Kashif scheme_retrievals used by live-scheme-retrieval.';
