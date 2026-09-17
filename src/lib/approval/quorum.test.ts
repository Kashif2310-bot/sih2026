import { describe, expect, it } from 'vitest'
import { hashApplicationSnapshot } from './contracts'
import { freezeQuorumPolicy } from './quorum'
import {
  createVerifierPool,
  demoAuthorizedPool,
  evaluateApproval,
  makeSnapshot,
  openCase,
  signIds,
  toApprovalSig,
} from './testKit'
import { signAttestation } from '../multisig'

describe('approval evaluation', () => {
  it('valid 2-of-3 quorum', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    expect(snapshot.lokScore.quorumRequired).toBe(2)
    expect(snapshot.lokScore.quorumPool).toBe(3)
    const opened = openCase(snapshot, pool)
    const sigs = await signIds(
      verifiers,
      opened.attestation,
      opened.allocation.allocatedReviewerIds.slice(0, 2),
    )
    const result = evaluateApproval({ snapshot, ...opened, pool, signatures: sigs })
    expect(result.ok).toBe(true)
    expect(result.uniqueValidCount).toBe(2)
  })

  it('valid 3-of-5 quorum', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(70)
    expect(snapshot.lokScore.quorumRequired).toBe(3)
    expect(snapshot.lokScore.quorumPool).toBe(5)
    const opened = openCase(snapshot, pool)
    const sigs = await signIds(
      verifiers,
      opened.attestation,
      opened.allocation.allocatedReviewerIds.slice(0, 3),
    )
    expect(evaluateApproval({ snapshot, ...opened, pool, signatures: sigs }).ok).toBe(true)
  })

  it('invalid signature', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const id = opened.allocation.allocatedReviewerIds[0]
    const v = verifiers.find((x) => x.id === id)!
    const record = await signAttestation(v, opened.attestation)
    const other = verifiers.find((x) => x.id !== id)!
    const otherSig = await signAttestation(other, opened.attestation)
    const bad = toApprovalSig({ ...record, signature: otherSig.signature })
    const result = evaluateApproval({ snapshot, ...opened, pool, signatures: [bad] })
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('invalid signature'))).toBe(true)
  })

  it('duplicate signer', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const one = await signIds(verifiers, opened.attestation, [
      opened.allocation.allocatedReviewerIds[0],
    ])
    const result = evaluateApproval({
      snapshot,
      ...opened,
      pool,
      signatures: [one[0], { ...one[0], signedAt: one[0].signedAt + 1 }],
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('duplicate signer'))).toBe(true)
  })

  it('signer outside allocated set', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const outside = verifiers.find((v) => !opened.allocation.allocatedReviewerIds.includes(v.id))!
    const sigs = await signIds(verifiers, opened.attestation, [
      opened.allocation.allocatedReviewerIds[0],
      outside.id,
    ])
    const result = evaluateApproval({ snapshot, ...opened, pool, signatures: sigs })
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('outside the allocated set'))).toBe(true)
  })

  it('wrong quorum', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const sigs = await signIds(
      verifiers,
      opened.attestation,
      opened.allocation.allocatedReviewerIds.slice(0, 2),
    )
    const result = evaluateApproval({
      snapshot,
      ...opened,
      policy: { ...opened.policy, quorumRequired: 4 },
      pool,
      signatures: sigs,
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('policy does not match') || r.includes('quorum'))).toBe(
      true,
    )
  })

  it('tampered application data', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const sigs = await signIds(
      verifiers,
      opened.attestation,
      opened.allocation.allocatedReviewerIds.slice(0, 2),
    )
    const tampered = { ...snapshot, loanAmount: 1 }
    const result = evaluateApproval({
      snapshot: tampered,
      ...opened,
      pool,
      signatures: sigs,
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.includes('digest') || r.includes('hash'))).toBe(true)
  })

  it('tampered applicationId', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const sigs = await signIds(
      verifiers,
      opened.attestation,
      opened.allocation.allocatedReviewerIds.slice(0, 2),
    )
    const result = evaluateApproval({
      snapshot: { ...snapshot, applicationId: 'forged-id' },
      ...opened,
      pool,
      signatures: sigs,
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some((r) => r.toLowerCase().includes('applicationid') || r.includes('digest'))).toBe(
      true,
    )
  })

  it('tampered mentorRequired', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const sigs = await signIds(
      verifiers,
      opened.attestation,
      opened.allocation.allocatedReviewerIds.slice(0, 2),
    )
    const result = evaluateApproval({
      snapshot,
      ...opened,
      attestation: { ...opened.attestation, mentorRequired: true },
      pool,
      signatures: sigs,
    })
    expect(result.ok).toBe(false)
  })

  it('mentor required but missing', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(40)
    expect(snapshot.lokScore.mentorRequired).toBe(true)
    const opened = openCase(snapshot, pool)
    const nonMentors = opened.allocation.allocatedReviewerIds.filter((id) => {
      return pool.find((r) => r.id === id)?.role !== 'mentor'
    })
    const sigs = await signIds(verifiers, opened.attestation, nonMentors.slice(0, 4))
    const result = evaluateApproval({ snapshot, ...opened, pool, signatures: sigs })
    expect(result.ok).toBe(false)
    expect(result.mentorSatisfied).toBe(false)
    expect(result.reasons.some((r) => r.includes('mentor'))).toBe(true)
  })

  it('mentor present and valid', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(40)
    const opened = openCase(snapshot, pool)
    const mentorId = opened.allocation.mentorReviewerIds[0]
    const others = opened.allocation.allocatedReviewerIds.filter((id) => id !== mentorId)
    const sigs = await signIds(verifiers, opened.attestation, [mentorId, ...others.slice(0, 3)])
    const result = evaluateApproval({ snapshot, ...opened, pool, signatures: sigs })
    expect(result.ok).toBe(true)
    expect(result.mentorSatisfied).toBe(true)
    expect(result.uniqueValidCount).toBe(4)
  })
})

describe('openCase digest binding', () => {
  it('attestation hash equals snapshot digest', () => {
    const verifiers = createVerifierPool()
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, demoAuthorizedPool(verifiers))
    expect(opened.attestation.reportHash).toBe(hashApplicationSnapshot(snapshot))
    expect(opened.snapshotDigest).toBe(opened.attestation.reportHash)
    expect(freezeQuorumPolicy(snapshot.lokScore).quorumPool).toBe(opened.allocation.quorumPool)
  })
})
