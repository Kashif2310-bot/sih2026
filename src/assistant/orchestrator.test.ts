import { describe, expect, it } from 'vitest'
import { offlineProvider } from './ai/offlineProvider'
import type { AIProvider, AIRequestContext, ProviderReply } from './ai/types'
import { defaultRetriever, type SchemeRetriever } from './retrieval'
import { createInitialProfile, runAssistantTurn } from './orchestrator'

function failingProvider(id: 'ollama' | 'hosted', error = new Error('boom')): AIProvider {
  return {
    id,
    isAvailable: () => Promise.resolve(true),
    generateReply: () => Promise.reject(error),
  }
}

function unavailableProvider(id: 'ollama' | 'hosted'): AIProvider {
  return {
    id,
    isAvailable: () => Promise.resolve(false),
    generateReply: () => {
      throw new Error(`${id} should never have been called — isAvailable() returned false`)
    },
  }
}

function stubProvider(id: 'ollama' | 'hosted', text: string): AIProvider {
  return {
    id,
    isAvailable: () => Promise.resolve(true),
    generateReply: () => Promise.resolve({ text, usedProvider: id }),
  }
}

function malformedProvider(id: 'ollama' | 'hosted'): AIProvider {
  return {
    id,
    isAvailable: () => Promise.resolve(true),
    generateReply: () => Promise.resolve({ text: '   ', usedProvider: id }),
  }
}

describe('runAssistantTurn — profile updates drive retrieval/ranking', () => {
  it('produces a materially different ranking once the user reveals sector/state/category across turns', async () => {
    const deps = { providers: [offlineProvider], retriever: defaultRetriever }

    const turn1 = await runAssistantTurn(
      { message: 'Hi, I need some help.', profile: createInitialProfile(), history: [] },
      deps,
    )
    const thinProfileTopId = turn1.ranked[0]?.scheme.id
    const thinMissingCount = turn1.missingFields.length

    const turn2 = await runAssistantTurn(
      {
        message:
          'I am 24 years old, from rural Karnataka, SC, my annual income is about ₹2 lakh, and I want to start a poultry business requiring ₹3 lakh.',
        profile: turn1.profile,
        history: [{ role: 'user', text: 'Hi, I need some help.' }],
      },
      deps,
    )

    expect(turn2.profile.state).toBe('Karnataka')
    expect(turn2.profile.businessSector).toBe('poultry')
    expect(turn2.profile.socialCategory).toBe('sc')
    expect(turn2.updatedFields).toContain('state')
    expect(turn2.updatedFields).toContain('businessSector')

    // Ranking must have actually recomputed against the fuller profile, not
    // reused whatever it decided when almost nothing was known.
    expect(turn2.missingFields.length).toBeLessThan(thinMissingCount)
    expect(turn2.ranked[0]?.scheme.id).not.toBe(thinProfileTopId)
    expect(turn2.ranked.some((r) => r.eligibility.status === 'likely_eligible')).toBe(true)
  })

  it('produces a different top scheme for a second, materially different conversation', async () => {
    const deps = { providers: [offlineProvider], retriever: defaultRetriever }
    const poultry = await runAssistantTurn(
      {
        message:
          'I am 24 years old, from rural Karnataka, SC, my annual income is about ₹2 lakh, and I want to start a poultry business requiring ₹3 lakh.',
        profile: createInitialProfile(),
        history: [],
      },
      deps,
    )
    const tailoring = await runAssistantTurn(
      {
        message:
          'I am a 47-year-old woman in Kerala with an existing tailoring business. I earn ₹6 lakh annually and need ₹8 lakh to expand.',
        profile: createInitialProfile(),
        history: [],
      },
      deps,
    )

    expect(poultry.ranked[0]?.scheme.id).not.toBe(tailoring.ranked[0]?.scheme.id)
    expect(poultry.actionPlan).not.toEqual(tailoring.actionPlan)
  })
})

describe('runAssistantTurn — provider fallback chain', () => {
  const input = { message: 'hello', profile: createInitialProfile(), history: [] }

  it('falls through a failing primary provider to the offline provider', async () => {
    const result = await runAssistantTurn(input, {
      providers: [failingProvider('ollama'), offlineProvider],
      retriever: defaultRetriever,
    })
    expect(result.reply.usedProvider).toBe('offline')
    expect(result.reply.isFallback).toBe(true)
  })

  it('never calls a provider that reports itself unavailable', async () => {
    const result = await runAssistantTurn(input, {
      providers: [unavailableProvider('ollama'), offlineProvider],
      retriever: defaultRetriever,
    })
    expect(result.reply.usedProvider).toBe('offline')
  })

  it('treats a malformed (empty) provider response as a failure and falls back', async () => {
    const result = await runAssistantTurn(input, {
      providers: [malformedProvider('ollama'), offlineProvider],
      retriever: defaultRetriever,
    })
    expect(result.reply.usedProvider).toBe('offline')
  })

  it('uses the primary provider and marks isFallback=false when it succeeds', async () => {
    const result = await runAssistantTurn(input, {
      providers: [stubProvider('ollama', 'A real personalized explanation.'), offlineProvider],
      retriever: defaultRetriever,
    })
    expect(result.reply.usedProvider).toBe('ollama')
    expect(result.reply.isFallback).toBe(false)
    expect(result.reply.text).toBe('A real personalized explanation.')
  })

  it('throws if every provider fails, including no offline fallback being configured', async () => {
    await expect(
      runAssistantTurn(input, { providers: [failingProvider('ollama')], retriever: defaultRetriever }),
    ).rejects.toThrow(/all configured AI providers/i)
  })
})

describe('runAssistantTurn — empty retrieval results', () => {
  it('still returns a graceful reply and an empty action plan when the retriever finds nothing', async () => {
    const emptyRetriever: SchemeRetriever = { retrieve: () => [] }
    const result = await runAssistantTurn(
      { message: 'hello', profile: createInitialProfile(), history: [] },
      { providers: [offlineProvider], retriever: emptyRetriever },
    )
    expect(result.ranked).toEqual([])
    expect(result.actionPlan).toEqual([])
    expect(result.reply.text.length).toBeGreaterThan(0)
  })
})

describe('runAssistantTurn — action plan is deterministic, not AI-authored', () => {
  it('builds the plan from the ranked schemes\' own application steps, unaffected by what the provider says', async () => {
    const lyingProvider: AIProvider = {
      id: 'ollama',
      isAvailable: () => Promise.resolve(true),
      generateReply: (): Promise<ProviderReply> =>
        Promise.resolve({ text: 'You are fully approved for the Ministry of Made-Up Schemes grant!', usedProvider: 'ollama' }),
    }
    const result = await runAssistantTurn(
      {
        message:
          'I am 24 years old, from rural Karnataka, SC, my annual income is about ₹2 lakh, and I want to start a poultry business requiring ₹3 lakh.',
        profile: createInitialProfile(),
        history: [],
      },
      { providers: [lyingProvider], retriever: defaultRetriever },
    )

    expect(result.actionPlan.length).toBeGreaterThan(0)
    const validSchemeIds = new Set(result.ranked.map((r) => r.scheme.id))
    for (const step of result.actionPlan) {
      expect(validSchemeIds.has(step.schemeId)).toBe(true)
    }
    expect(result.actionPlan.some((s) => s.text.includes('Made-Up'))).toBe(false)
  })
})

describe('AIRequestContext plumbing', () => {
  it('passes the freshly ranked schemes and current missing fields into the provider context', async () => {
    let capturedContext: AIRequestContext | undefined
    const capturingProvider: AIProvider = {
      id: 'ollama',
      isAvailable: () => Promise.resolve(true),
      generateReply: (context) => {
        capturedContext = context
        return Promise.resolve({ text: 'ok', usedProvider: 'ollama' })
      },
    }
    const result = await runAssistantTurn(
      {
        message: 'I want to start a poultry business.',
        profile: createInitialProfile(),
        history: [],
      },
      { providers: [capturingProvider], retriever: defaultRetriever },
    )

    expect(capturedContext).toBeDefined()
    expect(capturedContext!.ranked).toEqual(result.ranked)
    expect(capturedContext!.missingFields).toEqual(result.missingFields)
    expect(capturedContext!.profile.businessSector).toBe('poultry')
  })
})
