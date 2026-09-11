import { describe, expect, it } from 'vitest'
import { buildSchemePlan, MICRO_CAP, TERM_CAP, formatINR } from '../lib/finance'

describe('buildSchemePlan', () => {
  it('maps ₹1L margin → ₹10L project / ₹9L Term Loan', () => {
    const plan = buildSchemePlan(100_000, new Date('2026-01-01'))
    expect(plan.schemeId).toBe('term_loan')
    expect(plan.projectCost).toBe(1_000_000)
    expect(plan.loanAmount).toBe(900_000)
    expect(plan.interestRate).toBe(8)
    expect(plan.tenureYears).toBe(7)
    expect(plan.moratoriumMonths).toBe(6)
    expect(plan.repaymentQuarters).toBe(26) // 28 - 2
    expect(plan.schedule).toHaveLength(28)
    expect(plan.schedule.filter((s) => s.status === 'moratorium')).toHaveLength(2)
    expect(plan.workingCapitalHint).toBeGreaterThan(0)
  })

  it('routes project cost ≤ ₹1.40L to Micro Finance', () => {
    const plan = buildSchemePlan(14_000) // project 1.40L
    expect(plan.projectCost).toBe(140_000)
    expect(plan.schemeId).toBe('micro_finance')
    expect(plan.interestRate).toBe(6.5)
    expect(plan.loanAmount).toBe(125_000) // min(90%, 1.25L cap)
  })

  it('flips to Term Loan at ₹1,40,001 project cost', () => {
    const plan = buildSchemePlan(14_000.1)
    expect(plan.projectCost).toBeGreaterThan(MICRO_CAP)
    expect(plan.schemeId).toBe('term_loan')
  })

  it('caps Micro loan at ₹1.25L when 90% would exceed', () => {
    // project 1.40L → 90% = 1.26L → capped 1.25L
    const atCap = buildSchemePlan(14_000)
    expect(atCap.loanAmount).toBe(125_000)

    // just below where 90% hits 1.25L: project = 1.25L/0.9 = 1,388,88.88...
    const below = buildSchemePlan(138_888.88 * 0.1)
    expect(below.schemeId).toBe('micro_finance')
    expect(below.loanAmount).toBeLessThanOrEqual(125_000)
  })

  it('at ₹50L project: loan exactly ₹45L Term', () => {
    const plan = buildSchemePlan(500_000)
    expect(plan.projectCost).toBe(TERM_CAP)
    expect(plan.schemeId).toBe('term_loan')
    expect(plan.loanAmount).toBe(4_500_000)
  })

  it('flags over_limit above ₹50L project', () => {
    const plan = buildSchemePlan(500_000.1)
    expect(plan.schemeId).toBe('over_limit')
  })

  it('rejects non-positive margin as under_margin', () => {
    expect(buildSchemePlan(0).schemeId).toBe('under_margin')
    expect(buildSchemePlan(-1).schemeId).toBe('under_margin')
  })

  it('keeps principal unpaid during moratorium quarters', () => {
    const plan = buildSchemePlan(100_000, new Date('2026-01-01'))
    const mor = plan.schedule.filter((s) => s.status === 'moratorium')
    expect(mor.every((s) => s.principal === 0 && s.interest > 0)).toBe(true)
  })
})

describe('formatINR', () => {
  it('formats Indian currency', () => {
    expect(formatINR(900_000)).toMatch(/9,?00,?000/)
  })
})
