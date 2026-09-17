/**
 * Security contract tests — runnable without hosted schema.
 * Hosted RLS scenarios run in supabase.integration.test.ts when enabled.
 */

import { describe, expect, it } from 'vitest'
import { BackendError } from '../errors'
import { createServiceRoleClient } from '../supabase/client'
import { getSupabaseServerConfig } from '../supabase/config'
import { createBackendServices } from './createBackendServices'

describe('service-role / secret exposure guards', () => {
  it('refuses to create service-role client when window is defined (browser)', () => {
    const prev = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = {}
    try {
      expect(() => createServiceRoleClient()).toThrow(BackendError)
      try {
        createServiceRoleClient()
      } catch (err) {
        expect(err).toBeInstanceOf(BackendError)
        expect((err as BackendError).code).toBe('SERVICE_ROLE_IN_BROWSER')
      }
    } finally {
      if (prev === undefined) delete (globalThis as { window?: unknown }).window
      else (globalThis as { window?: unknown }).window = prev
    }
  })

  it('refuses VITE_-prefixed service/secret keys in server config', () => {
    const prev = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = 'should-never-be-used'
    try {
      expect(() => getSupabaseServerConfig()).toThrow(/must not be exposed/)
    } finally {
      if (prev === undefined) delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      else process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = prev
    }
  })

  it('memory backend never claims government filing', async () => {
    const backend = createBackendServices({ mode: 'memory' })
    expect(backend.mode).toBe('memory')
    // live retrieval honest failure
    const live = await backend.liveRetrieval.retrieve({ schemeIds: ['nsfdc-micro-finance'] })
    expect(live.items).toEqual([])
    expect(live.ok).toBe(false)
  })
})
