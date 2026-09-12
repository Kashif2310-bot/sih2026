import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PROFILE } from '../types'
import { HostedProxyProvider } from './hostedProvider'
import type { AIRequestContext } from './types'

const CONTEXT: AIRequestContext = {
  profile: EMPTY_PROFILE,
  message: 'hello',
  history: [],
  missingFields: [],
  ranked: [],
  newlyUpdatedFields: [],
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('HostedProxyProvider — unconfigured (default in this repo)', () => {
  it('reports itself unavailable with no proxy URL, and never contacts the network', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock
    const provider = new HostedProxyProvider(undefined)
    expect(await provider.isAvailable()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws a clear configuration error if generateReply is called anyway', async () => {
    const provider = new HostedProxyProvider(undefined)
    await expect(provider.generateReply(CONTEXT)).rejects.toThrow(/not configured/i)
  })
})

describe('HostedProxyProvider — configured with a proxy URL', () => {
  it('is available and forwards the request to the proxy, never including any API key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ reply: 'Personalized explanation from the proxy.' }), { status: 200 }))
    globalThis.fetch = fetchMock
    const provider = new HostedProxyProvider('https://example.internal/assistant-proxy')

    expect(await provider.isAvailable()).toBe(true)
    const reply = await provider.generateReply(CONTEXT)
    expect(reply.usedProvider).toBe('hosted')
    expect(reply.text).toBe('Personalized explanation from the proxy.')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.internal/assistant-proxy')
    const body = JSON.parse(init.body as string)
    expect(body).not.toHaveProperty('apiKey')
    expect(JSON.stringify(body)).not.toMatch(/sk-[a-zA-Z0-9]/) // no embedded secret-shaped string
  })

  it('throws on a non-ok proxy response so the caller can fall back', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('error', { status: 503 }))
    const provider = new HostedProxyProvider('https://example.internal/assistant-proxy')
    await expect(provider.generateReply(CONTEXT)).rejects.toThrow()
  })

  it('throws on a malformed proxy response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    const provider = new HostedProxyProvider('https://example.internal/assistant-proxy')
    await expect(provider.generateReply(CONTEXT)).rejects.toThrow(/empty or malformed/i)
  })
})
