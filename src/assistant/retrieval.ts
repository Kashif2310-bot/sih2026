/**
 * Retrieval abstraction over the scheme knowledge base.
 *
 * v1 implementation is structured filtering + keyword/tag overlap scoring
 * ("semantic-like" search without embeddings). The SchemeRetriever
 * interface is intentionally storage-agnostic: a later version can swap in
 * a vector database (embed profile/query -> nearest scheme chunks) or an
 * authorized government API client without changing any caller — both would
 * just implement `retrieve()`.
 */

import { SCHEMES } from './data/schemes'
import { normalizeSectorLabel } from './lexicon'
import type { GovernmentScheme, RetrievalResult, UserProfile } from './types'

export interface RetrievalQuery {
  profile: UserProfile
  /** Raw text of the user's latest message, used for keyword matching. */
  queryText?: string
}

export interface SchemeRetriever {
  retrieve(query: RetrievalQuery): RetrievalResult[]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
}

function schemeSearchableText(scheme: GovernmentScheme): string {
  return [scheme.name, scheme.shortName ?? '', scheme.description, ...scheme.tags].join(' ').toLowerCase()
}

export class StaticKnowledgeBaseRetriever implements SchemeRetriever {
  private readonly schemes: GovernmentScheme[]

  constructor(schemes: GovernmentScheme[] = SCHEMES) {
    this.schemes = schemes
  }

  retrieve(query: RetrievalQuery): RetrievalResult[] {
    const { profile, queryText } = query
    const queryTokens = queryText ? Array.from(new Set(tokenize(queryText))) : []

    const results: RetrievalResult[] = []

    for (const scheme of this.schemes) {
      const matchedTags = new Set<string>()

      // Structured filter: a state-scoped scheme is excluded outright once
      // we know the user's state and it doesn't match — it genuinely does
      // not apply to them, not merely "less relevant".
      if (scheme.scope === 'state' && profile.state && scheme.state) {
        if (profile.state.toLowerCase() !== scheme.state.toLowerCase()) continue
      }

      let relevance = 20 // baseline so a thin profile still surfaces central schemes
      if (scheme.scope === 'central') relevance += 10

      const sectors = scheme.eligibility.businessSectors
      if (profile.businessSector) {
        const label = normalizeSectorLabel(profile.businessSector)
        if (sectors?.includes(profile.businessSector)) {
          relevance += 35
          matchedTags.add(label)
        } else if (scheme.eligibility.excludedBusinessSectors?.includes(profile.businessSector)) {
          relevance -= 15
        } else if (!sectors || sectors.includes('any')) {
          relevance += 10
        }
        if (scheme.tags.some((t) => t.toLowerCase() === profile.businessSector)) {
          relevance += 10
          matchedTags.add(label)
        }
      }

      if (profile.socialCategory) {
        if (scheme.eligibility.socialCategories?.includes(profile.socialCategory)) {
          relevance += 25
          matchedTags.add(profile.socialCategory.toUpperCase())
        }
        if (scheme.eligibility.eligibleIfAny?.some((g) => g.socialCategories?.includes(profile.socialCategory!))) {
          relevance += 20
          matchedTags.add(profile.socialCategory.toUpperCase())
        }
      }

      if (profile.gender) {
        if (scheme.eligibility.genders?.includes(profile.gender)) {
          relevance += 15
          matchedTags.add(profile.gender)
        }
        if (scheme.eligibility.eligibleIfAny?.some((g) => g.genders?.includes(profile.gender!))) {
          relevance += 12
          matchedTags.add(profile.gender)
        }
      }

      if (profile.state) {
        if (scheme.state && scheme.state.toLowerCase() === profile.state.toLowerCase()) {
          relevance += 30
          matchedTags.add(scheme.state)
        } else if (scheme.eligibility.states?.some((st) => st.toLowerCase() === profile.state!.toLowerCase())) {
          relevance += 15
          matchedTags.add(profile.state)
        }
      }

      if (queryTokens.length > 0) {
        const haystack = schemeSearchableText(scheme)
        let queryHits = 0
        for (const token of queryTokens) {
          if (haystack.includes(token)) {
            queryHits += 1
            matchedTags.add(token)
          }
        }
        relevance += Math.min(20, queryHits * 4)
      }

      relevance = Math.max(0, Math.min(100, Math.round(relevance)))
      results.push({ scheme, relevance, matchedTags: Array.from(matchedTags) })
    }

    return results.sort((a, b) => b.relevance - a.relevance)
  }
}

export const defaultRetriever: SchemeRetriever = new StaticKnowledgeBaseRetriever()
