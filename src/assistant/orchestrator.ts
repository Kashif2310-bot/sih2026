/**
 * The assistant pipeline:
 *   message -> extract/merge profile -> missing fields -> retrieve -> rank
 *   (retrieval + deterministic eligibility) -> hand evidence to an AI
 *   provider -> personalized reply + deterministic action plan.
 *
 * Every call recomputes retrieval/ranking from the freshly merged profile —
 * there is no cache to go stale, so a profile change always changes what
 * gets ranked on the very next turn.
 */

import { defaultProviderChain } from './ai'
import type { AIProvider, AIRequestContext, AIReply, ChatTurn } from './ai/types'
import type { MissingFieldInfo } from './missingFields'
import { identifyMissingFields } from './missingFields'
import { extractAndMerge } from './profileExtraction'
import { rankSchemes } from './ranking'
import { defaultRetriever, type SchemeRetriever } from './retrieval'
import type { RankedScheme, UserProfile } from './types'

export interface ActionPlanStep {
  order: number
  text: string
  schemeId: string
  schemeName: string
}

export interface AssistantTurnResult {
  profile: UserProfile
  updatedFields: Array<keyof UserProfile>
  missingFields: MissingFieldInfo[]
  ranked: RankedScheme[]
  reply: AIReply
  actionPlan: ActionPlanStep[]
}

export interface RunAssistantTurnInput {
  message: string
  profile: UserProfile
  history: ChatTurn[]
}

export interface RunAssistantTurnDeps {
  providers: AIProvider[]
  retriever: SchemeRetriever
}

export function defaultAssistantDeps(): RunAssistantTurnDeps {
  return { providers: defaultProviderChain(), retriever: defaultRetriever }
}

export function createInitialProfile(): UserProfile {
  return { rawNotes: [] }
}

/**
 * The action plan is deliberately NOT AI-generated: it is just the
 * official application steps from the top eligible schemes, in order,
 * de-duplicated. This guarantees the concrete "what do I do next" text a
 * user sees can never contain a hallucinated procedure — see the provider
 * anti-hallucination contract in ai/promptBuilder.ts for the analogous
 * guarantee on the conversational reply text.
 */
function buildActionPlan(ranked: RankedScheme[]): ActionPlanStep[] {
  const eligible = ranked.filter(
    (r) => r.eligibility.status === 'likely_eligible' || r.eligibility.status === 'possibly_eligible',
  )
  const steps: ActionPlanStep[] = []
  let order = 1
  for (const r of eligible.slice(0, 3)) {
    for (const stepText of r.scheme.applicationSteps) {
      steps.push({ order: order++, text: stepText, schemeId: r.scheme.id, schemeName: r.scheme.name })
    }
  }
  return steps
}

/**
 * Tries each provider in order and returns the first successful reply.
 * A provider that is unavailable or throws (network error, malformed
 * response, timeout) is skipped rather than surfaced as a hard failure —
 * this is the "fail gracefully" contract: the user always gets a reply,
 * and `isFallback` tells the UI whether it came from a real model or the
 * offline template so it can be labelled honestly.
 */
async function generateWithFallback(context: AIRequestContext, providers: AIProvider[]): Promise<AIReply> {
  for (const provider of providers) {
    try {
      const available = await provider.isAvailable()
      if (!available) continue
      const reply = await provider.generateReply(context)
      if (!reply.text || !reply.text.trim()) {
        // Malformed provider output — treat exactly like a failure, not a reply.
        continue
      }
      return { ...reply, isFallback: reply.usedProvider === 'offline' }
    } catch {
      continue
    }
  }
  // The offline provider is always in the default chain, always reports
  // itself available, and never throws, so this should be unreachable in
  // practice. It only fires if a caller supplies a custom `providers` list
  // that omits any always-available provider — a caller bug, not a runtime
  // condition to hide.
  throw new Error('All configured AI providers, including any offline fallback, failed to respond.')
}

export async function runAssistantTurn(
  input: RunAssistantTurnInput,
  deps: RunAssistantTurnDeps = defaultAssistantDeps(),
): Promise<AssistantTurnResult> {
  const { profile: mergedProfile, updatedFields } = extractAndMerge(input.message, input.profile)
  const missingFields = identifyMissingFields(mergedProfile)
  const ranked = rankSchemes(mergedProfile, input.message, deps.retriever)

  const context: AIRequestContext = {
    profile: mergedProfile,
    message: input.message,
    history: input.history,
    missingFields,
    ranked,
    newlyUpdatedFields: updatedFields,
  }

  const reply = await generateWithFallback(context, deps.providers)
  const actionPlan = buildActionPlan(ranked)

  return { profile: mergedProfile, updatedFields, missingFields, ranked, reply, actionPlan }
}
