import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PROFILE } from '../types'
import { OllamaProvider } from './ollamaProvider'
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

describe('OllamaProvider.isAvailable', () => {
  it('returns true when the local Ollama server responds ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const provider = new OllamaProvider()
    expect(await provider.isAvailable()).toBe(true)
  })

  it('returns false when the server is unreachable (connection refused)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const provider = new OllamaProvider()
    expect(await provider.isAvailable()).toBe(false)
  })

  it('returns false without throwing when the request errors for any reason', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'))
    const provider = new OllamaProvider()
    await expect(provider.isAvailable()).resolves.toBe(false)
  })
})

describe('OllamaProvider.generateReply', () => {
  it('sends the system prompt and evidence, and parses the chat response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: { content: 'Here is a personalized explanation.' } }), { status: 200 }),
    )
    globalThis.fetch = fetchMock
    const provider = new OllamaProvider()

    const reply = await provider.generateReply(CONTEXT)

    expect(reply.usedProvider).toBe('ollama')
    expect(reply.text).toBe('Here is a personalized explanation.')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/chat')
    const body = JSON.parse(init.body as string)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toMatch(/Only ever discuss schemes/i)
    expect(body.messages[1].role).toBe('user')
  })

  it('throws when the server responds with a non-ok status (caller falls back)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('error', { status: 500 }))
    const provider = new OllamaProvider()
    await expect(provider.generateReply(CONTEXT)).rejects.toThrow()
  })

  it('throws on a malformed/empty response body instead of returning garbage', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }))
    const provider = new OllamaProvider()
    await expect(provider.generateReply(CONTEXT)).rejects.toThrow(/empty or malformed/i)
  })

  it('throws when the model returns an empty string', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: { content: '   ' } }), { status: 200 }))
    const provider = new OllamaProvider()
    await expect(provider.generateReply(CONTEXT)).rejects.toThrow()
  })
})
