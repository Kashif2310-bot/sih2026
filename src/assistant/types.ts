/**
 * AI Government Scheme Assistant — core domain types.
 *
 * These types are independent of the existing NSFDC/LokScore domain in
 * src/lib — the assistant is a separate feature and must not change the
 * behaviour of /scan, /pulse, /report, /finance, /sanction, /export.
 */

export type AreaType = 'rural' | 'urban'
export type Gender = 'male' | 'female' | 'other'
export type SocialCategory = 'sc' | 'st' | 'obc' | 'general'
export type BusinessStage = 'idea' | 'new' | 'existing_expansion'
export type SchemeScope = 'central' | 'state'

/**
 * Confidence label for a knowledge-base entry — NOT an eligibility
 * confidence. 'reference' means the entry was manually curated from public
 * scheme documentation and should be re-verified against the official
 * source before being relied upon; it is never "live" government data.
 */
export type SchemeConfidence = 'reference'

export interface UserProfile {
  state?: string
  district?: string
  areaType?: AreaType
  age?: number
  gender?: Gender
  socialCategory?: SocialCategory
  annualIncome?: number
  occupation?: string
  businessStatus?: 'idea' | 'existing'
  proposedBusiness?: string
  /** Normalized sector tag, e.g. 'poultry', 'tailoring' — see SECTOR_KEYWORDS. */
  businessSector?: string
  investmentRequired?: number
  ownContribution?: number
  financingRequired?: number
  existingLoans?: string
  businessStage?: BusinessStage
  education?: string
  landOrAssets?: string
  /** Free-text fragments captured but not mapped to a structured field. */
  rawNotes: string[]
}

export const EMPTY_PROFILE: UserProfile = { rawNotes: [] }

export interface ProfileFieldMeta {
  field: keyof UserProfile
  label: string
  priority: number
  question: string
}

export interface SchemeEligibilityCriteria {
  /** Indian state names this scheme is restricted to. Absent = no state restriction. */
  states?: string[]
  areaTypes?: AreaType[]
  minAge?: number
  maxAge?: number
  genders?: Gender[]
  socialCategories?: SocialCategory[]
  maxAnnualIncome?: number
  /** Sector tags this scheme supports. Absent or including 'any' = sector-agnostic. */
  businessSectors?: string[]
  /** Sector tags explicitly excluded even if businessSectors is broad. */
  excludedBusinessSectors?: string[]
  businessStages?: BusinessStage[]
  requiresGreenfield?: boolean
  minEducationNote?: string
  notes?: string
  /**
   * Some schemes gate on a demographic OR, not AND (e.g. Stand-Up India:
   * SC/ST *or* woman). When present, the applicant must satisfy the base
   * genders/socialCategories fields above, OR at least one of these groups.
   * Leave genders/socialCategories above undefined when the only gate is
   * this OR group.
   */
  eligibleIfAny?: Array<{ genders?: Gender[]; socialCategories?: SocialCategory[] }>
}

export interface SchemeLoanInfo {
  minRupees?: number
  maxRupees?: number
  notes?: string
}

export interface SchemeSubsidyInfo {
  description: string
  ratePercentMin?: number
  ratePercentMax?: number
}

export interface SchemeInterestInfo {
  ratePercent?: number
  notes?: string
}

export interface GovernmentScheme {
  id: string
  name: string
  shortName?: string
  description: string
  ministry: string
  scope: SchemeScope
  /** Present only when scope === 'state'. */
  state?: string
  eligibility: SchemeEligibilityCriteria
  loanAmount?: SchemeLoanInfo
  subsidy?: SchemeSubsidyInfo
  interest?: SchemeInterestInfo
  documents: string[]
  applicationSteps: string[]
  officialApplicationUrl: string
  officialInfoUrl: string
  source: string
  sourceUrl: string
  lastVerifiedDate: string
  confidence: SchemeConfidence
  tags: string[]
}

export type EligibilityStatus =
  | 'likely_eligible'
  | 'possibly_eligible'
  | 'likely_ineligible'
  | 'insufficient_data'

export interface EligibilityResult {
  schemeId: string
  score: number
  status: EligibilityStatus
  reasons: string[]
  mismatchReasons: string[]
  missingInfo: string[]
  confidence: 'low' | 'medium' | 'high'
}

export interface RetrievalResult {
  scheme: GovernmentScheme
  relevance: number
  matchedTags: string[]
}

export interface RankedScheme {
  scheme: GovernmentScheme
  eligibility: EligibilityResult
  relevance: number
  rankScore: number
}
