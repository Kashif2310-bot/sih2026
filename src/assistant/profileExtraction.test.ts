import { describe, expect, it } from 'vitest'
import { EMPTY_PROFILE } from './types'
import { extractAndMerge, extractProfileFromMessage } from './profileExtraction'
import { identifyMissingFields, effectiveFinancingNeed } from './missingFields'

describe('extractProfileFromMessage — demo scenario 1 (poultry, Karnataka, SC)', () => {
  const text =
    'I am 24 years old, from rural Karnataka, SC, my annual income is about ₹2 lakh, and I want to start a poultry business requiring ₹3 lakh.'
  const extracted = extractProfileFromMessage(text)

  it('extracts age, area type, state, category, income, sector, stage and investment', () => {
    expect(extracted.age).toBe(24)
    expect(extracted.areaType).toBe('rural')
    expect(extracted.state).toBe('Karnataka')
    expect(extracted.socialCategory).toBe('sc')
    expect(extracted.annualIncome).toBe(200_000)
    expect(extracted.businessSector).toBe('poultry')
    expect(extracted.businessStage).toBe('new')
    expect(extracted.businessStatus).toBe('idea')
    expect(extracted.investmentRequired).toBe(300_000)
  })
})

describe('extractProfileFromMessage — demo scenario 2 (tailoring, Kerala, woman, expansion)', () => {
  const text =
    'I am a 47-year-old woman in Kerala with an existing tailoring business. I earn ₹6 lakh annually and need ₹8 lakh to expand.'
  const extracted = extractProfileFromMessage(text)

  it('extracts age, gender, state, sector, stage, income and financing need', () => {
    expect(extracted.age).toBe(47)
    expect(extracted.gender).toBe('female')
    expect(extracted.state).toBe('Kerala')
    expect(extracted.businessSector).toBe('tailoring')
    expect(extracted.businessStage).toBe('existing_expansion')
    expect(extracted.businessStatus).toBe('existing')
    expect(extracted.annualIncome).toBe(600_000)
    expect(extracted.financingRequired).toBe(800_000)
  })

  it('produces a materially different profile from scenario 1', () => {
    const other = extractProfileFromMessage(
      'I am 24 years old, from rural Karnataka, SC, my annual income is about ₹2 lakh, and I want to start a poultry business requiring ₹3 lakh.',
    )
    expect(extracted.state).not.toBe(other.state)
    expect(extracted.businessSector).not.toBe(other.businessSector)
    expect(extracted.businessStage).not.toBe(other.businessStage)
  })
})

describe('extractProfileFromMessage — edge cases', () => {
  it('returns an empty extraction for an empty string without throwing', () => {
    expect(() => extractProfileFromMessage('')).not.toThrow()
    expect(extractProfileFromMessage('')).toEqual({})
  })

  it('does not misread a bare age number as a rupee amount', () => {
    const extracted = extractProfileFromMessage('I am 30 years old.')
    expect(extracted.age).toBe(30)
    expect(extracted.annualIncome).toBeUndefined()
    expect(extracted.investmentRequired).toBeUndefined()
  })

  it('does not treat "St." or "1st" as a Scheduled Tribe mention', () => {
    const extracted = extractProfileFromMessage('I live on 1st Main St. in the city.')
    expect(extracted.socialCategory).toBeUndefined()
  })

  it('handles nonsense/garbled input gracefully', () => {
    expect(() => extractProfileFromMessage('asdkjasjd 123 ###@@ %%%')).not.toThrow()
  })

  it('recognizes "retail business" phrasing, not just "retail shop"', () => {
    const extracted = extractProfileFromMessage('I want to start a retail business requiring ₹12 lakh.')
    expect(extracted.businessSector).toBe('retail')
  })
})

describe('mergeProfile / extractAndMerge', () => {
  it('merges new fields into an existing profile, overwriting on new evidence', () => {
    const first = extractAndMerge('I am from Karnataka and want to start a poultry business.', EMPTY_PROFILE)
    expect(first.profile.state).toBe('Karnataka')
    expect(first.profile.businessSector).toBe('poultry')

    const second = extractAndMerge('Actually I am based in Kerala now.', first.profile)
    expect(second.profile.state).toBe('Kerala')
    expect(second.profile.businessSector).toBe('poultry') // untouched field persists
    expect(second.updatedFields).toContain('state')
  })
})

describe('identifyMissingFields', () => {
  it('flags sector as top priority when nothing is known', () => {
    const missing = identifyMissingFields(EMPTY_PROFILE)
    expect(missing[0].field).toBe('businessSector')
  })

  it('does not flag a field once it is known', () => {
    const missing = identifyMissingFields({ ...EMPTY_PROFILE, businessSector: 'poultry' })
    expect(missing.some((m) => m.field === 'businessSector')).toBe(false)
  })

  it('only asks about existing loans when the business status is existing', () => {
    const idea = identifyMissingFields({ ...EMPTY_PROFILE, businessStatus: 'idea' })
    const existing = identifyMissingFields({ ...EMPTY_PROFILE, businessStatus: 'existing' })
    expect(idea.some((m) => m.field === 'existingLoans')).toBe(false)
    expect(existing.some((m) => m.field === 'existingLoans')).toBe(true)
  })
})

describe('effectiveFinancingNeed', () => {
  it('prefers an explicit financing requirement over investment size', () => {
    expect(effectiveFinancingNeed({ ...EMPTY_PROFILE, financingRequired: 800_000, investmentRequired: 1_000_000 })).toBe(
      800_000,
    )
  })

  it('falls back to investment minus own contribution', () => {
    expect(
      effectiveFinancingNeed({ ...EMPTY_PROFILE, investmentRequired: 300_000, ownContribution: 50_000 }),
    ).toBe(250_000)
  })

  it('is undefined when nothing is known', () => {
    expect(effectiveFinancingNeed(EMPTY_PROFILE)).toBeUndefined()
  })
})
