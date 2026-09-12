import type { UserProfile } from './types'

export interface MissingFieldInfo {
  field: keyof UserProfile
  priority: number
  question: string
}

/** How much money the user is actually seeking financing for, when they've only stated a total project/investment size. */
export function effectiveFinancingNeed(profile: UserProfile): number | undefined {
  if (profile.financingRequired !== undefined) return profile.financingRequired
  if (profile.investmentRequired !== undefined) {
    return profile.investmentRequired - (profile.ownContribution ?? 0)
  }
  return undefined
}

/**
 * Returns the important fields still missing from the profile, ordered by
 * priority (lower number = ask first). Some fields are only asked about
 * when they'd actually change the answer for this user (e.g. education is
 * only relevant once we know they're pursuing a sizeable new enterprise).
 */
export function identifyMissingFields(profile: UserProfile): MissingFieldInfo[] {
  const missing: MissingFieldInfo[] = []

  if (!profile.businessSector && !profile.proposedBusiness) {
    missing.push({
      field: 'businessSector',
      priority: 1,
      question: 'What kind of business are you starting or running (e.g. poultry, tailoring, dairy, retail)?',
    })
  }
  if (!profile.businessStage) {
    missing.push({
      field: 'businessStage',
      priority: 2,
      question: 'Is this a brand-new business idea, or are you expanding an existing one?',
    })
  }
  if (effectiveFinancingNeed(profile) === undefined) {
    missing.push({
      field: 'financingRequired',
      priority: 3,
      question: 'Roughly how much financing or loan amount are you looking for?',
    })
  }
  if (profile.state === undefined) {
    missing.push({
      field: 'state',
      priority: 4,
      question: 'Which state are you in? Some schemes are state-specific.',
    })
  }
  if (profile.annualIncome === undefined) {
    missing.push({
      field: 'annualIncome',
      priority: 5,
      question: 'What is your approximate annual household income?',
    })
  }
  if (profile.socialCategory === undefined) {
    missing.push({
      field: 'socialCategory',
      priority: 6,
      question: 'Which social category do you belong to — SC, ST, OBC, or General? Several schemes are category-specific.',
    })
  }
  if (profile.areaType === undefined) {
    missing.push({
      field: 'areaType',
      priority: 7,
      question: 'Are you based in a rural or urban area?',
    })
  }
  if (profile.age === undefined) {
    missing.push({
      field: 'age',
      priority: 8,
      question: 'What is your age?',
    })
  }

  const financingNeed = effectiveFinancingNeed(profile)
  if (
    profile.education === undefined &&
    financingNeed !== undefined &&
    financingNeed > 500_000 &&
    (profile.businessSector === undefined ||
      ['manufacturing', 'food_processing', 'textiles'].includes(profile.businessSector))
  ) {
    missing.push({
      field: 'education',
      priority: 9,
      question: 'For larger projects like this, some schemes ask for your education level (e.g. class 8th/10th pass) — what is it?',
    })
  }
  if (profile.existingLoans === undefined && profile.businessStatus === 'existing') {
    missing.push({
      field: 'existingLoans',
      priority: 9,
      question: 'Do you currently have any existing business loans?',
    })
  }

  return missing.sort((a, b) => a.priority - b.priority)
}
