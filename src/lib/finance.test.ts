import { describe, expect, it } from 'vitest'
import {
  buildSchemePlan,
  MICRO_CAP,
  TERM_CAP,
  toPaise,
  MORATORIUM_INTEREST_POLICY,
  formatINR,
} from '../lib/finance'
import { NSFDC } from '../lib/config'

describe('buildSchemePlan — demo path', () => {
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
    expect(plan.schemeName).toMatch(/Term Loan Scheme/)
  })
})

describe('buildSchemePlan — scheme flip at ₹1.40L', () => {
  it('routes project cost exactly ₹1,40,000 to Micro Finance', () => {
    const plan = buildSchemePlan(14_000)
    expect(plan.projectCost).toBe(140_000)
    expect(plan.projectCost).toBe(MICRO_CAP)
    expect(plan.schemeId).toBe('micro_finance')
    expect(plan.interestRate).toBe(6.5)
    expect(plan.loanAmount).toBe(125_000) // min(90% = 1.26L, 1.25L cap)
    expect(plan.tenureYears).toBe(3)
    expect(plan.moratoriumMonths).toBe(3)
  })

  it('flips to Term Loan at project cost exactly ₹1,40,001', () => {
    const plan = buildSchemePlan(14_000.1)
    expect(plan.projectCost).toBe(140_001)
    expect(plan.projectCost).toBeGreaterThan(MICRO_CAP)
    expect(plan.schemeId).toBe('term_loan')
    expect(plan.interestRate).toBe(8)
  })
})

describe('buildSchemePlan — 90% vs ₹1.25L Micro cap crossover', () => {
  it('uses 90% below the cap and caps at ₹1.25L on/above ₹1,38,888.89 project', () => {
    // 1,25,000 / 0.9 = 1,38,888.8… — integer 90% = floor(projectPaise × 9 / 10)
    const below = buildSchemePlan(138_888.88 / 10)
    expect(below.schemeId).toBe('micro_finance')
    expect(below.projectCost).toBe(138_888.88)
    expect(toPaise(below.loanAmount)).toBe(12_499_999)
    expect(below.loanAmount).toBeLessThan(125_000)

    const at = buildSchemePlan(138_888.89 / 10)
    expect(at.schemeId).toBe('micro_finance')
    expect(at.projectCost).toBe(138_888.89)
    expect(at.loanAmount).toBe(125_000)
  })
})

describe('buildSchemePlan — rejections', () => {
  it('rejects margin 0 / empty / non-finite without dividing by zero', () => {
    for (const m of [0, Number(''), Number.NaN, -1]) {
      const plan = buildSchemePlan(m)
      expect(plan.schemeId).toBe('under_margin')
      expect(plan.schedule).toHaveLength(0)
      expect(plan.loanAmount).toBe(0)
      expect(plan.schemeName.toLowerCase()).toMatch(/0|empty|positive/)
    }
  })

  it('rejects project cost > ₹50L and names the ₹5,00,000 max margin', () => {
    const plan = buildSchemePlan(500_000.1)
    expect(plan.schemeId).toBe('over_limit')
    expect(plan.projectCost).toBeGreaterThan(TERM_CAP)
    expect(plan.schedule).toHaveLength(0)
    expect(plan.schemeName).toMatch(/5,00,000/)
    expect(plan.schemeName).toMatch(/50L/)
  })

  it('at exactly ₹50L project: loan ₹45L Term (not rejected)', () => {
    const plan = buildSchemePlan(500_000)
    expect(plan.projectCost).toBe(TERM_CAP)
    expect(plan.schemeId).toBe('term_loan')
    expect(plan.loanAmount).toBe(4_500_000)
  })
})

describe('buildSchemePlan — annuity schedule', () => {
  it('uses capitalize_into_principal and closes the demo schedule at exactly ₹0.00', () => {
    expect(MORATORIUM_INTEREST_POLICY).toBe('capitalize_into_principal')
    const plan = buildSchemePlan(100_000, new Date('2026-01-01'))
    const mor = plan.schedule.filter((s) => s.status === 'moratorium')
    const repay = plan.schedule.filter((s) => s.status === 'repayment')

    expect(mor).toHaveLength(2)
    expect(mor.every((s) => s.principal === 0 && s.total === 0 && s.interest > 0)).toBe(true)
    expect(repay).toHaveLength(26)

    const emi = repay[0].total
    for (const row of repay.slice(0, -1)) {
      expect(row.total).toBe(emi)
    }

    const last = repay[repay.length - 1]
    expect(toPaise(last.total)).toBe(toPaise(last.principal) + toPaise(last.interest))
    expect(plan.closingPrincipalPaise).toBe(0)

    const accrued = mor.reduce((a, s) => a + toPaise(s.interest), 0)
    expect(plan.capitalizedPrincipalPaise).toBe(toPaise(plan.loanAmount) + accrued)
    const repaidPrincipal = repay.reduce((a, s) => a + toPaise(s.principal), 0)
    expect(repaidPrincipal).toBe(plan.capitalizedPrincipalPaise)
  })

  it('closes Micro Finance schedule to ₹0.00 as well', () => {
    const plan = buildSchemePlan(14_000, new Date('2026-01-01'))
    expect(plan.schemeId).toBe('micro_finance')
    expect(plan.schedule.filter((s) => s.status === 'moratorium')).toHaveLength(1)
    expect(plan.closingPrincipalPaise).toBe(0)
    const last = plan.schedule[plan.schedule.length - 1]
    expect(toPaise(last.total)).toBe(toPaise(last.principal) + toPaise(last.interest))
  })
})

describe('NSFDC constants stay locked', () => {
  it('keeps threshold / rate / tenure / cap numbers', () => {
    expect(NSFDC.microProjectCapRupees).toBe(140_000)
    expect(NSFDC.loanRatio).toBe(0.9)
    expect(NSFDC.microLoanCapRupees).toBe(125_000)
    expect(NSFDC.termLoanCapRupees).toBe(4_500_000)
    expect(NSFDC.microRate).toBe(6.5)
    expect(NSFDC.termRate).toBe(8)
    expect(NSFDC.microTenureYears).toBe(3)
    expect(NSFDC.termTenureYears).toBe(7)
    expect(NSFDC.microMoratoriumMonths).toBe(3)
    expect(NSFDC.termMoratoriumMonths).toBe(6)
  })
})

describe('formatINR', () => {
  it('formats Indian currency', () => {
    expect(formatINR(900_000)).toMatch(/9,?00,?000/)
  })
})
