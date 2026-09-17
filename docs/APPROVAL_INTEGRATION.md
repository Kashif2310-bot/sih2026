# Approval Layer — Integration Guide

Audience: the Application team (Adita), the admin/UI team (Prerna), and anyone
wiring approval state into a screen.

Import surface for consumers is exactly two modules:

```ts
import { createApprovalService, ApprovalError } from '@/lib/approval/service'
import type { ApprovalCaseView, ApprovalStatusView } from '@/lib/approval/views'
```

Do **not** import `src/lib/multisig`, `./quorum`, `./allocate`, `./audit`, or
`./disbursement` from UI or application code. Those are internals and may
change without notice.

---

## Application → Approval boundary

```
Adita: Application + applicationId
        │  (frozen ApplicationSnapshot)
        ▼
Jordan: openApprovalCase()
        → quorum policy verified against Prerna's LokScore (fails closed)
        → deterministic reviewer allocation from the authorized pool
        → canonical snapshot digest + real ECDSA attestation (internal)
        ▼
        submitSignature() ×N  → getApprovalStatus() / getApprovalCase()
        ▼
        authorizeDisbursement() → DisbursementAuthorization (simulated rail)
```

Ownership rules this boundary encodes:

- **Adita owns** `Application`, `applicationId` semantics, payload authorship,
  and lifecycle. The approval layer only *consumes* a snapshot.
- **Prerna owns** LokScore. The approval layer reads `total`, `quorumRequired`,
  `quorumPool`, `mentorRequired` and **never recomputes or reinterprets** them.
- **Jordan owns** everything from `openApprovalCase()` inwards: allocation,
  signing, verification, audit chain, disbursement authorization.
- `/assistant` is not connected to this layer in either direction.

---

## Required inputs

`openApprovalCase(snapshot: ApplicationSnapshot)`

| Field | Type | Notes |
|---|---|---|
| `applicationId` | `string` | **From Adita.** Treated as an opaque external id. |
| `applicantRef` | `string` | Display/reference only. |
| `villageId` | `string` | Resolved location id. |
| `schemeId` | `string` | From the finance plan. |
| `projectCost` | `number` | Rupees. |
| `loanAmount` | `number` | Rupees. |
| `lokScore` | `LokScoreBreakdown` | Prerna's output, unmodified. |
| `frozenAt` | `number` | Epoch ms when the snapshot was frozen. |

**Do not put documents, KYC payloads, Aadhaar numbers, phone numbers, or any
raw personal records in the snapshot.** The approval layer hashes what it
receives and keeps it in the audit chain; only the fields above belong there.

Until Adita's Application module ships, use
`fixtureApplicationSnapshot()` from `src/lib/approval/fixtures.ts` for tests,
and pass a real `applicationId` as soon as one exists. `AppContext` currently
mints a `provisional:` id for the single-session demo — that is a temporary
adapter, not an Application implementation.

---

## Methods and returned outputs

| Method | Returns | Notes |
|---|---|---|
| `openApprovalCase(snapshot)` | `ApprovalCaseView` | Opens the case; emits `application_opened` + `reviewer_allocation_created`. |
| `getApprovalCase(applicationId)` | `ApprovalCaseView` | Full read model incl. allocation, audit, disbursement. |
| `getReviewerAllocation(applicationId)` | `ReviewerAllocationView` | Allocated reviewers, mentor ids, allocation digest. |
| `submitSignature(applicationId, reviewerId)` | `Promise<ApprovalCaseView>` | Real ECDSA sign + verify, then re-evaluates quorum. |
| `getApprovalStatus(applicationId)` | `ApprovalStatusView` | Lightweight polling shape for an admin list. |
| `authorizeDisbursement(applicationId)` | `DisbursementAuthorization` | Throws unless every condition holds. |
| `hasApprovalCase(applicationId)` | `boolean` | Existence check without throwing. |
| `listApplicationIds()` | `string[]` | Open cases in insertion order. |

`ApprovalStatusView` carries `status`, `quorum`, `signaturesCollected`,
`validSignatures`, `mentorSatisfied`, `quorumMet`, `disbursementAuthorized`,
`blockers`, and `simulatedInfrastructure: true`.

`ApprovalCaseView` adds `applicationHash`, `lokScoreTotal`, `allocation`,
`audit`, `auditChainValid`, and `disbursement`.

`status` progresses `open → collecting → quorum_met → authorized`, or
`blocked` if an integrity check fails.

Views intentionally expose **no** wallet, attestation, private key, or full
signature. Reviewer rows carry a public `address` and a truncated
`signaturePreview` only.

---

## Error cases

All failures throw `ApprovalError` with a machine-readable `code`:

| Code | Cause |
|---|---|
| `INVALID_SNAPSHOT` | Missing required snapshot fields (`details` lists them). |
| `DUPLICATE_APPLICATION` | A case is already open for that `applicationId`. |
| `UNKNOWN_APPLICATION` | No case for that `applicationId`. |
| `QUORUM_POLICY_MISMATCH` | Snapshot quorum fields disagree with the locked 80/60 table. Fails closed; no case is created. |
| `ALLOCATION_FAILED` | Too few authorized reviewers, or mentor required with no mentor in the pool. |
| `REVIEWER_UNKNOWN` | Reviewer id not in the authorized pool. |
| `REVIEWER_NOT_AUTHORIZED` | Reviewer exists but `authorized === false`. |
| `REVIEWER_NOT_ALLOCATED` | Reviewer is not in this case's allocated set. |
| `REVIEWER_NO_SIGNING_KEY` | No signing identity available for that reviewer. |
| `DUPLICATE_SIGNATURE` | Reviewer already signed this case. |
| `SIGNATURE_INVALID` | Recovered signer does not match the reviewer's address. |
| `QUORUM_NOT_MET` | `authorizeDisbursement` before all conditions hold; `details` lists blockers. |
| `ALREADY_AUTHORIZED` | Disbursement already authorized for that application. |

Rejected signature attempts are still recorded as `signature_rejected` audit
events, so a refusal is auditable rather than silent.

For UI, prefer `blockers` from the status view for user-facing text, and
`code` for control flow.

---

## Security assumptions

1. **Cryptography is real; infrastructure is simulated.** Signatures are
   secp256k1 ECDSA over an EIP-191 message via ethers. No chain is connected,
   `contracts/AdaptiveSanction.sol` is not deployed, and no funds move.
   `DisbursementAuthorization.simulated` is always `true`.
2. **The signed digest binds the authorization decision**: `applicationId`,
   applicant reference, scheme, project cost, loan amount, all five LokScore
   components and the total, `quorumRequired`, `quorumPool`, `mentorRequired`,
   and `frozenAt`. Changing any of them changes the digest and invalidates
   every collected signature.
3. **Quorum comes from LokScore and is verified, not chosen.** A snapshot whose
   quorum fields disagree with the locked thresholds is rejected outright.
4. **Mentor is a role, not a person.** When `mentorRequired` is true, quorum is
   unmet until at least one *valid* signature comes from a reviewer whose role
   is `mentor`. No named individual is hard-coded.
5. **Signers must be allocated, authorized, unique, and address-matched.**
   Duplicate reviewer ids and duplicate addresses are both rejected.
6. **The applicant cannot choose reviewers.** Allocation is derived
   deterministically from the snapshot digest and application id, and is
   recorded as `allocationDigest` for audit.
7. **The audit log is append-only and hash-chained**; each event commits to the
   previous event's hash. `auditChainValid` re-verifies the chain on read.
8. **Reviewer identities are demo fixtures.** The pool is not a government
   officer registry and there is no officer authentication. Replacing the pool
   with real authenticated identities is the main production gap.
9. **State is in-memory for one session.** There is no persistence, so audit
   evidence does not survive a refresh.

---

## Minimal admin-UI example

```ts
const service = createApprovalService()
const view = service.openApprovalCase(snapshotFromApplicationLayer)

for (const reviewer of view.allocation.reviewers) {
  // reviewer.displayName, reviewer.role, reviewer.hasSigned, reviewer.address
}

try {
  const updated = await service.submitSignature(view.applicationId, reviewerId)
  if (updated.quorumMet) service.authorizeDisbursement(updated.applicationId)
} catch (e) {
  if (e instanceof ApprovalError && e.code === 'DUPLICATE_SIGNATURE') {
    // already signed — refresh the row
  }
}
```
