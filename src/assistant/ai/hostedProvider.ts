/**
 * Hosted-model provider abstraction. There is deliberately no direct call
 * to a hosted LLM API (OpenAI/Anthropic/etc.) from this frontend — that
 * would require embedding a secret API key in shipped browser code, which
 * this app must never do. Instead this provider only ever talks to
 * HOSTED_PROXY_URL, a same-origin/developer-controlled backend endpoint
 * that is expected to hold the real key server-side and forward the
 * request. Until such a proxy exists (HOSTED_PROXY_URL is unset), this
 * provider reports itself unavailable and the chain falls through to
 * Ollama/offline — it exists so swapping in a hosted model later is a
 * one-file change (implement the proxy, set HOSTED_PROXY_URL) rather than
 * a redesign.
 */

import { AI_REQUEST_TIMEOUT_MS, HOSTED_PROXY_URL } from '../aiConfig'
import { ASSISTANT_SYSTEM_PROMPT, buildUserTurn } from './promptBuilder'
import type { AIProvider, AIRequestContext, ProviderReply } from './types'

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export class HostedProxyProvider implements AIProvider {
  readonly id = 'hosted' as const
  private readonly proxyUrl: string | undefined

  constructor(proxyUrl: string | undefined = HOSTED_PROXY_URL) {
    this.proxyUrl = proxyUrl
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(Boolean(this.proxyUrl))
  }

  async generateReply(context: AIRequestContext): Promise<ProviderReply> {
    if (!this.proxyUrl) throw new Error('Hosted provider is not configured (no proxy URL set)')

    const res = await fetchWithTimeout(
      this.proxyUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: ASSISTANT_SYSTEM_PROMPT, userTurn: buildUserTurn(context) }),
      },
      AI_REQUEST_TIMEOUT_MS,
    )
    if (!res.ok) throw new Error(`Hosted provider request failed with status ${res.status}`)

    const data: unknown = await res.json()
    const reply = data && typeof data === 'object' && 'reply' in data ? (data as { reply?: unknown }).reply : undefined
    if (typeof reply !== 'string' || reply.trim().length === 0) {
      throw new Error('Hosted provider returned an empty or malformed response')
    }
    return { text: reply.trim(), usedProvider: this.id }
  }
}
