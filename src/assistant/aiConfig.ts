/**
 * AI provider configuration. Kept separate from src/lib/config.ts on
 * purpose — this file only affects the assistant feature and never touches
 * the existing app's constants.
 */

/** Local Ollama server — see https://ollama.com. Never requires an API key. */
export const OLLAMA_BASE_URL = 'http://localhost:11434'
export const OLLAMA_MODEL = 'llama3.1'

/**
 * A hosted LLM provider is only ever reachable through a same-origin (or
 * otherwise developer-controlled) backend proxy that holds the real API key
 * server-side — the browser must never hold or send a provider API key.
 * This repo ships with no backend, so this is intentionally unset; set it
 * to enable HostedProxyProvider once such a proxy exists.
 */
export const HOSTED_PROXY_URL: string | undefined = undefined

/** Quick reachability check — must stay short so a missing local Ollama never stalls the chat UI. */
export const AI_HEALTHCHECK_TIMEOUT_MS = 1_200

/** Local LLM generation is much slower than the live-data calls elsewhere in this app (weather/geocode use 2.5s) — give it real room before falling back. */
export const AI_REQUEST_TIMEOUT_MS = 20_000
