import { describe, expect, it } from 'vitest'
import { rankSchemes } from './ranking'
import type { SchemeRetriever } from './retrieval'
import { EMPTY_PROFILE, type UserProfile } from './types'

const PROFILE_A_POULTRY_KARNATAKA_SC: UserProfile = {
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

const PROFILE_B_TAILORING_KERALA_WOMAN: UserProfile = {
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

const PROFILE_C_RETAIL_GENERAL_URBAN: UserProfile = {
  rawNotes: [],
  age: 35,
  gender: 'male',
  areaType: 'urban',
  state: 'Maharashtra',
  socialCategory: 'general',
  annualIncome: 900_000,
  businessSector: 'retail',
  businessStage: 'new',
  businessStatus: 'idea',
  investmentRequired: 1_200_000,
}

function topIds(profile: UserProfile, n = 3): string[] {
  return rankSchemes(profile)
    .slice(0, n)
    .map((r) => r.scheme.id)
}

function eligibleIds(profile: UserProfile): string[] {
  return rankSchemes(profile)
    .filter((r) => r.eligibility.status === 'likely_eligible' || r.eligibility.status === 'possibly_eligible')
    .map((r) => r.scheme.id)
    .sort()
}

describe('rankSchemes — CRITICAL: materially different profiles produce materially different rankings', () => {
  it('produces a different top-ranked scheme for each of three materially different profiles', () => {
    const topA = topIds(PROFILE_A_POULTRY_KARNATAKA_SC, 1)[0]
    const topB = topIds(PROFILE_B_TAILORING_KERALA_WOMAN, 1)[0]
    const topC = topIds(PROFILE_C_RETAIL_GENERAL_URBAN, 1)[0]

    // Not a hard requirement that all three differ pairwise by construction,
    // but for these three deliberately distinct profiles it must hold —
    // otherwise the assistant is just returning the same answer for everyone.
    expect(new Set([topA, topB, topC]).size).toBe(3)
  })

  it('produces different eligible-scheme sets across the three profiles', () => {
    const setA = eligibleIds(PROFILE_A_POULTRY_KARNATAKA_SC)
    const setB = eligibleIds(PROFILE_B_TAILORING_KERALA_WOMAN)
    const setC = eligibleIds(PROFILE_C_RETAIL_GENERAL_URBAN)

    expect(setA).not.toEqual(setB)
    expect(setB).not.toEqual(setC)
    expect(setA).not.toEqual(setC)
  })

  it('never recommends the Kerala state scheme to the Karnataka profile', () => {
    expect(eligibleIds(PROFILE_A_POULTRY_KARNATAKA_SC)).not.toContain('kudumbashree-microenterprise')
  })

  it('never ranks PMEGP as a likely/possible match for the poultry profile (excluded activity)', () => {
    expect(eligibleIds(PROFILE_A_POULTRY_KARNATAKA_SC)).not.toContain('pmegp')
  })

  it('flags NSFDC schemes as ineligible for profile B (income above ceiling, no SC/ST stated)', () => {
    const rankedB = rankSchemes(PROFILE_B_TAILORING_KERALA_WOMAN)
    const nsfdcMicro = rankedB.find((r) => r.scheme.id === 'nsfdc-micro-finance')!
    expect(nsfdcMicro.eligibility.status).toBe('likely_ineligible')
  })

  it('ranks Kudumbashree highly for profile B (Kerala woman)', () => {
    const rankedB = rankSchemes(PROFILE_B_TAILORING_KERALA_WOMAN)
    const kudumbashreeIndex = rankedB.findIndex((r) => r.scheme.id === 'kudumbashree-microenterprise')
    expect(kudumbashreeIndex).toBeGreaterThanOrEqual(0)
    expect(kudumbashreeIndex).toBeLessThan(3)
  })
})

describe('rankSchemes — provider/retrieval failure and empty-result resilience', () => {
  it('returns an empty array without throwing when the retriever returns no candidates', () => {
    const emptyRetriever: SchemeRetriever = { retrieve: () => [] }
    expect(() => rankSchemes(EMPTY_PROFILE, undefined, emptyRetriever)).not.toThrow()
    expect(rankSchemes(EMPTY_PROFILE, undefined, emptyRetriever)).toEqual([])
  })

  it('propagates a retriever exception rather than silently fabricating results', () => {
    const throwingRetriever: SchemeRetriever = {
      retrieve: () => {
        throw new Error('retrieval backend unavailable')
      },
    }
    expect(() => rankSchemes(EMPTY_PROFILE, undefined, throwingRetriever)).toThrow('retrieval backend unavailable')
  })

  it('still produces a valid ranking for a profile with no fields set', () => {
    expect(() => rankSchemes(EMPTY_PROFILE)).not.toThrow()
    const ranked = rankSchemes(EMPTY_PROFILE)
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked.every((r) => r.eligibility.status === 'insufficient_data' || r.eligibility.status === 'possibly_eligible' || r.eligibility.status === 'likely_ineligible' || r.eligibility.status === 'likely_eligible')).toBe(true)
  })
})
