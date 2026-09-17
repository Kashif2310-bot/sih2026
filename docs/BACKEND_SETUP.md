# Backend setup & hosted Supabase runbook

## Prerequisites

- Node 20+
- Repo checkout on/after `3cbd93f` (Option A + Phase 3–5 merge)
- Optional: Docker Desktop for local `supabase start`
- Hosted project credentials (URL + anon + service role)

Never put service-role / secret keys in `VITE_*` variables.

## Environment variables

Copy from `.env.example` into `.env.local` (gitignored):

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Anon/publishable key |
| `SUPABASE_URL` | server/tests | Same URL |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | server | Anon |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | server/tests **only** | Bypasses RLS |
| `SUPABASE_INTEGRATION` | tests | `1` to enable hosted integration tests |
| `DATA_GOV_IN_API_KEY` | Edge / server | Live OGD calls (optional) |
| `DATA_GOV_IN_RESOURCE_ID` | Edge secret | Kashif Edge Function resource |
| `DATA_GOV_IN_SCHEME_RESOURCE_ID` | server | Phase 3 discovery adapter (optional, separate) |

## Migration order (authoritative)

Apply **exactly** this order (also concatenated in the hosted bundle):

1. `supabase/migrations/0001_scheme_assistant_schema.sql` — Kashif schemes cache + `scheme_retrievals`
2. `supabase/migrations/202609170001_option_a_reconciled.sql` — profiles, Adita apps, Jordan tables, ministries
3. `supabase/migrations/202609170002_official_discovery_retrievals.sql` — Phase 3 discovery audit
4. `supabase/migrations/202609170003_application_submission.sql` — submission columns
5. `supabase/migrations/202609170004_rls_hardening.sql` — ownership + RLS tighten
6. Seed: `supabase/seed/scheme_cache_v0.sql`

**Do not apply** anything under `supabase/archive/backend-phase12-incompatible/`.

## Hosted apply (required for GREEN integration)

Hosted REST currently returns **404** for Option A tables until schema is applied.
API keys alone cannot run DDL.

### Manual SQL Editor (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Open repo file `supabase/bundles/option_a_hosted_apply.sql`.
3. Paste **entire** contents → **Run**.
4. Then open `supabase/migrations/202609170004_rls_hardening.sql` → Run  
   (included in the regenerated bundle once this finalization lands; if your bundle is older, run the migration file separately).
5. Confirm with SQL from `scripts/verify-supabase.sql`.
6. Set `SUPABASE_INTEGRATION=1` in `.env.local`.
7. Run: `npm run test:integration`

### CLI (if you have DB password + access token)

```bash
npx supabase link --project-ref <ref>
npx supabase db push
# seed
npx supabase db query --file supabase/seed/scheme_cache_v0.sql
npm run supabase:verify
```

## Local development

```bash
npm install
npm run dev                 # Vite SPA; backend memory/hybrid without schema
npm test                    # unit tests
npm run lint
npm run build
npm run test:e2e            # requires Playwright browsers
```

With Docker:

```bash
npm run supabase:start
npm run supabase:env
npm run supabase:reset      # applies migrations + seed
set SUPABASE_INTEGRATION=1  # Windows PowerShell: $env:SUPABASE_INTEGRATION=1
npm run test:integration
```

## Security model (after RLS hardening)

| Actor | Can |
|---|---|
| anon | Read reference tables (`ministries`, `departments`, `scheme_ministry_map`, schemes cache); call `get_application_status_public`; **cannot** write; **cannot** read full application/approval/profile rows |
| authenticated | SELECT own rows where `owner_user_id = auth.uid()` |
| service_role | Full backend persistence (profiles, apps, approvals, anchors) |

## Verify commands for teammates

```bash
git fetch origin
git checkout feature/vamshi-backend-finalization
npm install
npm test
npm run lint
npm run build
# after hosted schema applied:
#   set SUPABASE_INTEGRATION=1
npm run test:integration
npm run test:e2e
```

## Production notes

- Deploy Edge Function `live-scheme-retrieval` with secrets — never ship those to the SPA.
- Keep chain anchors `simulated: true` until a real non-PII anchoring path exists.
- Do not treat Phase 3 `discovery` as scheme SoT; `schemes.ts` remains authoritative.
