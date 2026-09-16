import { describe, expect, it } from 'vitest'
import { allocateReviewers, AllocationError, reviewerFromVerifier } from './allocate'
import { hashApplicationSnapshot } from './contracts'
import { freezeQuorumPolicy } from './quorum'
import { createVerifierPool, demoAuthorizedPool, makeSnapshot, scoreBreakdown } from './testKit'

describe('reviewer allocation', () => {
  it('allocation contains only authorized reviewers', () => {
    const verifiers = createVerifierPool()
    const pool = [
      ...demoAuthorizedPool(verifiers),
      {
        id: 'rogue-unauth',
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        role: 'sca_officer' as const,
        department: 'None',
        authorized: false,
      },
    ]
    const snapshot = makeSnapshot(70)
    const policy = freezeQuorumPolicy(snapshot.lokScore)
    const allocation = allocateReviewers({
      snapshot,
      snapshotDigest: hashApplicationSnapshot(snapshot),
      policy,
      pool,
    })
    expect(allocation.allocatedReviewerIds).not.toContain('rogue-unauth')
    expect(allocation.allocatedReviewerIds).toHaveLength(5)
    for (const id of allocation.allocatedReviewerIds) {
      const r = pool.find((p) => p.id === id)
      expect(r?.authorized).toBe(true)
    }
  })

  it('no duplicate allocation', () => {
    const verifiers = createVerifierPool()
    const snapshot = makeSnapshot(84)
    const policy = freezeQuorumPolicy(snapshot.lokScore)
    const allocation = allocateReviewers({
      snapshot,
      snapshotDigest: hashApplicationSnapshot(snapshot),
      policy,
      pool: demoAuthorizedPool(verifiers),
    })
    expect(allocation.allocatedReviewerIds).toHaveLength(3)
    expect(new Set(allocation.allocatedReviewerIds).size).toBe(3)
  })

  it('is deterministic for the same snapshot', () => {
    const verifiers = createVerifierPool()
    const snapshot = makeSnapshot(84)
    const policy = freezeQuorumPolicy(snapshot.lokScore)
    const digest = hashApplicationSnapshot(snapshot)
    const pool = demoAuthorizedPool(verifiers)
    const a = allocateReviewers({ snapshot, snapshotDigest: digest, policy, pool })
    const b = allocateReviewers({ snapshot, snapshotDigest: digest, policy, pool })
    expect(a.allocatedReviewerIds).toEqual(b.allocatedReviewerIds)
    expect(a.allocationDigest).toBe(b.allocationDigest)
  })

  it('includes a mentor role when mentorRequired', () => {
    const verifiers = createVerifierPool()
    const snapshot = makeSnapshot(50)
    const policy = freezeQuorumPolicy(snapshot.lokScore)
    const allocation = allocateReviewers({
      snapshot,
      snapshotDigest: hashApplicationSnapshot(snapshot),
      policy,
      pool: demoAuthorizedPool(verifiers),
    })
    const pool = demoAuthorizedPool(verifiers)
    const mentorIds = pool.filter((r) => r.role === 'mentor').map((r) => r.id)
    expect(allocation.mentorReviewerIds.length).toBeGreaterThan(0)
    expect(allocation.allocatedReviewerIds.some((id) => mentorIds.includes(id))).toBe(true)
  })

  it('fails closed when no authorized mentor exists but mentor is required', () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers).filter((r) => r.role !== 'mentor')
    const snapshot = makeSnapshot(40)
    const policy = freezeQuorumPolicy(snapshot.lokScore)
    expect(() =>
      allocateReviewers({
        snapshot,
        snapshotDigest: hashApplicationSnapshot(snapshot),
        policy,
        pool,
      }),
    ).toThrow(AllocationError)
  })

  it('does not use unauthorized reviewers even if they would fill the pool', () => {
    const verifiers = createVerifierPool()
    const pool = verifiers.map((v, i) => reviewerFromVerifier(v, i < 2))
    const snapshot = makeSnapshot(84)
    const policy = freezeQuorumPolicy(scoreBreakdown(84))
    expect(() =>
      allocateReviewers({
        snapshot,
        snapshotDigest: hashApplicationSnapshot(snapshot),
        policy,
        pool,
      }),
    ).toThrow(/not enough authorized/)
  })
})
