import { describe, expect, it } from 'vitest'
import { evaluateEligibility } from './eligibility'
import { SCHEMES } from './data/schemes'
import { EMPTY_PROFILE, type GovernmentScheme, type UserProfile } from './types'

function scheme(id: string): GovernmentScheme {
  const s = SCHEMES.find((x) => x.id === id)
  if (!s) throw new Error(`fixture scheme not found: ${id}`)
  return s
}

const POULTRY_PROFILE: UserProfile = {
  rawNotes: [],
  age: 24,
  areaType: 'rural',
  state: 'Karnataka',
  socialCategory: 'sc',
  annualIncome: 200_000,
  businessSector: 'poultry',
  businessStage: 'new',
  businessStatus: 'idea',
  investmentRequired: 300_000,
}

const TAILORING_PROFILE: UserProfile = {
  rawNotes: [],
  age: 47,
  gender: 'female',
  state: 'Kerala',
  businessSector: 'tailoring',
  businessStage: 'existing_expansion',
  businessStatus: 'existing',
  annualIncome: 600_000,
  financingRequired: 800_000,
}

describe('evaluateEligibility — NSFDC Micro Finance (SC-targeted)', () => {
  it('is at least a possible match for an SC applicant within the income ceiling, even though the ₹1.25L loan cap is smaller than a ₹3L need', () => {
    const result = evaluateEligibility(POULTRY_PROFILE, scheme('nsfdc-micro-finance'))
    expect(['likely_eligible', 'possibly_eligible']).toContain(result.status)
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('is a full likely match on the NSFDC Term Loan variant, which comfortably covers the ₹3L need', () => {
    const result = evaluateEligibility(POULTRY_PROFILE, scheme('nsfdc-term-loan'))
    expect(result.status).toBe('likely_eligible')
    expect(result.mismatchReasons).toHaveLength(0)
  })

  it('is likely ineligible when income exceeds the ceiling, even for an SC applicant', () => {
    const overIncome: UserProfile = { ...POULTRY_PROFILE, annualIncome: 900_000 }
    const result = evaluateEligibility(overIncome, scheme('nsfdc-micro-finance'))
    expect(result.status).toBe('likely_ineligible')
    expect(result.mismatchReasons.some((m) => /income/i.test(m))).toBe(true)
  })

  it('is likely ineligible for a non-SC applicant', () => {
    const generalProfile: UserProfile = { ...POULTRY_PROFILE, socialCategory: 'general' }
    const result = evaluateEligibility(generalProfile, scheme('nsfdc-micro-finance'))
    expect(result.status).toBe('likely_ineligible')
    expect(result.mismatchReasons.some((m) => /category/i.test(m))).toBe(true)
  })

  it('reports insufficient_data for a near-empty profile', () => {
    const result = evaluateEligibility(EMPTY_PROFILE, scheme('nsfdc-micro-finance'))
    expect(result.status).toBe('insufficient_data')
    expect(result.missingInfo.length).toBeGreaterThanOrEqual(2)
  })
})

describe('evaluateEligibility — PMEGP negative list', () => {
  it('flags a poultry-farming business as likely ineligible (excluded activity)', () => {
    const result = evaluateEligibility(POULTRY_PROFILE, scheme('pmegp'))
    expect(result.status).toBe('likely_ineligible')
    expect(result.mismatchReasons.some((m) => /excluded/i.test(m))).toBe(true)
  })

  it('is a plausible match for a new retail business (not on the negative list)', () => {
    const retailProfile: UserProfile = { ...POULTRY_PROFILE, businessSector: 'retail' }
    const result = evaluateEligibility(retailProfile, scheme('pmegp'))
    expect(result.status).not.toBe('likely_ineligible')
  })
})

describe('evaluateEligibility — PM Mudra Yojana (sector-agnostic, covers poultry)', () => {
  it('supports a poultry business as an activity allied to agriculture', () => {
    const result = evaluateEligibility(POULTRY_PROFILE, scheme('pm-mudra-yojana'))
    expect(result.status).not.toBe('likely_ineligible')
  })

  it('also supports an existing tailoring business expanding', () => {
    const result = evaluateEligibility(TAILORING_PROFILE, scheme('pm-mudra-yojana'))
    expect(result.status).not.toBe('likely_ineligible')
  })
})

describe('evaluateEligibility — Stand-Up India (greenfield + SC/ST-or-woman gate)', () => {
  it('is likely ineligible for an existing-business expansion (not greenfield)', () => {
    const result = evaluateEligibility(TAILORING_PROFILE, scheme('stand-up-india'))
    expect(result.status).toBe('likely_ineligible')
    expect(result.mismatchReasons.some((m) => /greenfield/i.test(m))).toBe(true)
  })

  it('passes the demographic gate for a woman even without a stated caste category', () => {
    const newBusinessWoman: UserProfile = {
      rawNotes: [],
      gender: 'female',
      age: 30,
      businessStage: 'new',
      businessStatus: 'idea',
    }
    const result = evaluateEligibility(newBusinessWoman, scheme('stand-up-india'))
    expect(result.reasons.some((r) => /demographic eligibility group/i.test(r))).toBe(true)
  })

  it('hard-fails the demographic gate for a general-category man', () => {
    const generalMan: UserProfile = {
      rawNotes: [],
      gender: 'male',
      socialCategory: 'general',
      age: 30,
      businessStage: 'new',
    }
    const result = evaluateEligibility(generalMan, scheme('stand-up-india'))
    expect(result.status).toBe('likely_ineligible')
    expect(result.mismatchReasons.some((m) => /SC\/ST or a woman/i.test(m))).toBe(true)
  })
})

describe('evaluateEligibility — Kudumbashree (Kerala, women only)', () => {
  it('matches a Kerala woman', () => {
    const result = evaluateEligibility(TAILORING_PROFILE, scheme('kudumbashree-microenterprise'))
    expect(result.status).not.toBe('likely_ineligible')
  })

  it('hard-fails for a man', () => {
    const man: UserProfile = { ...TAILORING_PROFILE, gender: 'male' }
    const result = evaluateEligibility(man, scheme('kudumbashree-microenterprise'))
    expect(result.status).toBe('likely_ineligible')
  })

  it('hard-fails for a different state even when female', () => {
    const karnatakaWoman: UserProfile = { ...TAILORING_PROFILE, state: 'Karnataka' }
    const result = evaluateEligibility(karnatakaWoman, scheme('kudumbashree-microenterprise'))
    expect(result.status).toBe('likely_ineligible')
  })
})

describe('evaluateEligibility — malformed / minimal scheme data', () => {
  it('does not throw and returns a sane result for a scheme with empty eligibility criteria', () => {
    const bareScheme: GovernmentScheme = {
      id: 'test-bare-scheme',
      name: 'Test Scheme',
      description: 'test',
      ministry: 'test',
      scope: 'central',
      eligibility: {},
      documents: [],
      applicationSteps: [],
      officialApplicationUrl: 'https://example.gov.in',
      officialInfoUrl: 'https://example.gov.in',
      source: 'test',
      sourceUrl: 'https://example.gov.in',
      lastVerifiedDate: '2026-01-01',
      confidence: 'reference',
      tags: [],
    }
    expect(() => evaluateEligibility(POULTRY_PROFILE, bareScheme)).not.toThrow()
    const result = evaluateEligibility(POULTRY_PROFILE, bareScheme)
    expect(result.mismatchReasons).toHaveLength(0)
    expect(['likely_eligible', 'possibly_eligible', 'insufficient_data']).toContain(result.status)
  })

  it('does not throw for a fully empty user profile against every dataset scheme', () => {
    for (const s of SCHEMES) {
      expect(() => evaluateEligibility(EMPTY_PROFILE, s)).not.toThrow()
    }
  })
})
