import { describe, expect, it } from 'vitest'
import { hashApplicationSnapshot, hashApprovalPayload, payloadFromSnapshot } from './contracts'
import { freezeQuorumPolicy, QuorumPolicyMismatchError } from './quorum'
import { makeSnapshot, scoreBreakdown } from './testKit'

describe('approval payload hashing', () => {
  it('changing material fields changes the digest', () => {
    const base = makeSnapshot(84)
    const digest = hashApplicationSnapshot(base)
    expect(hashApplicationSnapshot({ ...base, applicationId: 'app-other' })).not.toBe(digest)
    expect(hashApplicationSnapshot({ ...base, applicantRef: 'Other' })).not.toBe(digest)
    expect(hashApplicationSnapshot({ ...base, schemeId: 'micro_finance' })).not.toBe(digest)
    expect(hashApplicationSnapshot({ ...base, projectCost: 1_000_001 })).not.toBe(digest)
    expect(hashApplicationSnapshot({ ...base, loanAmount: 900_001 })).not.toBe(digest)
    expect(hashApplicationSnapshot({ ...base, lokScore: scoreBreakdown(85) })).not.toBe(digest)
    expect(hashApplicationSnapshot({ ...base, frozenAt: base.frozenAt + 1 })).not.toBe(digest)
    const mentorFlip = makeSnapshot(50)
    const mentorOn = hashApplicationSnapshot(mentorFlip)
    expect(
      hashApprovalPayload({
        ...payloadFromSnapshot(mentorFlip),
        mentorRequired: false,
      }),
    ).not.toBe(mentorOn)
  })

  it('does not treat Date.now as the only differentiator — identical frozen payloads hash equally', () => {
    const a = makeSnapshot(84)
    const b = { ...a, lokScore: { ...a.lokScore } }
    expect(hashApplicationSnapshot(a)).toBe(hashApplicationSnapshot(b))
  })
})

describe('quorum freeze', () => {
  it('consumes matching LokScore quorum fields for 2-of-3 / 3-of-5 / 4-of-5+mentor', () => {
    expect(freezeQuorumPolicy(scoreBreakdown(80))).toMatchObject({
      quorumRequired: 2,
      quorumPool: 3,
      mentorRequired: false,
    })
    expect(freezeQuorumPolicy(scoreBreakdown(60))).toMatchObject({
      quorumRequired: 3,
      quorumPool: 5,
      mentorRequired: false,
    })
    expect(freezeQuorumPolicy(scoreBreakdown(59))).toMatchObject({
      quorumRequired: 4,
      quorumPool: 5,
      mentorRequired: true,
    })
  })

  it('fails closed on a mismatched quorum snapshot', () => {
    const bad = scoreBreakdown(84, { quorumRequired: 4, quorumPool: 5, mentorRequired: true })
    expect(() => freezeQuorumPolicy(bad)).toThrow(QuorumPolicyMismatchError)
  })
})
