import type { MissingFieldInfo } from '../missingFields'
import type { RankedScheme, UserProfile } from '../types'

export type ProviderId = 'ollama' | 'hosted' | 'offline'

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

/**
 * Everything a provider is allowed to base its reply on. This is the ONLY
 * scheme information a provider ever sees — `ranked` is the output of the
 * deterministic retrieval + eligibility + ranking pipeline (see
 * ranking.ts), never something the provider computes itself.
 */
export interface AIRequestContext {
  profile: UserProfile
  message: string
  history: ChatTurn[]
  missingFields: MissingFieldInfo[]
  ranked: RankedScheme[]
  /** Profile fields this exact message just changed — lets a reply acknowledge what it heard. */
  newlyUpdatedFields: Array<keyof UserProfile>
}

export interface ProviderReply {
  text: string
  usedProvider: ProviderId
}

export interface AIReply extends ProviderReply {
  /** True once the chain has fallen back to the always-available offline provider. */
  isFallback: boolean
}

export interface AIProvider {
  readonly id: ProviderId
  /** Cheap reachability/config check — must never hang; used to skip a provider fast. */
  isAvailable(): Promise<boolean>
  /**
   * Produce one natural-language reply from `context` only. Implementations
   * MUST NOT introduce scheme names, amounts, URLs, or eligibility claims
   * beyond what `context.ranked`/`context.missingFields` already contain.
   */
  generateReply(context: AIRequestContext): Promise<ProviderReply>
}
