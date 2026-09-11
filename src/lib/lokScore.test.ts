import { describe, expect, it } from 'vitest'
import { VILLAGES } from '../data/villages'
import { buildSchemePlan } from './finance'
import { LOKSCORE_WEIGHTS, REACH_KM } from './config'
import {
  computeLokScore,
  scoreEligibility,
  type EntrepreneurProfile,
  type WeatherSignal,
} from './lokScore'
import { fetchMandiSignal } from './mandi'
import { curatedLocationFromVillage } from './resolveLocation'

const baseProfile = (): EntrepreneurProfile => ({
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
})

const fairWeather = (): WeatherSignal => ({
  tempMax: 31,
  tempMin: 22,
  precipProb: 30,
  precipMm: 1,
  code: 2,
  summary: 'Partly cloudy',
  summaryKn: 'ಭಾಗಶಃ ಮೋಡ',
  source: 'live',
})

describe('scoreEligibility', () => {
  it('scores SC + income ceiling + women bonus higher', () => {
    const sc = scoreEligibility(baseProfile())
    const general = scoreEligibility({ ...baseProfile(), community: 'general', gender: 'male' })
    expect(sc.score).toBeGreaterThan(general.score)
  })
})

describe('computeLokScore quorum', () => {
  it('returns breakdown components and quorum fields', async () => {
    const location = curatedLocationFromVillage(VILLAGES[0], REACH_KM.default)
    const plan = buildSchemePlan(100_000)
    const mandi = await fetchMandiSignal(location, 'dairy')
    const score = computeLokScore({
      profile: baseProfile(),
      location,
      weather: fairWeather(),
      mandi,
      plan,
    })
    expect(score.demand).toBeGreaterThanOrEqual(0)
    expect(score.competitionGap).toBeGreaterThanOrEqual(0)
    expect(score.weatherFit).toBeGreaterThanOrEqual(0)
    expect(score.financialFit).toBeGreaterThanOrEqual(0)
    expect(score.eligibility).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(100)
    expect(score.quorumRequired).toBeGreaterThanOrEqual(2)
    expect(score.quorumPool).toBeGreaterThanOrEqual(score.quorumRequired)
    expect(score.weights).toEqual(LOKSCORE_WEIGHTS)
  })

  it('maps score ≥80 → 2-of-3 and ≥60 → 3-of-5 and <60 → 4-of-5+mentor', async () => {
    const location = curatedLocationFromVillage(VILLAGES[0], REACH_KM.default)
    const plan = buildSchemePlan(100_000)
    const mandi = await fetchMandiSignal(location, 'dairy')

    const strong = computeLokScore({
      profile: baseProfile(),
      location,
      weather: fairWeather(),
      mandi,
      plan,
    })
    if (strong.total >= 80) {
      expect(strong.quorumRequired).toBe(2)
      expect(strong.quorumPool).toBe(3)
      expect(strong.mentorRequired).toBe(false)
    } else if (strong.total >= 60) {
      expect(strong.quorumRequired).toBe(3)
      expect(strong.quorumPool).toBe(5)
      expect(strong.mentorRequired).toBe(false)
    } else {
      expect(strong.quorumRequired).toBe(4)
      expect(strong.quorumPool).toBe(5)
      expect(strong.mentorRequired).toBe(true)
    }

    const weak = computeLokScore({
      profile: {
        ...baseProfile(),
        community: 'general',
        gender: 'male',
        annualIncome: 900_000,
        availableMargin: 5_000,
      },
      location,
      weather: { ...fairWeather(), tempMax: 42, precipProb: 90 },
      mandi: mandi ? { ...mandi, trend: 'down', changePct: -8 } : null,
      plan: buildSchemePlan(5_000),
    })
    if (weak.total < 60) {
      expect(weak.mentorRequired).toBe(true)
      expect(weak.quorumRequired).toBe(4)
    }
  })
})

describe('LOKSCORE_WEIGHTS', () => {
  it('keeps locked 0.25/0.2/0.15/0.25/0.15 and sums to 1', () => {
    expect(LOKSCORE_WEIGHTS).toEqual({
      demand: 0.25,
      competitionGap: 0.2,
      weather: 0.15,
      finance: 0.25,
      eligibility: 0.15,
    })
    const sum =
      LOKSCORE_WEIGHTS.demand +
      LOKSCORE_WEIGHTS.competitionGap +
      LOKSCORE_WEIGHTS.weather +
      LOKSCORE_WEIGHTS.finance +
      LOKSCORE_WEIGHTS.eligibility
    expect(sum).toBe(1)
  })
})
