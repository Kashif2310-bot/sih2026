import { BUSINESS_META, type BusinessCategory } from '../data/villages'
import type { ResolvedLocation } from './resolveLocation'

export async function fetchMandiSignal(
  location: ResolvedLocation,
  category: BusinessCategory,
): Promise<import('./lokScore').MandiSignal | null> {
  // Seeded quotes only for curated villages — never invent mandi for live lookups (Rule 4).
  if (!location.hasCuratedSignals) {
    return null
  }
  const commodity = BUSINESS_META[category].mandiCommodity ?? defaultCommodity(category)
  return synthesizeMandi(location, commodity, category)
}

function defaultCommodity(category: BusinessCategory) {
  switch (category) {
    case 'dairy':
      return 'Cow Milk'
    case 'poultry':
      return 'Broiler Chicken'
    case 'agri_processing':
      return 'Ragi'
    case 'food':
      return 'Onion'
    case 'textiles':
      return 'Cotton'
    default:
      return 'Potato'
  }
}

function synthesizeMandi(
  location: ResolvedLocation,
  commodity: string,
  category: BusinessCategory,
): import('./lokScore').MandiSignal {
  const day = new Date().getDate()
  const seed = Math.abs(hash(`${location.id}-${commodity}-${day}`))
  const base =
    category === 'dairy'
      ? 42
      : category === 'poultry'
        ? 120
        : category === 'agri_processing'
          ? 3200
          : category === 'textiles'
            ? 6800
            : 1800
  const ppi = location.purchasingPowerIndex ?? 0.55
  const wobble = ((seed % 17) - 8) / 100
  const modal = Math.round(base * (1 + wobble) * (0.95 + ppi * 0.08))
  const changePct = ((seed % 21) - 10) / 2
  return {
    commodity,
    market: location.nearbyMandi,
    modalPrice: modal,
    minPrice: Math.round(modal * 0.92),
    maxPrice: Math.round(modal * 1.08),
    unit: category === 'dairy' ? '₹/litre' : '₹/quintal',
    trend: changePct > 1.5 ? 'up' : changePct < -1.5 ? 'down' : 'flat',
    changePct,
    source: 'seeded',
  }
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
