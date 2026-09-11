import { describe, expect, it } from 'vitest'
import {
  buildAttestation,
  createVerifierPool,
  quorumMet,
  signAttestation,
  verifySignature,
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

describe('multisig ECDSA', () => {
  it('builds attestation committing applicant/finance/score fields', () => {
    const a = buildAttestation({
      entrepreneurName: 'Lakshmi S.',
      villageId: 'dinka-mandya',
      lokScore: 84,
      schemeId: 'term_loan',
      projectCost: 1_000_000,
      loanAmount: 900_000,
      quorumRequired: 2,
      quorumPool: 3,
    })
    expect(a.reportHash).toMatch(/^0x[0-9a-f]+$/i)
    expect(a.entrepreneurName).toBe('Lakshmi S.')
    expect(a.loanAmount).toBe(900_000)
  })

  it('accepts a valid signature from the matching verifier', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation({
      entrepreneurName: 'Lakshmi S.',
      villageId: 'dinka-mandya',
      lokScore: 84,
      schemeId: 'term_loan',
      projectCost: 1_000_000,
      loanAmount: 900_000,
      quorumRequired: 2,
      quorumPool: 3,
    })
    const record = await signAttestation(pool[0], a)
    expect(verifySignature(a, record)).toBe(true)
  })

  it('rejects signature from wrong key', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation({
      entrepreneurName: 'Lakshmi S.',
      villageId: 'dinka-mandya',
      lokScore: 84,
      schemeId: 'term_loan',
      projectCost: 1_000_000,
      loanAmount: 900_000,
      quorumRequired: 2,
      quorumPool: 3,
    })
    const record = await signAttestation(pool[0], a)
    const forged = { ...record, address: pool[1].wallet.address }
    expect(verifySignature(a, forged)).toBe(false)
  })

  it('rejects signature over tampered attestation data', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation({
      entrepreneurName: 'Lakshmi S.',
      villageId: 'dinka-mandya',
      lokScore: 84,
      schemeId: 'term_loan',
      projectCost: 1_000_000,
      loanAmount: 900_000,
      quorumRequired: 2,
      quorumPool: 3,
    })
    const record = await signAttestation(pool[0], a)
    const tampered = { ...a, loanAmount: 1 }
    expect(verifySignature(tampered, record)).toBe(false)
  })

  it('reportHash changes when any material fact changes (applicant, cost, scheme, loan, score)', () => {
    const base = {
      entrepreneurName: 'Lakshmi S.',
      villageId: 'dinka-mandya',
      lokScore: 84,
      schemeId: 'term_loan',
      projectCost: 1_000_000,
      loanAmount: 900_000,
      quorumRequired: 2,
      quorumPool: 3,
    }
    const a = buildAttestation(base)
    const byName = buildAttestation({ ...base, entrepreneurName: 'Someone Else' })
    const byCost = buildAttestation({ ...base, projectCost: 1_000_001 })
    const byScheme = buildAttestation({ ...base, schemeId: 'micro_finance' })
    const byLoan = buildAttestation({ ...base, loanAmount: 900_001 })
    const byScore = buildAttestation({ ...base, lokScore: 85 })
    const hashes = new Set([a, byName, byCost, byScheme, byLoan, byScore].map((x) => x.reportHash))
    expect(hashes.size).toBe(6)
  })

  it('rejects a signature when only the quorum fields are tampered, even though they sit outside reportHash', async () => {
    const pool = createVerifierPool()
    const a = buildAttestation({
      entrepreneurName: 'Lakshmi S.',
      villageId: 'dinka-mandya',
      lokScore: 84,
      schemeId: 'term_loan',
      projectCost: 1_000_000,
      loanAmount: 900_000,
      quorumRequired: 2,
      quorumPool: 3,
    })
    const record = await signAttestation(pool[0], a)
    // quorumRequired/quorumPool aren't in reportHash's packed fields, but they are
    // in the signed message text (attestationMessage) - so tampering them must
    // still invalidate the signature.
    const tamperedQuorum = { ...a, quorumRequired: 4, quorumPool: 5 }
    expect(verifySignature(tamperedQuorum, record)).toBe(false)
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
