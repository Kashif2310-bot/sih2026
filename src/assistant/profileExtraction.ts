/**
 * Deterministic, rule-based natural-language profile extraction.
 *
 * This is NOT an LLM call — it is regex/keyword based so that profile
 * extraction works reliably and testably even with no AI provider
 * available (offline/local-only demo). An AIProvider MAY additionally
 * refine extraction (see ai/provider.ts), but the assistant must never
 * depend on a network/model call just to read a user's message.
 */

import { INDIAN_STATES, SECTOR_KEYWORDS } from './lexicon'
import type { UserProfile } from './types'

export interface ExtractionResult {
  profile: UserProfile
  updatedFields: Array<keyof UserProfile>
}

function findState(text: string): string | undefined {
  const lower = text.toLowerCase()
  let best: { name: string; index: number } | undefined
  for (const state of INDIAN_STATES) {
    const idx = lower.indexOf(state.toLowerCase())
    if (idx !== -1 && (!best || state.length > best.name.length)) {
      best = { name: state, index: idx }
    }
  }
  return best?.name
}

function findAge(text: string): number | undefined {
  const m = text.match(/(\d{1,3})\s*-?\s*years?\s*-?\s*old/i)
  if (m) {
    const n = Number(m[1])
    if (n > 0 && n < 120) return n
  }
  const m2 = text.match(/\bage(?:\s*(?:is|:))?\s*(\d{1,3})\b/i)
  if (m2) {
    const n = Number(m2[1])
    if (n > 0 && n < 120) return n
  }
  return undefined
}

function findGender(text: string): UserProfile['gender'] | undefined {
  if (/\bwoman\b|\bwomen\b|\bfemale\b/i.test(text)) return 'female'
  if (/\bman\b|\bmen\b|\bmale\b/i.test(text)) return 'male'
  return undefined
}

function findAreaType(text: string): UserProfile['areaType'] | undefined {
  if (/\brural\b|\bvillage\b/i.test(text)) return 'rural'
  if (/\burban\b|\bcity\b|\btown\b/i.test(text)) return 'urban'
  return undefined
}

function findSocialCategory(text: string): UserProfile['socialCategory'] | undefined {
  // The bare abbreviations are matched case-SENSITIVELY (exact "SC"/"ST"/"OBC") on
  // purpose: a case-insensitive match would also catch "St." (street) or "1st",
  // which are common in addresses and dates but never mean Scheduled Tribe.
  if (/scheduled\s+caste/i.test(text) || /(^|[\s,.;()])SC([\s,.;()]|$)/.test(text)) return 'sc'
  if (/scheduled\s+tribe/i.test(text) || /(^|[\s,.;()])ST([\s,.;()]|$)/.test(text)) return 'st'
  if (/other\s+backward\s+class/i.test(text) || /(^|[\s,.;()])OBC([\s,.;()]|$)/.test(text)) return 'obc'
  if (/general\s+categor(y|ies)/i.test(text)) return 'general'
  return undefined
}

function findBusinessSector(text: string): string | undefined {
  const lower = text.toLowerCase()
  for (const [tag, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return tag
  }
  return undefined
}

function findProposedBusiness(text: string): string | undefined {
  const m = text.match(/\b(?:an?)\s+([a-z][a-z\s-]{2,40}?)\s+business\b/i)
  if (m) return `${m[1].trim()} business`
  return undefined
}

function findBusinessStageAndStatus(
  text: string,
): { businessStage?: UserProfile['businessStage']; businessStatus?: UserProfile['businessStatus'] } {
  if (/\bexpand(ing)?\b|\bscale up\b|\bgrow(ing)? (my|the|our)\s+business\b/i.test(text)) {
    return { businessStage: 'existing_expansion', businessStatus: 'existing' }
  }
  if (/\bexisting\b.*\bbusiness\b/i.test(text) || /already\s+(have|run|running|operating)/i.test(text)) {
    return { businessStage: 'existing_expansion', businessStatus: 'existing' }
  }
  if (/\bwant to start\b|\bplan(ning)? to start\b|\bstart(ing)? a\b|\bwish to start\b/i.test(text)) {
    return { businessStage: 'new', businessStatus: 'idea' }
  }
  return {}
}

function findEducation(text: string): string | undefined {
  const m = text.match(
    /\b(8th|10th|12th|ssc|graduate|post[- ]graduate|diploma|illiterate|no formal education|degree)\b/i,
  )
  return m ? m[1].toLowerCase() : undefined
}

function findLandOrAssets(text: string): string | undefined {
  const m = text.match(/\b(\d+(?:\.\d+)?)\s*(acre|acres|guntha|cents)\b/i)
  if (m) return `${m[1]} ${m[2]}`
  const m2 = text.match(/\bown(?:s)?\s+(?:a|an|some)?\s*(house|land|shop|property)\b/i)
  return m2 ? `owns ${m2[1]}` : undefined
}

function findExistingLoans(text: string): string | undefined {
  if (/\bno\s+(existing\s+)?loan/i.test(text)) return 'none mentioned'
  const m = text.match(/\b(existing loan[^.,;]*|already\s+have\s+a\s+loan[^.,;]*|loan\s+of\s+₹?[\d,]+[^.,;]*)/i)
  return m ? m[0].trim() : undefined
}

interface MoneyMention {
  value: number
  index: number
}

function findMoneyMentions(text: string): MoneyMention[] {
  const results: MoneyMention[] = []
  const re = /(₹|rs\.?|inr)?\s*([\d][\d,]*(?:\.\d+)?)\s*(lakh|lac|crore|thousand|k)?/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const [, currencySymbol, numRaw, unit] = match
    if (!currencySymbol && !unit) continue // bare number with no currency/unit — too ambiguous (could be age, count, etc.)
    const num = Number(numRaw.replace(/,/g, ''))
    if (!Number.isFinite(num) || num <= 0) continue
    let value = num
    const u = unit?.toLowerCase()
    if (u === 'lakh' || u === 'lac') value = num * 100_000
    else if (u === 'crore') value = num * 10_000_000
    else if (u === 'thousand' || u === 'k') value = num * 1_000
    results.push({ value, index: match.index })
  }
  return results
}

const OWN_CONTRIBUTION_KEYWORDS = ['own contribution', 'own savings', 'margin money', 'self contribution']
const INCOME_KEYWORDS = ['income', 'earn', 'earning', 'salary']
const FINANCING_KEYWORDS = ['need', 'loan of', 'financing', 'expand', 'want a loan', 'require a loan']
const INVESTMENT_KEYWORDS = ['requiring', 'investment', 'invest', 'project cost', 'setup cost', 'set up', 'cost of', 'capital of']

type MoneyCategory = 'ownContribution' | 'annualIncome' | 'financingRequired' | 'investmentRequired'

const MONEY_CATEGORY_KEYWORDS: Array<[MoneyCategory, string[]]> = [
  ['ownContribution', OWN_CONTRIBUTION_KEYWORDS],
  ['annualIncome', INCOME_KEYWORDS],
  ['financingRequired', FINANCING_KEYWORDS],
  ['investmentRequired', INVESTMENT_KEYWORDS],
]

function contextBefore(text: string, index: number, window = 55): string {
  return text.slice(Math.max(0, index - window), index).toLowerCase()
}

/**
 * When two different context keywords both appear in the window before a
 * money mention (e.g. "I earn ₹6 lakh annually and need ₹8 lakh"), the
 * closer one — not the first category checked — is the one that actually
 * governs that amount. So this picks the keyword with the highest index
 * (closest to the amount) across all categories, not the first category
 * that matches anywhere in the window.
 */
function nearestMoneyCategory(ctx: string): MoneyCategory | undefined {
  let best: { category: MoneyCategory; index: number } | undefined
  for (const [category, keywords] of MONEY_CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      const idx = ctx.lastIndexOf(kw)
      if (idx !== -1 && (!best || idx > best.index)) best = { category, index: idx }
    }
  }
  return best?.category
}

function classifyMoney(
  text: string,
  mentions: MoneyMention[],
): Pick<UserProfile, 'annualIncome' | 'investmentRequired' | 'financingRequired' | 'ownContribution'> {
  const out: Pick<UserProfile, 'annualIncome' | 'investmentRequired' | 'financingRequired' | 'ownContribution'> = {}
  for (const mention of mentions) {
    const category = nearestMoneyCategory(contextBefore(text, mention.index))
    if (category) out[category] = mention.value
  }
  return out
}

/**
 * Extract structured profile fields from one free-text user message.
 * Returns only the fields this message actually gave evidence for — the
 * caller merges this into the running profile (see orchestrator.ts).
 */
export function extractProfileFromMessage(text: string): Partial<UserProfile> {
  const extracted: Partial<UserProfile> = {}

  const age = findAge(text)
  if (age !== undefined) extracted.age = age

  const gender = findGender(text)
  if (gender) extracted.gender = gender

  const areaType = findAreaType(text)
  if (areaType) extracted.areaType = areaType

  const state = findState(text)
  if (state) extracted.state = state

  const socialCategory = findSocialCategory(text)
  if (socialCategory) extracted.socialCategory = socialCategory

  const sector = findBusinessSector(text)
  if (sector) extracted.businessSector = sector

  const proposedBusiness = findProposedBusiness(text)
  if (proposedBusiness) extracted.proposedBusiness = proposedBusiness

  const { businessStage, businessStatus } = findBusinessStageAndStatus(text)
  if (businessStage) extracted.businessStage = businessStage
  if (businessStatus) extracted.businessStatus = businessStatus

  const education = findEducation(text)
  if (education) extracted.education = education

  const landOrAssets = findLandOrAssets(text)
  if (landOrAssets) extracted.landOrAssets = landOrAssets

  const existingLoans = findExistingLoans(text)
  if (existingLoans) extracted.existingLoans = existingLoans

  const money = classifyMoney(text, findMoneyMentions(text))
  Object.assign(extracted, money)

  return extracted
}

/** Merge a new extraction into the running profile. Later statements overwrite earlier ones. */
export function mergeProfile(existing: UserProfile, extracted: Partial<UserProfile>): ExtractionResult {
  const updatedFields: Array<keyof UserProfile> = []
  const merged: UserProfile = { ...existing }
  for (const [key, value] of Object.entries(extracted)) {
    if (value === undefined) continue
    const field = key as keyof UserProfile
    if (merged[field] !== value) updatedFields.push(field)
    Object.assign(merged, { [field]: value })
  }
  return { profile: merged, updatedFields }
}

export function extractAndMerge(text: string, existing: UserProfile): ExtractionResult {
  return mergeProfile(existing, extractProfileFromMessage(text))
}
