import { describe, expect, it } from 'vitest'
import { createVerifierPool } from '../multisig'
import { demoAuthorizedPool, reviewerFromVerifier } from './allocate'
import { fixtureApplicationSnapshot, fixtureLokScore } from './fixtures'
import { ApprovalError, createApprovalService } from './service'

function service(overrides: Parameters<typeof createApprovalService>[0] = {}) {
  let t = 1_700_000_100_000
  return createApprovalService({ now: () => (t += 1), ...overrides })
}

/** Signs until `count` signatures exist, skipping reviewers who already signed. */
async function signUntilQuorum(
  svc: ReturnType<typeof service>,
  applicationId: string,
  count: number,
  order?: string[],
) {
  const ids = order ?? svc.getReviewerAllocation(applicationId).reviewers.map((r) => r.reviewerId)
  let view = svc.getApprovalCase(applicationId)
  for (const id of ids) {
    if (view.signaturesCollected >= count) break
    if (view.allocation.reviewers.find((r) => r.reviewerId === id)?.hasSigned) continue
    view = await svc.submitSignature(applicationId, id)
  }
  return view
}

describe('approval service — integration against a fixture ApplicationSnapshot', () => {
  it('opens a case from the fixture snapshot and exposes allocation + audit', () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(69)
    const view = svc.openApprovalCase(snapshot)

    expect(view.applicationId).toBe('APP-2026-000123')
    expect(view.status).toBe('open')
    expect(view.quorum).toMatchObject({ required: 3, pool: 5, mentorRequired: false })
    expect(view.applicationHash).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(view.allocation.reviewers).toHaveLength(5)
    expect(view.audit.map((e) => e.eventType)).toEqual([
      'application_opened',
      'reviewer_allocation_created',
    ])
    expect(view.auditChainValid).toBe(true)
    expect(view.simulatedInfrastructure).toBe(true)
    expect(svc.listApplicationIds()).toEqual(['APP-2026-000123'])
  })

  it('completes the 3-of-5 live-demo band end to end through the service only', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(69)
    svc.openApprovalCase(snapshot)

    const afterOne = await signUntilQuorum(svc, snapshot.applicationId, 1)
    expect(afterOne.status).toBe('collecting')
    expect(afterOne.quorumMet).toBe(false)

    const afterThree = await signUntilQuorum(svc, snapshot.applicationId, 3)
    expect(afterThree.status).toBe('quorum_met')
    expect(afterThree.quorumMet).toBe(true)
    expect(afterThree.validSignatures).toBe(3)

    const auth = svc.authorizeDisbursement(snapshot.applicationId)
    expect(auth.simulated).toBe(true)
    expect(auth.applicationId).toBe(snapshot.applicationId)
    expect(auth.applicationHash).toBe(afterThree.applicationHash)
    expect(auth.acceptedSignerRefs).toHaveLength(3)

    const finalView = svc.getApprovalCase(snapshot.applicationId)
    expect(finalView.status).toBe('authorized')
    expect(finalView.disbursementAuthorized).toBe(true)
    expect(finalView.auditChainValid).toBe(true)
    expect(finalView.audit.map((e) => e.eventType)).toContain('disbursement_authorized')
  })

  it('enforces the mentor role for a sub-60 snapshot', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(48, { applicationId: 'APP-LOW-1' })
    const opened = svc.openApprovalCase(snapshot)
    expect(opened.quorum).toMatchObject({ required: 4, pool: 5, mentorRequired: true })

    const allocation = svc.getReviewerAllocation('APP-LOW-1')
    const mentorIds = allocation.reviewers.filter((r) => r.role === 'mentor').map((r) => r.reviewerId)
    expect(mentorIds.length).toBeGreaterThan(0)

    const nonMentors = allocation.reviewers
      .filter((r) => r.role !== 'mentor')
      .map((r) => r.reviewerId)
    const withoutMentor = await signUntilQuorum(svc, 'APP-LOW-1', 4, nonMentors)
    expect(withoutMentor.validSignatures).toBe(4)
    expect(withoutMentor.mentorSatisfied).toBe(false)
    expect(withoutMentor.quorumMet).toBe(false)
    expect(withoutMentor.blockers.some((b) => b.includes('mentor'))).toBe(true)
    expect(() => svc.authorizeDisbursement('APP-LOW-1')).toThrow(ApprovalError)

    const withMentor = await svc.submitSignature('APP-LOW-1', mentorIds[0])
    expect(withMentor.mentorSatisfied).toBe(true)
    expect(withMentor.quorumMet).toBe(true)
    expect(svc.authorizeDisbursement('APP-LOW-1').mentorRequired).toBe(true)
  })

  it('blocks disbursement before quorum and reports the outstanding condition', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(69, { applicationId: 'APP-PARTIAL' })
    svc.openApprovalCase(snapshot)
    await signUntilQuorum(svc, 'APP-PARTIAL', 2)

    try {
      svc.authorizeDisbursement('APP-PARTIAL')
      throw new Error('expected authorizeDisbursement to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ApprovalError)
      expect((e as ApprovalError).code).toBe('QUORUM_NOT_MET')
    }
    const status = svc.getApprovalStatus('APP-PARTIAL')
    expect(status.disbursementAuthorized).toBe(false)
    expect(status.blockers.some((b) => b.includes('need 3'))).toBe(true)
    expect(svc.getApprovalCase('APP-PARTIAL').audit.map((e) => e.eventType)).toContain(
      'disbursement_blocked',
    )
  })
})

describe('approval service — error cases', () => {
  it('rejects an unknown applicationId', () => {
    const svc = service()
    expect(() => svc.getApprovalCase('nope')).toThrow(ApprovalError)
    expect(() => svc.getReviewerAllocation('nope')).toThrow(/No approval case/)
    try {
      svc.getApprovalStatus('nope')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('UNKNOWN_APPLICATION')
    }
  })

  it('rejects a snapshot missing required fields', () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(69)
    try {
      svc.openApprovalCase({ ...snapshot, applicationId: '' })
      throw new Error('expected INVALID_SNAPSHOT')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('INVALID_SNAPSHOT')
      expect((e as ApprovalError).details).toContain('applicationId')
    }
  })

  it('rejects a duplicate applicationId', () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(69)
    svc.openApprovalCase(snapshot)
    try {
      svc.openApprovalCase(snapshot)
      throw new Error('expected DUPLICATE_APPLICATION')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('DUPLICATE_APPLICATION')
    }
  })

  it('fails closed when the snapshot quorum fields disagree with LokScore', () => {
    const svc = service()
    const tampered = fixtureApplicationSnapshot(84, {
      applicationId: 'APP-BAD-QUORUM',
      lokScore: fixtureLokScore(84, { quorumRequired: 4, quorumPool: 5, mentorRequired: true }),
    })
    try {
      svc.openApprovalCase(tampered)
      throw new Error('expected QUORUM_POLICY_MISMATCH')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('QUORUM_POLICY_MISMATCH')
    }
    expect(svc.hasApprovalCase('APP-BAD-QUORUM')).toBe(false)
  })

  it('rejects a signer outside the allocated set and records the rejection', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(84, { applicationId: 'APP-2OF3' })
    const opened = svc.openApprovalCase(snapshot)
    expect(opened.quorum).toMatchObject({ required: 2, pool: 3 })

    const allocated = opened.allocation.reviewers.map((r) => r.reviewerId)
    const outsider = createVerifierPool().find((v) => !allocated.includes(v.id))!
    try {
      await svc.submitSignature('APP-2OF3', outsider.id)
      throw new Error('expected REVIEWER_NOT_ALLOCATED')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('REVIEWER_NOT_ALLOCATED')
    }
    const view = svc.getApprovalCase('APP-2OF3')
    expect(view.audit.map((e) => e.eventType)).toContain('signature_rejected')
    expect(view.signaturesCollected).toBe(0)
    expect(view.auditChainValid).toBe(true)
  })

  it('rejects a duplicate signature from the same reviewer', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(69, { applicationId: 'APP-DUP' })
    svc.openApprovalCase(snapshot)
    const first = svc.getReviewerAllocation('APP-DUP').reviewers[0].reviewerId
    await svc.submitSignature('APP-DUP', first)
    try {
      await svc.submitSignature('APP-DUP', first)
      throw new Error('expected DUPLICATE_SIGNATURE')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('DUPLICATE_SIGNATURE')
    }
    expect(svc.getApprovalStatus('APP-DUP').signaturesCollected).toBe(1)
  })

  it('rejects an unauthorized reviewer and never allocates them', async () => {
    const reviewers = createVerifierPool()
    const svc = service({
      reviewers,
      pool: reviewers.map((v) => reviewerFromVerifier(v, v.roleKey !== 'shg_lead')),
    })
    const snapshot = fixtureApplicationSnapshot(84, { applicationId: 'APP-UNAUTH' })
    const opened = svc.openApprovalCase(snapshot)
    const shgLead = reviewers.find((v) => v.roleKey === 'shg_lead')!

    expect(opened.allocation.reviewers.map((r) => r.reviewerId)).not.toContain(shgLead.id)
    try {
      await svc.submitSignature('APP-UNAUTH', shgLead.id)
      throw new Error('expected authorization failure')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('REVIEWER_NOT_AUTHORIZED')
    }
  })

  it('rejects a reviewer with no known identity', async () => {
    const svc = service()
    svc.openApprovalCase(fixtureApplicationSnapshot(69, { applicationId: 'APP-GHOST' }))
    try {
      await svc.submitSignature('APP-GHOST', 'ghost-reviewer')
      throw new Error('expected REVIEWER_UNKNOWN')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('REVIEWER_UNKNOWN')
    }
  })

  it('rejects a second authorization for the same application', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(84, { applicationId: 'APP-ONCE' })
    svc.openApprovalCase(snapshot)
    await signUntilQuorum(svc, 'APP-ONCE', 2)
    svc.authorizeDisbursement('APP-ONCE')
    try {
      svc.authorizeDisbursement('APP-ONCE')
      throw new Error('expected ALREADY_AUTHORIZED')
    } catch (e) {
      expect((e as ApprovalError).code).toBe('ALREADY_AUTHORIZED')
    }
  })
})

describe('approval service — consumer boundary guarantees', () => {
  it('exposes no wallet, attestation, or raw signature-record internals', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(69, { applicationId: 'APP-SHAPE' })
    svc.openApprovalCase(snapshot)
    const view = await signUntilQuorum(svc, 'APP-SHAPE', 3)

    const serialized = JSON.stringify(view)
    expect(serialized).not.toContain('privateKey')
    expect(serialized).not.toContain('reportHash')
    expect(serialized).not.toContain('verifierId')
    expect(view).not.toHaveProperty('attestation')
    expect(view).not.toHaveProperty('signatures')
    for (const reviewer of view.allocation.reviewers) {
      expect(reviewer).not.toHaveProperty('wallet')
      expect(reviewer.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
      if (reviewer.hasSigned) expect(reviewer.signaturePreview).toMatch(/…$/)
    }
  })

  it('keeps multiple concurrent applications isolated', async () => {
    const svc = service()
    const a = fixtureApplicationSnapshot(69, { applicationId: 'APP-A' })
    const b = fixtureApplicationSnapshot(84, { applicationId: 'APP-B', applicantRef: 'Ravi K.' })
    svc.openApprovalCase(a)
    svc.openApprovalCase(b)

    await signUntilQuorum(svc, 'APP-B', 2)

    expect(svc.getApprovalStatus('APP-A').signaturesCollected).toBe(0)
    expect(svc.getApprovalStatus('APP-A').quorumMet).toBe(false)
    expect(svc.getApprovalStatus('APP-B').quorumMet).toBe(true)
    expect(svc.getApprovalCase('APP-A').applicationHash).not.toBe(
      svc.getApprovalCase('APP-B').applicationHash,
    )
    expect(svc.listApplicationIds()).toEqual(['APP-A', 'APP-B'])
  })

  it('keeps the audit chain append-only and verifiable across the whole lifecycle', async () => {
    const svc = service()
    const snapshot = fixtureApplicationSnapshot(84, { applicationId: 'APP-AUDIT' })
    svc.openApprovalCase(snapshot)
    await signUntilQuorum(svc, 'APP-AUDIT', 2)
    svc.authorizeDisbursement('APP-AUDIT')

    const view = svc.getApprovalCase('APP-AUDIT')
    const types = view.audit.map((e) => e.eventType)
    expect(types[0]).toBe('application_opened')
    expect(types).toContain('signature_collected')
    expect(types).toContain('quorum_evaluated')
    expect(types).toContain('mentor_condition_evaluated')
    expect(types).toContain('quorum_reached')
    expect(types).toContain('disbursement_authorized')
    expect(view.auditChainValid).toBe(true)

    expect(view.audit[0].prevEventHash).toBeNull()
    for (let i = 1; i < view.audit.length; i++) {
      expect(view.audit[i].prevEventHash).toBe(view.audit[i - 1].eventHash)
    }
  })

  it('uses the default demo pool when no reviewers are injected', () => {
    const svc = createApprovalService()
    const view = svc.openApprovalCase(fixtureApplicationSnapshot(69, { applicationId: 'APP-DEFAULT' }))
    const defaultPool = demoAuthorizedPool(createVerifierPool())
    for (const reviewer of view.allocation.reviewers) {
      expect(defaultPool.some((r) => r.id === reviewer.reviewerId)).toBe(true)
    }
  })
})
