import { HostedProxyProvider } from './hostedProvider'
import { offlineProvider } from './offlineProvider'
import { OllamaProvider } from './ollamaProvider'
import type { AIProvider } from './types'

/**
 * Priority order: try a real local model first, then a hosted proxy if one
 * has been configured, and always fall back to the deterministic offline
 * template provider last (it is the only one guaranteed never to fail).
 * Swapping "local Llama" for a hosted model later is just changing this
 * order / config, not the calling code in orchestrator.ts.
 */
export function defaultProviderChain(): AIProvider[] {
  return [new OllamaProvider(), new HostedProxyProvider(), offlineProvider]
}

export type { AIProvider, AIRequestContext, AIReply, ChatTurn, ProviderId, ProviderReply } from './types'
export { OllamaProvider } from './ollamaProvider'
export { HostedProxyProvider } from './hostedProvider'
export { OfflineTemplateProvider, offlineProvider, composeOfflineReply } from './offlineProvider'
export { ASSISTANT_SYSTEM_PROMPT, buildUserTurn } from './promptBuilder'
