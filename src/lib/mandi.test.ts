import { describe, expect, it, vi, afterEach } from 'vitest'
import { VILLAGES } from '../data/villages'
import { fetchMandiSignal } from './mandi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchMandiSignal', () => {
  it('returns structured mandi quote for dairy (seeded / not live Agmarknet)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true }),
    )
    const signal = await fetchMandiSignal(VILLAGES[0], 'dairy')
    expect(signal.commodity).toBeTruthy()
    expect(signal.market).toBe(VILLAGES[0].nearbyMandi)
    expect(signal.modalPrice).toBeGreaterThan(0)
    expect(signal.minPrice).toBeLessThanOrEqual(signal.modalPrice)
    expect(signal.maxPrice).toBeGreaterThanOrEqual(signal.modalPrice)
    expect(['up', 'down', 'flat']).toContain(signal.trend)
  })

  it('is deterministic for same village/category/day', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const a = await fetchMandiSignal(VILLAGES[0], 'dairy')
    const b = await fetchMandiSignal(VILLAGES[0], 'dairy')
    expect(a).toEqual(b)
  })
})
