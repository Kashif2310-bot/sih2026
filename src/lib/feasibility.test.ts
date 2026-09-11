import { describe, expect, it } from 'vitest'
import { VILLAGES } from '../data/villages'
import { buildFeasibility } from './feasibility'
import { buildSchemePlan } from './finance'
import { REACH_KM } from './config'
import type { EntrepreneurProfile, WeatherSignal } from './lokScore'
import { curatedLocationFromVillage } from './resolveLocation'

const profile: EntrepreneurProfile = {
  name: 'Lakshmi S.',
  age: 29,
  gender: 'female',
  community: 'sc',
  annualIncome: 180_000,
  experienceYears: 2,
  villageId: 'dinka-mandya',
  category: 'dairy',
  availableMargin: 100_000,
  locationMode: 'curated',
  radiusKm: REACH_KM.default,
}

const weather: WeatherSignal = {
  tempMax: 31,
  tempMin: 22,
  precipProb: 40,
  precipMm: 2,
  code: 2,
  summary: 'Partly cloudy',
  summaryKn: 'ಭಾಗಶಃ ಮೋಡ',
  source: 'live',
}

const location = curatedLocationFromVillage(VILLAGES[0], REACH_KM.default)
const plan = buildSchemePlan(100_000)

describe('buildFeasibility', () => {
  it('returns SWOT-like arrays, pricing, channels, density', () => {
    const report = buildFeasibility({
      profile,
      location,
      weather,
      mandi: {
        commodity: 'Cow Milk',
        market: 'Mandya APMC',
        modalPrice: 42,
        minPrice: 38,
        maxPrice: 46,
        unit: '₹/litre',
        trend: 'flat',
        changePct: 0,
        source: 'seeded',
      },
      plan,
      lang: 'en',
    })
    expect(report.strengths.length).toBeGreaterThan(0)
    expect(report.weaknesses.length).toBeGreaterThan(0)
    expect(report.opportunities.length).toBeGreaterThan(0)
    expect(report.threats.length).toBeGreaterThan(0)
    expect(report.channels.length).toBeGreaterThan(0)
    expect(report.pricing.optimal).toBeGreaterThan(0)
    expect(report.reach).toBeGreaterThan(0)
    expect(report.saturationLabel).toBeTruthy()
  })

  it('emits Kannada content when lang=kn', () => {
    const report = buildFeasibility({
      profile,
      location,
      weather,
      mandi: null,
      plan,
      lang: 'kn',
    })
    expect(report.strengths.join(' ')).toMatch(/ಮಾರ್ಜಿನ್|ಗ್ರಾಹಕ|ಕಿ\.ಮೀ/)
  })
})
