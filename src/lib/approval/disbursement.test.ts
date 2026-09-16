import { describe, expect, it } from 'vitest'
import {
  authorizeDisbursement,
  createVerifierPool,
  demoAuthorizedPool,
  evaluateApproval,
  makeSnapshot,
  openCase,
  signIds,
} from './testKit'

describe('disbursement authorization', () => {
  it('is blocked before quorum', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const one = await signIds(verifiers, opened.attestation, [opened.allocation.allocatedReviewerIds[0]])
    const result = authorizeDisbursement({
      snapshot,
      ...opened,
      pool,
      signatures: one,
      auditLog: [],
      authorizedAt: 1_700_000_000_100,
    })
    expect(result.ok).toBe(false)
  })

  it('is created after valid quorum', async () => {
    const verifiers = createVerifierPool()
    const pool = demoAuthorizedPool(verifiers)
    const snapshot = makeSnapshot(84)
    const opened = openCase(snapshot, pool)
    const sigs = await signIds(
      verifiers,
      opened.attestation,
      opened.allocation.allocatedReviewerIds.slice(0, 2),
    )
    expect(
      evaluateApproval({ snapshot, ...opened, pool, signatures: sigs }).ok,
    ).toBe(true)
    const result = authorizeDisbursement({
      snapshot,
      ...opened,
      pool,
      signatures: sigs,
      auditLog: [],
      authorizedAt: 1_700_000_000_100,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.authorization.simulated).toBe(true)
      expect(result.authorization.applicationId).toBe(snapshot.applicationId)
      expect(result.authorization.applicationHash).toBe(opened.snapshotDigest)
      expect(result.authorization.acceptedSignerRefs).toHaveLength(2)
      expect(result.authorization.authorizationDigest).toMatch(/^0x[0-9a-f]+$/i)
    }
  })
})
