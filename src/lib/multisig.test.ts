import { describe, expect, it } from 'vitest'
import {
  buildAttestation,
  createVerifierPool,
  quorumMet,
  signAttestation,
  verifySignature,
  verifySignatureForReviewer,
} from './multisig'
import type { LokScoreBreakdown } from './lokScore'
import { LOKSCORE_WEIGHTS } from './config'

const score = (quorumRequired: number, quorumPool = 5): LokScoreBreakdown => ({
  demand: 70,
  competitionGap: 70,
  weatherFit: 70,
  financialFit: 70,
  eligibility: 70,
  total: 70,
  grade: 'B',
  quorumRequired,
  quorumPool,
  mentorRequired: false,
  rationale: [],
  rationaleKn: [],
  weights: LOKSCORE_WEIGHTS,
})

const basePayload = {
  applicationId: 'app-test-1',
  entrepreneurName: 'Lakshmi S.',
  villageId: 'dinka-mandya',
  lokScore: 84,
  demand: 80,
  competitionGap: 80,
  weatherFit: 80,
  financialFit: 80,
  eligibility: 90,
  schemeId: 'term_loan',
  projectCost: 1_000_000,
  loanAmount: 900_000,
  quorumRequired: 2,
  quorumPool: 3,
  mentorRequired: false,
  timestamp: 1_700_000_000_000,
}

describe('multisig ECDSA', () => {
  it('builds attestation committing applicant/finance/score fields', () => {
    const a = buildAttestation(basePayload)
    expect(a.reportHash).toMatch(/^0x[0-9a-f]+$/i)
    expect(a.entrepreneurName).toBe('Lakshmi S.')
    expect(a.loanAmount).toBe(900_000)
    expect(a.applicationId).toBe('app-test-1')
  })

  it('accepts a valid signature from the matching verifier', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation(basePayload)
    const record = await signAttestation(pool[0], a)
    expect(verifySignature(a, record)).toBe(true)
    expect(verifySignatureForReviewer(a, record, pool[0].wallet.address)).toBe(true)
  })

  it('rejects signature from wrong key', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation(basePayload)
    const record = await signAttestation(pool[0], a)
    const forged = { ...record, address: pool[1].wallet.address }
    expect(verifySignature(a, forged)).toBe(false)
    expect(verifySignatureForReviewer(a, record, pool[1].wallet.address)).toBe(false)
  })

  it('rejects signature over tampered attestation data', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation(basePayload)
    const record = await signAttestation(pool[0], a)
    const tampered = { ...a, loanAmount: 1 }
    expect(verifySignature(tampered, record)).toBe(false)
  })

  it('reportHash changes when any material fact changes (applicant, cost, scheme, loan, score)', () => {
    const a = buildAttestation(basePayload)
    const byName = buildAttestation({ ...basePayload, entrepreneurName: 'Someone Else' })
    const byCost = buildAttestation({ ...basePayload, projectCost: 1_000_001 })
    const byScheme = buildAttestation({ ...basePayload, schemeId: 'micro_finance' })
    const byLoan = buildAttestation({ ...basePayload, loanAmount: 900_001 })
    const byScore = buildAttestation({ ...basePayload, lokScore: 85 })
    const hashes = new Set([a, byName, byCost, byScheme, byLoan, byScore].map((x) => x.reportHash))
    expect(hashes.size).toBe(6)
  })

  it('rejects a signature when only the quorum fields are tampered, even though they sit outside reportHash', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation(basePayload)
    const record = await signAttestation(pool[0], a)
    const tamperedQuorum = { ...a, quorumRequired: 4, quorumPool: 5 }
    expect(verifySignature(tamperedQuorum, record)).toBe(false)
  })

  it('binds applicationId, mentorRequired, and quorum into the digest', () => {
    const a = buildAttestation(basePayload)
    const byApp = buildAttestation({ ...basePayload, applicationId: 'app-other' })
    const byMentor = buildAttestation({ ...basePayload, mentorRequired: true })
    const byQuorum = buildAttestation({ ...basePayload, quorumRequired: 3 })
    expect(byApp.reportHash).not.toBe(a.reportHash)
    expect(byMentor.reportHash).not.toBe(a.reportHash)
    expect(byQuorum.reportHash).not.toBe(a.reportHash)
  })

  it('quorumMet requires enough signatures', () => {
    expect(quorumMet(score(2), [])).toBe(false)
    expect(quorumMet(score(2), [{ verifierId: 'a', address: '0x', signature: '0x', signedAt: 1 }])).toBe(
      false,
    )
    expect(
      quorumMet(score(2), [
        { verifierId: 'a', address: '0x', signature: '0x', signedAt: 1 },
        { verifierId: 'b', address: '0x', signature: '0x', signedAt: 1 },
      ]),
    ).toBe(true)
  })
})
