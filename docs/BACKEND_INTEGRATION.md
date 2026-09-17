# Backend integration contracts (Option A)

Stable baseline: commit `3cbd93f` and later finalization on `feature/vamshi-backend-finalization`.

Factory entrypoint:

```ts
import { createBackendServices } from './backend'
const backend = createBackendServices({ mode: 'auto' })
```

Modes: `memory` | `hybrid` | `supabase`. Browser defaults to hybrid (scheme reads may use anon; writes stay memory unless a service/session client is injected).

---

## Who calls what

| Teammate | Call | Accepts | Returns | Auth |
|---|---|---|---|---|
| **Kashif (AI/voice)** | `backend.sharedProfiles.*` | `ApplicantProfile` from `src/shared/applicantProfile.ts` | persisted profile | service role for writes |
| **Kashif (live evidence)** | `backend.liveRetrieval.retrieve({ schemeIds, state? })` | schemes.ts ids only | `{ ok, items, errorCode? }` — never invents facts | Edge Function via anon; secrets stay server-side |
| **Kashif / anyone (schemes)** | `backend.schemeCatalog.get/list` | text scheme id | `GovernmentScheme` from **schemes.ts** | none (local SoT) |
| **Adita** | `backend.aditaApplications.save/get/list` | `TrackedApplication`, `LP-APP-*` | same | service role for writes |
| **Prerna** | `backend.admin.listRecent/getDetail/routeForCategory` | status filters / category | summaries + ministry routing | service role for full rows; anon may call `get_application_status_public` RPC only |
| **Jordan** | `backend.jordanApprovals.saveCase/saveSignatures/appendAuditEvents/saveAuthorizationAnchor` | Jordan `ApprovalCase` / `AuditEvent` / `DisbursementAuthorization` | persisted copies | service role; chain anchors always `simulated: true` |
| **Phase 3 discovery (additive)** | `backend.discovery` | discovery query | candidates + honesty notes | server-only env `DATA_GOV_IN_*`; does **not** replace Edge Function |

Legacy UUID `profiles` / `schemes` / `applications` on `BackendServices` are **compat only** — do not force new work onto them.

---

## Stable IDs & statuses

| Kind | Values |
|---|---|
| Scheme ids | `nsfdc-micro-finance`, `nsfdc-term-loan`, … from `schemes.ts` |
| Application ids | `LP-APP-` + 16 hex (`isApplicationId`) |
| Filing outcomes | Adita `FilingOutcome` (`guided_packet_ready`, `submitted_to_government`, …) |
| Approval status | Jordan `open` \| `collecting` \| `quorum_met` \| `authorized` \| `blocked` |
| Verification | `verified_local` \| `live_official` \| `live_contextual` \| `live_unverified` \| `unavailable` |
| Ministry ids | Prerna `MinistryId` (`social_justice`, `msme`, …) |

---

## Simulated vs real

| Surface | Reality |
|---|---|
| Scheme facts | **Source-backed** curated `schemes.ts` (+ optional cache) |
| Live evidence | Real only when Edge Function + `DATA_GOV_IN_*` secrets configured; otherwise explicit `not_configured` / failure |
| Phase 3 discovery | Same — unconfigured adapter is honest skip |
| Government filing | **Not claimed** unless Adita outcome is `submitted_to_government` with real acceptance |
| Chain anchors | Always `simulated: true` — no PII on-chain |

---

## Sensitive fields

Never put in browser bundles or public status RPC:

- full `packet`, `consent`, profile PII, approval signatures, audit hashes beyond what Jordan UI already shows to authorized reviewers
- `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` (never `VITE_*`)

Public status RPC returns only: `application_id`, `scheme_id`, `status`, `outcome`, `filed_with_government`, `simulation`, `updated_at`.

---

## Errors

Typed `BackendError` codes include: `VALIDATION`, `NOT_FOUND`, `NOT_CONFIGURED`, `CONFLICT`, `UPSTREAM`, `SERVICE_ROLE_IN_BROWSER`.

Live gateway `errorCode`: `not_configured` | `upstream` | `timeout` | `validation`.
