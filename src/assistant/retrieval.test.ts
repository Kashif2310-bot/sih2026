import { describe, expect, it } from 'vitest'
import { StaticKnowledgeBaseRetriever } from './retrieval'
import { SCHEMES } from './data/schemes'
import { EMPTY_PROFILE, type UserProfile } from './types'

const retriever = new StaticKnowledgeBaseRetriever()

describe('StaticKnowledgeBaseRetriever — structured filtering', () => {
  it('excludes a state-scoped scheme when the profile is a known different state', () => {
    const results = retriever.retrieve({ profile: { ...EMPTY_PROFILE, state: 'Karnataka' } })
    expect(results.some((r) => r.scheme.id === 'kudumbashree-microenterprise')).toBe(false)
  })

  it('includes the matching state-scoped scheme when the state matches', () => {
    const results = retriever.retrieve({ profile: { ...EMPTY_PROFILE, state: 'Kerala' } })
    expect(results.some((r) => r.scheme.id === 'kudumbashree-microenterprise')).toBe(true)
  })

  it('includes a state-scoped scheme when the profile state is unknown (not yet ruled out)', () => {
    const results = retriever.retrieve({ profile: EMPTY_PROFILE })
    expect(results.some((r) => r.scheme.id === 'kudumbashree-microenterprise')).toBe(true)
  })
})

describe('StaticKnowledgeBaseRetriever — relevance ranking', () => {
  it('ranks a poultry-relevant scheme above an unrelated one for a poultry profile', () => {
    const profile: UserProfile = { ...EMPTY_PROFILE, businessSector: 'poultry' }
    const results = retriever.retrieve({ profile })
    const mudraRank = results.findIndex((r) => r.scheme.id === 'pm-mudra-yojana')
    const kudumbashreeRank = results.findIndex((r) => r.scheme.id === 'kudumbashree-microenterprise')
    expect(mudraRank).toBeGreaterThanOrEqual(0)
    expect(mudraRank).toBeLessThan(kudumbashreeRank)
  })

  it('boosts relevance from query text keyword overlap', () => {
    const withoutQuery = retriever.retrieve({ profile: EMPTY_PROFILE })
    const withQuery = retriever.retrieve({ profile: EMPTY_PROFILE, queryText: 'tailor darzi artisan toolkit' })
    const before = withoutQuery.find((r) => r.scheme.id === 'pm-vishwakarma')!.relevance
    const after = withQuery.find((r) => r.scheme.id === 'pm-vishwakarma')!.relevance
    expect(after).toBeGreaterThan(before)
  })

  it('always returns at least the central schemes for a fully empty profile (never an empty result set)', () => {
    const results = retriever.retrieve({ profile: EMPTY_PROFILE })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => Number.isFinite(r.relevance))).toBe(true)
  })

  it('handles an empty/whitespace query text without throwing', () => {
    expect(() => retriever.retrieve({ profile: EMPTY_PROFILE, queryText: '   ' })).not.toThrow()
  })
})

describe('StaticKnowledgeBaseRetriever — malformed dataset resilience', () => {
  it('does not throw when a scheme in the dataset has minimal/empty eligibility', () => {
    const minimal = new StaticKnowledgeBaseRetriever([
      {
        id: 'minimal',
        name: 'Minimal Scheme',
        description: '',
        ministry: '',
        scope: 'central',
        eligibility: {},
        documents: [],
        applicationSteps: [],
        officialApplicationUrl: 'https://example.gov.in',
        officialInfoUrl: 'https://example.gov.in',
        source: '',
        sourceUrl: 'https://example.gov.in',
        lastVerifiedDate: '2026-01-01',
        confidence: 'reference',
        tags: [],
      },
    ])
    expect(() => minimal.retrieve({ profile: EMPTY_PROFILE })).not.toThrow()
  })

  it('returns an empty array (not an error) for an empty scheme list', () => {
    const empty = new StaticKnowledgeBaseRetriever([])
    expect(empty.retrieve({ profile: EMPTY_PROFILE })).toEqual([])
  })

  it('every scheme in the real starter dataset has the required identifying fields', () => {
    for (const s of SCHEMES) {
      expect(s.id).toBeTruthy()
      expect(s.name).toBeTruthy()
      // SECURITY: every URL surfaced to a user must be HTTPS.
      expect(s.officialInfoUrl).toMatch(/^https:\/\//)
      expect(s.officialApplicationUrl).toMatch(/^https:\/\//)
      expect(s.sourceUrl).toMatch(/^https:\/\//)
      expect(s.lastVerifiedDate).toBeTruthy()
    }
  })

  it('SECURITY: no scheme dataset field embeds an API key or other secret-shaped token', () => {
    const serialized = JSON.stringify(SCHEMES)
    expect(serialized).not.toMatch(/sk-[a-zA-Z0-9]{10,}/)
    expect(serialized).not.toMatch(/api[_-]?key/i)
    expect(serialized).not.toMatch(/bearer\s+[a-zA-Z0-9._-]{10,}/i)
  })
})
