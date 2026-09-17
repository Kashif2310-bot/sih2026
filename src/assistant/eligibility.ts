/**
 * Deterministic eligibility engine.
 *
 * This is the ONLY place a match score or eligibility status is computed.
 * The AI layer (ai/*) is only ever given the output of this module as
 * evidence to explain in natural language — it must never invent or
 * re-derive a score itself.
 *
 * Status rules (in order):
 *   1. Any hard mismatch (a criterion the scheme states as a strict gate,
 *      and the profile clearly fails it) -> 'likely_ineligible'.
 *   2. Two or more important criteria we couldn't check at all (profile
 *      missing the relevant field) -> 'insufficient_data'.
 *   3. Otherwise, score >= 70 -> 'likely_eligible'; >= 45 -> 'possibly_eligible';
 *      below that -> 'likely_ineligible' (weak match, nothing outright
 *      disqualifies, but little in the profile supports a strong match).
 *
 * Wording is deliberately hedged everywhere ("potential match", "requires
 * official verification") — this engine never claims a guaranteed or
 * approved outcome.
 */

import { normalizeSectorLabel } from './lexicon'
import { effectiveFinancingNeed } from './missingFields'
import type { EligibilityResult, EligibilityStatus, GovernmentScheme, UserProfile } from './types'

const LOAN_TOLERANCE = 1.15

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

interface ScoreState {
  score: number
  reasons: string[]
  mismatchReasons: string[]
  missingInfo: string[]
  hardMismatch: boolean
  checkedCriteria: number
  dataAvailableCriteria: number
}

function checkDemographicGate(profile: UserProfile, scheme: GovernmentScheme, s: ScoreState) {
  const { genders, socialCategories, eligibleIfAny } = scheme.eligibility

  if (eligibleIfAny && eligibleIfAny.length > 0) {
    s.checkedCriteria += 1
    type GateResult = 'pass' | 'fail' | 'unknown'
    const results: GateResult[] = eligibleIfAny.map((group) => {
      const fieldResults: GateResult[] = []
      if (group.genders) {
        fieldResults.push(profile.gender === undefined ? 'unknown' : group.genders.includes(profile.gender) ? 'pass' : 'fail')
      }
      if (group.socialCategories) {
        fieldResults.push(
          profile.socialCategory === undefined
            ? 'unknown'
            : group.socialCategories.includes(profile.socialCategory)
              ? 'pass'
              : 'fail',
        )
      }
      if (fieldResults.some((r) => r === 'fail')) return 'fail'
      if (fieldResults.every((r) => r === 'pass') && fieldResults.length > 0) return 'pass'
      return 'unknown'
    })

    if (results.includes('pass')) {
      s.dataAvailableCriteria += 1
      s.score += 20
      s.reasons.push('You meet at least one of the demographic eligibility groups for this scheme.')
    } else if (results.every((r) => r === 'fail')) {
      s.dataAvailableCriteria += 1
      s.hardMismatch = true
      s.score -= 60
      s.mismatchReasons.push(
        'This scheme requires the applicant to be SC/ST or a woman; the profile matches neither.',
      )
    } else {
      s.missingInfo.push('social category and/or gender (needed to check an SC/ST-or-woman eligibility rule)')
      s.score -= 3
    }
    return
  }

  if (genders) {
    s.checkedCriteria += 1
    if (profile.gender === undefined) {
      s.missingInfo.push('gender')
      s.score -= 3
    } else {
      s.dataAvailableCriteria += 1
      if (genders.includes(profile.gender)) {
        s.score += 12
        s.reasons.push(`This scheme targets ${genders.join('/')} applicants, which matches your profile.`)
      } else {
        s.hardMismatch = true
        s.score -= 40
        s.mismatchReasons.push(`This scheme is restricted to ${genders.join('/')} applicants.`)
      }
    }
  }

  if (socialCategories) {
    s.checkedCriteria += 1
    if (profile.socialCategory === undefined) {
      s.missingInfo.push('social category (SC/ST/OBC/General)')
      s.score -= 5
    } else {
      s.dataAvailableCriteria += 1
      if (socialCategories.includes(profile.socialCategory)) {
        s.score += 15
        s.reasons.push(`Your ${profile.socialCategory.toUpperCase()} category matches this scheme's target group.`)
      } else {
        s.hardMismatch = true
        s.score -= 50
        s.mismatchReasons.push(
          `This scheme's target social category is ${socialCategories.map((c) => c.toUpperCase()).join('/')}; your profile's category is ${profile.socialCategory.toUpperCase()}.`,
        )
      }
    }
  }
}

export function evaluateEligibility(profile: UserProfile, scheme: GovernmentScheme): EligibilityResult {
  const e = scheme.eligibility
  const s: ScoreState = {
    score: 50,
    reasons: [],
    mismatchReasons: [],
    missingInfo: [],
    hardMismatch: false,
    checkedCriteria: 0,
    dataAvailableCriteria: 0,
  }

  // Geography.
  if (scheme.scope === 'state') {
    s.checkedCriteria += 1
    if (!profile.state) {
      s.missingInfo.push('state')
      s.score -= 5
    } else {
      s.dataAvailableCriteria += 1
      if (scheme.state && profile.state.toLowerCase() === scheme.state.toLowerCase()) {
        s.score += 15
        s.reasons.push(`You are in ${scheme.state}, which this state scheme covers.`)
      } else {
        s.hardMismatch = true
        s.score -= 60
        s.mismatchReasons.push(`This is a ${scheme.state}-only scheme; your profile shows ${profile.state}.`)
      }
    }
  } else if (e.states && e.states.length > 0) {
    s.checkedCriteria += 1
    if (!profile.state) {
      s.missingInfo.push('state')
      s.score -= 3
    } else {
      s.dataAvailableCriteria += 1
      const match = e.states.some((st) => st.toLowerCase() === profile.state!.toLowerCase())
      if (match) {
        s.score += 8
      } else {
        s.hardMismatch = true
        s.mismatchReasons.push(`This scheme is limited to ${e.states.join(', ')}; your profile shows ${profile.state}.`)
      }
    }
  }

  // Rural / urban.
  if (e.areaTypes) {
    s.checkedCriteria += 1
    if (!profile.areaType) {
      s.missingInfo.push('rural/urban area type')
      s.score -= 3
    } else {
      s.dataAvailableCriteria += 1
      if (e.areaTypes.includes(profile.areaType)) {
        s.score += 8
        s.reasons.push(`Available to ${profile.areaType} applicants.`)
      } else {
        s.hardMismatch = true
        s.score -= 30
        s.mismatchReasons.push(`This scheme applies to ${e.areaTypes.join('/')} applicants; your profile is ${profile.areaType}.`)
      }
    }
  }

  // Age.
  if (e.minAge !== undefined || e.maxAge !== undefined) {
    s.checkedCriteria += 1
    if (profile.age === undefined) {
      s.missingInfo.push('age')
      s.score -= 3
    } else {
      s.dataAvailableCriteria += 1
      const min = e.minAge ?? 0
      const max = e.maxAge ?? 200
      const label = e.maxAge !== undefined ? `${min}–${max}` : `${min}+`
      if (profile.age >= min && profile.age <= max) {
        s.score += 8
        s.reasons.push(`Age ${profile.age} meets the ${label} requirement.`)
      } else {
        s.hardMismatch = true
        s.score -= 40
        s.mismatchReasons.push(`Age requirement is ${label}; profile states age ${profile.age}.`)
      }
    }
  }

  // Gender / social category (including OR-style gates).
  checkDemographicGate(profile, scheme, s)

  // Income ceiling.
  if (e.maxAnnualIncome !== undefined) {
    s.checkedCriteria += 1
    if (profile.annualIncome === undefined) {
      s.missingInfo.push('annual income')
      s.score -= 3
    } else {
      s.dataAvailableCriteria += 1
      if (profile.annualIncome <= e.maxAnnualIncome) {
        s.score += 10
        s.reasons.push(`Annual income ${rupees(profile.annualIncome)} is within the ${rupees(e.maxAnnualIncome)} ceiling.`)
      } else {
        s.hardMismatch = true
        s.score -= 25
        s.mismatchReasons.push(
          `Annual income ${rupees(profile.annualIncome)} exceeds this scheme's ${rupees(e.maxAnnualIncome)} ceiling.`,
        )
      }
    }
  }

  // Business sector.
  if (e.businessSectors && !e.businessSectors.includes('any')) {
    s.checkedCriteria += 1
    if (!profile.businessSector) {
      s.missingInfo.push('business sector')
      s.score -= 8
    } else {
      s.dataAvailableCriteria += 1
      const label = normalizeSectorLabel(profile.businessSector)
      if (e.excludedBusinessSectors?.includes(profile.businessSector)) {
        s.hardMismatch = true
        s.score -= 50
        s.mismatchReasons.push(`${label} is explicitly excluded from this scheme.`)
      } else if (e.businessSectors.includes(profile.businessSector)) {
        s.score += 20
        s.reasons.push(`Supports ${label} businesses.`)
      } else {
        s.score -= 20
        s.mismatchReasons.push(
          `This scheme's documented sectors don't explicitly list ${label} — may still qualify, confirm with the official channel.`,
        )
      }
    }
  } else if (e.excludedBusinessSectors && e.excludedBusinessSectors.length > 0) {
    // Sector-agnostic scheme with a negative list (e.g. PMEGP).
    s.checkedCriteria += 1
    if (!profile.businessSector) {
      s.missingInfo.push('business sector')
      s.score -= 5
    } else {
      s.dataAvailableCriteria += 1
      const label = normalizeSectorLabel(profile.businessSector)
      if (e.excludedBusinessSectors.includes(profile.businessSector)) {
        s.hardMismatch = true
        s.score -= 50
        s.mismatchReasons.push(`${label} is on this scheme's excluded-activities list.`)
      } else {
        s.score += 10
        s.reasons.push(`${label} is not on this scheme's excluded-activities list.`)
      }
    }
  }

  // Business stage (new vs existing / greenfield).
  if (e.businessStages) {
    s.checkedCriteria += 1
    if (!profile.businessStage) {
      s.missingInfo.push('business stage (new vs. existing)')
      s.score -= 5
    } else {
      s.dataAvailableCriteria += 1
      if (e.businessStages.includes(profile.businessStage)) {
        s.score += 10
        s.reasons.push('Matches the business stage this scheme is designed for.')
      } else {
        s.hardMismatch = true
        s.score -= 35
        s.mismatchReasons.push(
          e.requiresGreenfield
            ? 'Requires a new (greenfield) enterprise — not an expansion of an existing business.'
            : 'This scheme targets a different business stage (new vs. existing) than your profile.',
        )
      }
    }
  }

  // Financing need vs loan ceiling/floor (informational, never a hard mismatch).
  const need = effectiveFinancingNeed(profile)
  if (scheme.loanAmount?.maxRupees !== undefined) {
    if (need === undefined) {
      s.missingInfo.push('financing amount needed')
    } else if (need <= scheme.loanAmount.maxRupees * LOAN_TOLERANCE) {
      s.score += 8
      s.reasons.push(`Your ~${rupees(need)} financing need fits within this scheme's ~${rupees(scheme.loanAmount.maxRupees)} limit.`)
    } else {
      s.score -= 10
      s.mismatchReasons.push(
        `This scheme's loan ceiling (~${rupees(scheme.loanAmount.maxRupees)}) is lower than your stated ~${rupees(need)} need — you may need to combine it with another source.`,
      )
    }
  }
  if (scheme.loanAmount?.minRupees !== undefined && need !== undefined && need < scheme.loanAmount.minRupees) {
    s.score -= 10
    s.mismatchReasons.push(
      `This scheme's minimum loan size (~${rupees(scheme.loanAmount.minRupees)}) is larger than your stated ~${rupees(need)} need.`,
    )
  }

  const score = Math.max(0, Math.min(100, Math.round(s.score)))

  let status: EligibilityStatus
  if (s.hardMismatch) {
    status = 'likely_ineligible'
  } else if (s.missingInfo.length >= 2) {
    status = 'insufficient_data'
  } else if (score >= 70) {
    status = 'likely_eligible'
  } else if (score >= 45) {
    status = 'possibly_eligible'
  } else {
    status = 'likely_ineligible'
  }

  const coverage = s.checkedCriteria === 0 ? 1 : s.dataAvailableCriteria / s.checkedCriteria
  const confidence: EligibilityResult['confidence'] = coverage >= 0.75 ? 'high' : coverage >= 0.4 ? 'medium' : 'low'

  return {
    schemeId: scheme.id,
    score,
    status,
    reasons: s.reasons,
    mismatchReasons: s.mismatchReasons,
    missingInfo: s.missingInfo,
    confidence,
  }
}

export const ELIGIBILITY_STATUS_LABEL: Record<EligibilityStatus, string> = {
  likely_eligible: 'Potential match based on the information provided — requires official verification.',
  possibly_eligible: 'Possible match, but some criteria are unclear — requires official verification.',
  likely_ineligible: 'Likely does not match based on the information provided.',
  insufficient_data: 'Not enough information yet to assess this scheme.',
}
