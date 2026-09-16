import { solidityPackedKeccak256 } from 'ethers'
import type { Verifier } from '../multisig'
import type {
  ApplicationSnapshot,
  AuthorizedReviewer,
  QuorumPolicy,
  ReviewerAllocation,
} from './contracts'

export class AllocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AllocationError'
  }
}

export function reviewerFromVerifier(v: Verifier, authorized = true): AuthorizedReviewer {
  return {
    id: v.id,
    address: v.wallet.address,
    role: v.roleKey,
    department: v.role,
    authorized,
    jurisdiction: 'KA-demo-fixture',
    displayName: v.name,
    displayNameKn: v.nameKn,
  }
}

export function demoAuthorizedPool(verifiers: Verifier[]): AuthorizedReviewer[] {
  return verifiers.map((v) => reviewerFromVerifier(v, true))
}

function rankReviewer(snapshotDigest: string, applicationId: string, reviewerId: string): string {
  return solidityPackedKeccak256(
    ['bytes32', 'string', 'string'],
    [snapshotDigest, applicationId, reviewerId],
  )
}

export function computeAllocationDigest(input: {
  applicationId: string
  allocatedReviewerIds: string[]
  allocatedAddresses: string[]
  quorumPool: number
  mentorRequired: boolean
}): string {
  return solidityPackedKeccak256(
    ['string', 'string', 'string', 'uint256', 'uint8'],
    [
      input.applicationId,
      input.allocatedReviewerIds.join(','),
      input.allocatedAddresses.join(',').toLowerCase(),
      input.quorumPool,
      input.mentorRequired ? 1 : 0,
    ],
  )
}

/**
 * Deterministic allocation from an authorized pool. Prototype only —
 * not a government reviewer registry.
 */
export function allocateReviewers(input: {
  snapshot: ApplicationSnapshot
  snapshotDigest: string
  policy: QuorumPolicy
  pool: AuthorizedReviewer[]
  allocatedAt?: number
}): ReviewerAllocation {
  const { snapshot, snapshotDigest, policy, pool } = input
  const eligible = pool.filter((r) => r.authorized && r.address && r.id)
  if (new Set(eligible.map((r) => r.id)).size !== eligible.length) {
    throw new AllocationError('authorized pool contains duplicate reviewer ids')
  }
  if (eligible.length < policy.quorumPool) {
    throw new AllocationError(
      `not enough authorized reviewers (${eligible.length}) for quorumPool ${policy.quorumPool}`,
    )
  }

  const mentors = eligible.filter((r) => r.role === 'mentor')
  if (policy.mentorRequired && mentors.length < 1) {
    throw new AllocationError('mentorRequired but no authorized reviewer has the mentor role')
  }

  const ranked = [...eligible].sort((a, b) => {
    const ra = rankReviewer(snapshotDigest, snapshot.applicationId, a.id)
    const rb = rankReviewer(snapshotDigest, snapshot.applicationId, b.id)
    return ra.localeCompare(rb)
  })

  const picked: AuthorizedReviewer[] = []
  const pickedIds = new Set<string>()

  const take = (r: AuthorizedReviewer) => {
    if (pickedIds.has(r.id) || picked.length >= policy.quorumPool) return
    picked.push(r)
    pickedIds.add(r.id)
  }

  if (policy.mentorRequired) {
    const rankedMentor = ranked.find((r) => r.role === 'mentor')
    if (!rankedMentor) throw new AllocationError('mentorRequired but mentor missing after rank')
    take(rankedMentor)
  }

  for (const r of ranked) take(r)

  if (picked.length !== policy.quorumPool) {
    throw new AllocationError('failed to allocate a unique authorized set of quorumPool size')
  }

  const allocatedReviewerIds = picked.map((r) => r.id)
  const allocatedAddresses = picked.map((r) => r.address)
  const mentorReviewerIds = picked.filter((r) => r.role === 'mentor').map((r) => r.id)
  const allocatedAt = input.allocatedAt ?? snapshot.frozenAt

  return {
    applicationId: snapshot.applicationId,
    allocatedReviewerIds,
    allocatedAddresses,
    quorumPool: policy.quorumPool,
    mentorRequired: policy.mentorRequired,
    mentorReviewerIds,
    allocationDigest: computeAllocationDigest({
      applicationId: snapshot.applicationId,
      allocatedReviewerIds,
      allocatedAddresses,
      quorumPool: policy.quorumPool,
      mentorRequired: policy.mentorRequired,
    }),
    allocatedAt,
  }
}