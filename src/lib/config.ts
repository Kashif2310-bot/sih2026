/** Named constants — MASTER_SPEC Rule 10. Do not scatter magic numbers in UI. */

import type { BusinessCategory } from '../data/villages'

export const LOKSCORE_WEIGHTS = {
  demand: 0.25,
  competitionGap: 0.2,
  weather: 0.15,
  finance: 0.25,
  eligibility: 0.15,
} as const

export const QUORUM_THRESHOLDS = {
  high: 80, // ≥ → 2-of-3
  mid: 60, // ≥ → 3-of-5; below → 4-of-5 + mentor
} as const

export const REACH_KM = {
  min: 5,
  max: 10,
  default: 7,
} as const

/** Moratorium interest is billed each moratorium quarter; principal is not capitalised. */
export const MORATORIUM_INTEREST_POLICY = 'payable_not_capitalised' as const

export const MORATORIUM_POLICY_LABEL = {
  en: 'Moratorium policy: interest is payable each moratorium quarter; principal is not capitalised into the loan.',
  kn: 'ಮೊರಟೋರಿಯಂ ನೀತಿ: ಪ್ರತಿ ಮೊರಟೋರಿಯಂ ತ್ರೈಮಾಸಿಕದಲ್ಲಿ ಬಡ್ಡಿ ಪಾವತಿ; ಮೂಲಧನ ಸಾಲಕ್ಕೆ ಸೇರಿಸಲಾಗುವುದಿಲ್ಲ.',
} as const

/** Working-capital cycle length (months of opex to hold). */
export const WC_CYCLE_MONTHS: Record<BusinessCategory, number> = {
  dairy: 1.5,
  food: 1,
  retail: 1.5,
  textiles: 3,
  poultry: 2,
  agri_processing: 2,
}

/** Share of monthly opex by line item (sums to 1). */
export const WC_OPEX_SPLIT = {
  rawMaterial: 0.45,
  labour: 0.25,
  utilities: 0.15,
  transportRent: 0.15,
} as const

export const NSFDC = {
  marginRatio: 0.1,
  loanRatio: 0.9,
  microProjectCapRupees: 140_000,
  microLoanCapRupees: 125_000,
  termProjectCapRupees: 5_000_000,
  termLoanCapRupees: 4_500_000,
  microRate: 6.5,
  termRate: 8,
  microTenureYears: 3,
  termTenureYears: 7,
  microMoratoriumMonths: 3,
  termMoratoriumMonths: 6,
  maxMarginRupees: 500_000,
} as const

export const OVERPASS_TIMEOUT_MS = 12_000
export const NOMINATIM_TIMEOUT_MS = 10_000
