import { LOKSCORE_WEIGHTS } from '../config'
import type { LokScoreBreakdown } from '../lokScore'
import {
  buildAttestationFromSnapshot,
  createVerifierPool,
  signAttestation,
  type SignatureRecord,
  type Verifier,
} from '../multisig'
import { allocateReviewers, demoAuthorizedPool, reviewerFromVerifier } from './allocate'
import { appendAuditEvent, verifyAuditChain } from './audit'
import {
  hashApplicationSnapshot,
  type ApplicationSnapshot,
  type ApprovalSignature,
  type AuthorizedReviewer,
} from './contracts'
import { authorizeDisbursement } from './disbursement'
import { evaluateApproval, expectedQuorumFromTotal, freezeQuorumPolicy } from './quorum'

export function scoreBreakdown(total: number, extras?: Partial<LokScoreBreakdown>): LokScoreBreakdown {
  const q = expectedQuorumFromTotal(total)
  const grade: LokScoreBreakdown['grade'] =
    total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D'
  return {
    demand: 70,
    competitionGap: 70,
    weatherFit: 70,
    financialFit: 70,
    eligibility: 70,
    total,
    grade,
    quorumRequired: q.quorumRequired,
    quorumPool: q.quorumPool,
    mentorRequired: q.mentorRequired,
    rationale: [],
    rationaleKn: [],
    weights: LOKSCORE_WEIGHTS,
    ...extras,
  }
}

export function makeSnapshot(
  total: number,
  extras?: Partial<ApplicationSnapshot> & { lokScore?: LokScoreBreakdown },
): ApplicationSnapshot {
  const lokScore = extras?.lokScore ?? scoreBreakdown(total)
  return {
    applicationId: extras?.applicationId ?? 'app-fixture-1',
    applicantRef: extras?.applicantRef ?? 'Lakshmi S.',
    villageId: extras?.villageId ?? 'dinka-mandya',
    schemeId: extras?.schemeId ?? 'term_loan',
    projectCost: extras?.projectCost ?? 1_000_000,
    loanAmount: extras?.loanAmount ?? 900_000,
    lokScore,
    frozenAt: extras?.frozenAt ?? 1_700_000_000_000,
  }
}

export function openCase(snapshot: ApplicationSnapshot, pool: AuthorizedReviewer[]) {
  const policy = freezeQuorumPolicy(snapshot.lokScore)
  const snapshotDigest = hashApplicationSnapshot(snapshot)
  const allocation = allocateReviewers({ snapshot, snapshotDigest, policy, pool })
  const attestation = buildAttestationFromSnapshot(snapshot)
  return { policy, snapshotDigest, allocation, attestation }
}

export function toApprovalSig(r: SignatureRecord): ApprovalSignature {
  return {
    reviewerId: r.verifierId,
    address: r.address,
    signature: r.signature,
    signedAt: r.signedAt,
  }
}

export async function signIds(
  verifiers: Verifier[],
  attestation: ReturnType<typeof buildAttestationFromSnapshot>,
  ids: string[],
): Promise<ApprovalSignature[]> {
  const out: ApprovalSignature[] = []
  for (const id of ids) {
    const v = verifiers.find((x) => x.id === id)
    if (!v) throw new Error(`missing verifier ${id}`)
    out.push(toApprovalSig(await signAttestation(v, attestation)))
  }
  return out
}

export { demoAuthorizedPool, reviewerFromVerifier, createVerifierPool, appendAuditEvent, verifyAuditChain, authorizeDisbursement, evaluateApproval, allocateReviewers }
