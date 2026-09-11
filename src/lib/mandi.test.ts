import { describe, expect, it, vi, afterEach } from 'vitest'
import { VILLAGES } from '../data/villages'
import { curatedLocationFromVillage } from './resolveLocation'
import { REACH_KM } from './config'
import { fetchMandiSignal } from './mandi'

const location = curatedLocationFromVillage(VILLAGES[0], REACH_KM.default)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchMandiSignal', () => {
  it('returns structured mandi quote for dairy (seeded / not live Agmarknet)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true }),
    )
    const signal = await fetchMandiSignal(location, 'dairy')
    expect(signal).not.toBeNull()
    expect(signal!.commodity).toBeTruthy()
    expect(signal!.market).toBe(VILLAGES[0].nearbyMandi)
    expect(signal!.modalPrice).toBeGreaterThan(0)
    expect(signal!.minPrice).toBeLessThanOrEqual(signal!.modalPrice)
    expect(signal!.maxPrice).toBeGreaterThanOrEqual(signal!.modalPrice)
    expect(['up', 'down', 'flat']).toContain(signal!.trend)
  })

  it('is deterministic for same village/category/day', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const a = await fetchMandiSignal(location, 'dairy')
    const b = await fetchMandiSignal(location, 'dairy')
    expect(a).toEqual(b)
  })

  it('returns null for live (non-curated) locations — never fabricated', async () => {
    const live = { ...location, hasCuratedSignals: false }
    const signal = await fetchMandiSignal(live, 'dairy')
    expect(signal).toBeNull()
  })
})
