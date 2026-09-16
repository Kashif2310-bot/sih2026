import { QUORUM_THRESHOLDS } from '../config'
import type { LokScoreBreakdown } from '../lokScore'
import { verifySignature, type Attestation, type SignatureRecord } from '../multisig'
import {
  hashApplicationSnapshot,
  type ApplicationSnapshot,
  type ApprovalSignature,
  type AuthorizedReviewer,
  type QuorumPolicy,
  type ReviewerAllocation,
} from './contracts'

export class QuorumPolicyMismatchError extends Error {
  readonly expected: QuorumPolicy
  readonly actual: Pick<LokScoreBreakdown, 'quorumRequired' | 'quorumPool' | 'mentorRequired' | 'total'>

  constructor(expected: QuorumPolicy, actual: LokScoreBreakdown) {
    super(
      `Quorum policy mismatch for LokScore ${actual.total}: ` +
        `expected ${expected.quorumRequired}-of-${expected.quorumPool} mentorRequired=${expected.mentorRequired}, ` +
        `got ${actual.quorumRequired}-of-${actual.quorumPool} mentorRequired=${actual.mentorRequired}. Failing closed.`,
    )
    this.name = 'QuorumPolicyMismatchError'
    this.expected = expected
    this.actual = {
      quorumRequired: actual.quorumRequired,
      quorumPool: actual.quorumPool,
      mentorRequired: actual.mentorRequired,
      total: actual.total,
    }
  }
}

/**
 * Expected quorum from the locked 80/60 table. This is a *check* against
 * existing LokScore outputs — it does not recompute the score.
 */
export function expectedQuorumFromTotal(total: number): QuorumPolicy {
  let quorumRequired = 4
  let quorumPool = 5
  let mentorRequired = true
  if (total >= QUORUM_THRESHOLDS.high) {
    quorumRequired = 2
    quorumPool = 3
    mentorRequired = false
  } else if (total >= QUORUM_THRESHOLDS.mid) {
    quorumRequired = 3
    quorumPool = 5
    mentorRequired = false
  }
  return { quorumRequired, quorumPool, mentorRequired, derivedFromScore: total }
}

export function freezeQuorumPolicy(score: LokScoreBreakdown): QuorumPolicy {
  const expected = expectedQuorumFromTotal(score.total)
  if (
    expected.quorumRequired !== score.quorumRequired ||
    expected.quorumPool !== score.quorumPool ||
    expected.mentorRequired !== score.mentorRequired
  ) {
    throw new QuorumPolicyMismatchError(expected, score)
  }
  return expected
}

export interface ApprovalEvaluation {
  ok: boolean
  reasons: string[]
  validSignerIds: string[]
  mentorSatisfied: boolean
  uniqueValidCount: number
}

function asRecord(s: ApprovalSignature): SignatureRecord {
  return {
    verifierId: s.reviewerId,
    address: s.address,
    signature: s.signature,
    signedAt: s.signedAt,
  }
}

export function evaluateApproval(input: {
  snapshot: ApplicationSnapshot
  snapshotDigest: string
  policy: QuorumPolicy
  allocation: ReviewerAllocation
  pool: AuthorizedReviewer[]
  attestation: Attestation
  signatures: ApprovalSignature[]
}): ApprovalEvaluation {
  const reasons: string[] = []
  const { snapshot, policy, allocation, pool, attestation, signatures } = input

  try {
    freezeQuorumPolicy(snapshot.lokScore)
  } catch (e) {
    reasons.push(e instanceof Error ? e.message : 'quorum policy mismatch')
    return { ok: false, reasons, validSignerIds: [], mentorSatisfied: false, uniqueValidCount: 0 }
  }

  if (
    policy.quorumRequired !== snapshot.lokScore.quorumRequired ||
    policy.quorumPool !== snapshot.lokScore.quorumPool ||
    policy.mentorRequired !== snapshot.lokScore.mentorRequired ||
    policy.derivedFromScore !== snapshot.lokScore.total
  ) {
    reasons.push('supplied policy does not match frozen LokScore quorum fields')
  }

  const recomputed = hashApplicationSnapshot(snapshot)
  if (recomputed.toLowerCase() !== input.snapshotDigest.toLowerCase()) {
    reasons.push('snapshot digest does not match canonical hash of frozen application')
  }
  if (attestation.reportHash.toLowerCase() !== recomputed.toLowerCase()) {
    reasons.push('attestation hash does not match frozen application snapshot')
  }
  if (attestation.applicationId !== snapshot.applicationId) {
    reasons.push('attestation applicationId does not match snapshot')
  }
  if (attestation.mentorRequired !== snapshot.lokScore.mentorRequired) {
    reasons.push('attestation mentorRequired does not match snapshot')
  }
  if (
    attestation.quorumRequired !== policy.quorumRequired ||
    attestation.quorumPool !== policy.quorumPool
  ) {
    reasons.push('attestation quorum does not match policy')
  }
  if (allocation.applicationId !== snapshot.applicationId) {
    reasons.push('allocation applicationId does not match snapshot')
  }
  if (allocation.quorumPool !== policy.quorumPool) {
    reasons.push('allocation pool size does not match policy')
  }
  if (allocation.allocatedReviewerIds.length !== policy.quorumPool) {
    reasons.push('allocated set size does not equal quorumPool')
  }
  if (new Set(allocation.allocatedReviewerIds).size !== allocation.allocatedReviewerIds.length) {
    reasons.push('allocation contains duplicate reviewers')
  }

  const byId = new Map(pool.map((r) => [r.id, r]))
  for (const id of allocation.allocatedReviewerIds) {
    const r = byId.get(id)
    if (!r) {
      reasons.push(`allocated reviewer ${id} is not in the provided pool`)
      continue
    }
    if (!r.authorized) reasons.push(`allocated reviewer ${id} is not authorized`)
  }

  const allocatedMentors = allocation.allocatedReviewerIds.filter((id) => byId.get(id)?.role === 'mentor')
  if (policy.mentorRequired && allocatedMentors.length < 1) {
    reasons.push('mentorRequired but allocation contains no mentor role')
  }

  const seenIds = new Set<string>()
  const seenAddrs = new Set<string>()
  const validSignerIds: string[] = []

  for (const sig of signatures) {
    if (seenIds.has(sig.reviewerId) || seenAddrs.has(sig.address.toLowerCase())) {
      reasons.push(`duplicate signer ${sig.reviewerId}`)
      continue
    }
    seenIds.add(sig.reviewerId)
    seenAddrs.add(sig.address.toLowerCase())

    if (!allocation.allocatedReviewerIds.includes(sig.reviewerId)) {
      reasons.push(`signer ${sig.reviewerId} is outside the allocated set`)
      continue
    }
    const reviewer = byId.get(sig.reviewerId)
    if (!reviewer) {
      reasons.push(`signer ${sig.reviewerId} has no pool identity`)
      continue
    }
    if (reviewer.address.toLowerCase() !== sig.address.toLowerCase()) {
      reasons.push(`signer ${sig.reviewerId} address does not match reviewer identity`)
      continue
    }
    if (!verifySignature(attestation, asRecord(sig))) {
      reasons.push(`invalid signature from ${sig.reviewerId}`)
      continue
    }
    validSignerIds.push(sig.reviewerId)
  }

  const uniqueValidCount = validSignerIds.length
  const mentorSatisfied =
    !policy.mentorRequired ||
    validSignerIds.some((id) => byId.get(id)?.role === 'mentor')

  if (policy.mentorRequired && !mentorSatisfied) {
    reasons.push('mentorRequired but no valid mentor-role signature')
  }
  if (uniqueValidCount < policy.quorumRequired) {
    reasons.push(
      `need ${policy.quorumRequired} unique valid allocated signatures, have ${uniqueValidCount}`,
    )
  }

  const fatal = reasons.filter(
    (r) =>
      r.startsWith('need ') === false &&
      r !== 'mentorRequired but no valid mentor-role signature',
  )
  const waitingOnCount = uniqueValidCount < policy.quorumRequired
  const waitingOnMentor = policy.mentorRequired && !mentorSatisfied
  const integrityFailed = fatal.length > 0
  const ok = !integrityFailed && !waitingOnCount && !waitingOnMentor

  return { ok, reasons, validSignerIds, mentorSatisfied, uniqueValidCount }
}
