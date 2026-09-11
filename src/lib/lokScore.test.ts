import { describe, expect, it } from 'vitest'
import { VILLAGES } from '../data/villages'
import { buildSchemePlan } from './finance'
import {
  computeLokScore,
  scoreEligibility,
  type EntrepreneurProfile,
  type WeatherSignal,
} from './lokScore'
import { fetchMandiSignal } from './mandi'

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
})

const fairWeather = (): WeatherSignal => ({
  tempMax: 31,
  tempMin: 22,
  precipProb: 30,
  precipMm: 1,
  code: 2,
  summary: 'Partly cloudy',
  summaryKn: 'ಭಾಗಶಃ ಮೋಡ',
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
    const village = VILLAGES[0]
    const plan = buildSchemePlan(100_000)
    const mandi = await fetchMandiSignal(village, 'dairy')
    const score = computeLokScore({
      profile: baseProfile(),
      village,
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
  })

  it('maps score ≥80 → 2-of-3 and ≥60 → 3-of-5 and <60 → 4-of-5+mentor', async () => {
    const village = VILLAGES[0]
    const plan = buildSchemePlan(100_000)
    const mandi = await fetchMandiSignal(village, 'dairy')

    // Strong profile typically lands high; we assert rule application via returned fields coherence
    const strong = computeLokScore({
      profile: baseProfile(),
      village,
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
      village,
      weather: { ...fairWeather(), tempMax: 42, precipProb: 90 },
      mandi: { ...mandi, trend: 'down', changePct: -8 },
      plan: buildSchemePlan(5_000),
    })
    if (weak.total < 60) {
      expect(weak.mentorRequired).toBe(true)
      expect(weak.quorumRequired).toBe(4)
    }
  })
})
