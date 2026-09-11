/**
 * NSFDC Micro Finance & Term Loan — SIH26091.
 * All internal money math is integer **paise** (Rule 1).
 * Display converts paise → rupees only at the edge.
 */

import { MORATORIUM_INTEREST_POLICY, NSFDC } from './config'

export const MICRO_CAP = NSFDC.microProjectCapRupees
export const TERM_CAP = NSFDC.termProjectCapRupees
export const MARGIN_RATIO = NSFDC.marginRatio
export const LOAN_RATIO = NSFDC.loanRatio
export { MORATORIUM_INTEREST_POLICY }

export type SchemeId = 'micro_finance' | 'term_loan' | 'over_limit' | 'under_margin'

export interface SchemePlan {
  schemeId: SchemeId
  schemeName: string
  schemeNameKn: string
  projectCost: number
  loanAmount: number
  marginRequired: number
  interestRate: number
  tenureYears: number
  moratoriumMonths: number
  quarterlyEmi: number
  repaymentQuarters: number
  schedule: Array<{
    quarter: number
    dueDateLabel: string
    principal: number
    interest: number
    total: number
    status: 'moratorium' | 'repayment'
  }>
  /** @deprecated use workingCapital module — kept for LokScore opsCostMonthly coupling */
  workingCapitalHint: number
  opsCostMonthly: number
  moratoriumPolicy: typeof MORATORIUM_INTEREST_POLICY
  /** Remaining principal after full schedule (must be 0 for in-scope schemes). */
  closingPrincipalPaise: number
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function fromPaise(paise: number): number {
  return paise / 100
}

function interestPaise(balancePaise: number, annualRate: number): number {
  // quarterly rate on paise, round to nearest paise
  return Math.round((balancePaise * annualRate) / 100 / 4)
}

export function buildSchemePlan(availableMarginRupees: number, startDate = new Date()): SchemePlan {
  if (!Number.isFinite(availableMarginRupees) || availableMarginRupees <= 0) {
    return emptyPlan('under_margin', 0, 0, availableMarginRupees || 0)
  }

  const marginPaise = toPaise(availableMarginRupees)
  const projectPaise = marginPaise * 10 // ÷ 10% ⇒ ×10
  const rawLoanPaise = Math.round(projectPaise * NSFDC.loanRatio)
  const projectCost = fromPaise(projectPaise)

  if (projectPaise <= toPaise(NSFDC.microProjectCapRupees)) {
    const loanPaise = Math.min(rawLoanPaise, toPaise(NSFDC.microLoanCapRupees))
    return computePlan({
      schemeId: 'micro_finance',
      schemeName: 'NSFDC Micro Finance Scheme',
      schemeNameKn: 'ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ಮೈಕ್ರೋ ಫೈನಾನ್ಸ್ ಯೋಜನೆ',
      projectPaise,
      loanPaise,
      marginPaise,
      interestRate: NSFDC.microRate,
      tenureYears: NSFDC.microTenureYears,
      moratoriumMonths: NSFDC.microMoratoriumMonths,
      startDate,
      opsCostMonthlyPaise: Math.round(projectPaise * 0.04),
      workingCapitalHintPaise: Math.round(projectPaise * 0.18),
    })
  }

  if (projectPaise <= toPaise(NSFDC.termProjectCapRupees)) {
    const loanPaise = Math.min(rawLoanPaise, toPaise(NSFDC.termLoanCapRupees))
    return computePlan({
      schemeId: 'term_loan',
      schemeName: 'NSFDC Term Loan Scheme',
      schemeNameKn: 'ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ಟರ್ಮ್ ಲೋನ್ ಯೋಜನೆ',
      projectPaise,
      loanPaise,
      marginPaise,
      interestRate: NSFDC.termRate,
      tenureYears: NSFDC.termTenureYears,
      moratoriumMonths: NSFDC.termMoratoriumMonths,
      startDate,
      opsCostMonthlyPaise: Math.round(projectPaise * 0.035),
      workingCapitalHintPaise: Math.round(projectPaise * 0.15),
    })
  }

  return emptyPlan('over_limit', projectCost, fromPaise(rawLoanPaise), availableMarginRupees)
}

function emptyPlan(
  schemeId: SchemeId,
  projectCost: number,
  loanAmount: number,
  marginRequired: number,
): SchemePlan {
  const names =
    schemeId === 'over_limit'
      ? {
          schemeName: `Above NSFDC Term Loan Cap (₹50L). Max margin capital ₹${NSFDC.maxMarginRupees.toLocaleString('en-IN')}.`,
          schemeNameKn: `ಎನ್‌ಎಸ್‌ಎಫ್‌ಡಿಸಿ ಮಿತಿ ಮೀರಿದೆ (₹50 ಲಕ್ಷ). ಗರಿಷ್ಠ ಮಾರ್ಜಿನ್ ₹${NSFDC.maxMarginRupees.toLocaleString('en-IN')}.`,
        }
      : {
          schemeName: 'Enter a positive margin capital to unlock schemes',
          schemeNameKn: 'ಯೋಜನೆಗಳಿಗೆ ಧನಾತ್ಮಕ ಮಾರ್ಜಿನ್ ಬಂಡವಾಳ ನಮೂದಿಸಿ',
        }
  return {
    schemeId,
    ...names,
    projectCost,
    loanAmount,
    marginRequired,
    interestRate: 0,
    tenureYears: 0,
    moratoriumMonths: 0,
    quarterlyEmi: 0,
    repaymentQuarters: 0,
    schedule: [],
    workingCapitalHint: 0,
    opsCostMonthly: 0,
    moratoriumPolicy: MORATORIUM_INTEREST_POLICY,
    closingPrincipalPaise: 0,
  }
}

function computePlan(input: {
  schemeId: SchemeId
  schemeName: string
  schemeNameKn: string
  projectPaise: number
  loanPaise: number
  marginPaise: number
  interestRate: number
  tenureYears: number
  moratoriumMonths: number
  startDate: Date
  opsCostMonthlyPaise: number
  workingCapitalHintPaise: number
}): SchemePlan {
  const totalQuarters = input.tenureYears * 4
  const moratoriumQuarters = input.moratoriumMonths / 3
  const repaymentQuarters = totalQuarters - moratoriumQuarters

  // Equal principal in paise; final repayment quarter absorbs residue (Rule 3).
  const basePrincipal = Math.floor(input.loanPaise / repaymentQuarters)
  let allocated = 0

  let remaining = input.loanPaise
  const schedule: SchemePlan['schedule'] = []
  let repayIndex = 0

  for (let q = 1; q <= totalQuarters; q++) {
    const due = new Date(input.startDate)
    due.setMonth(due.getMonth() + q * 3)
    const dueDateLabel = due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

    if (q <= moratoriumQuarters) {
      const interest = interestPaise(remaining, input.interestRate)
      schedule.push({
        quarter: q,
        dueDateLabel,
        principal: fromPaise(0),
        interest: fromPaise(interest),
        total: fromPaise(interest),
        status: 'moratorium',
      })
    } else {
      repayIndex += 1
      const interest = interestPaise(remaining, input.interestRate)
      const isLast = repayIndex === repaymentQuarters
      const principalPaise = isLast ? remaining : Math.min(basePrincipal, remaining)
      if (!isLast) allocated += principalPaise
      remaining -= principalPaise
      schedule.push({
        quarter: q,
        dueDateLabel,
        principal: fromPaise(principalPaise),
        interest: fromPaise(interest),
        total: fromPaise(principalPaise + interest),
        status: 'repayment',
      })
    }
  }

  const firstRepay = schedule.find((s) => s.status === 'repayment')
  return {
    schemeId: input.schemeId,
    schemeName: input.schemeName,
    schemeNameKn: input.schemeNameKn,
    projectCost: fromPaise(input.projectPaise),
    loanAmount: fromPaise(input.loanPaise),
    marginRequired: fromPaise(input.marginPaise),
    interestRate: input.interestRate,
    tenureYears: input.tenureYears,
    moratoriumMonths: input.moratoriumMonths,
    quarterlyEmi: firstRepay?.total ?? 0,
    repaymentQuarters,
    schedule,
    workingCapitalHint: fromPaise(input.workingCapitalHintPaise),
    opsCostMonthly: fromPaise(input.opsCostMonthlyPaise),
    moratoriumPolicy: MORATORIUM_INTEREST_POLICY,
    closingPrincipalPaise: remaining,
  }
}

export function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}
