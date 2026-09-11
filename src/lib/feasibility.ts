import type { BusinessCategory } from '../data/villages'
import { BUSINESS_META } from '../data/villages'
import type { EntrepreneurProfile, MandiSignal, WeatherSignal } from './lokScore'
import { getUpcomingEvents } from '../data/festivals'
import type { ResolvedLocation } from './resolveLocation'
import type { SchemePlan } from './finance'
import { formatINR } from './finance'
import { areaKm2 } from './geo'

export function buildFeasibility(input: {
  profile: EntrepreneurProfile
  location: ResolvedLocation
  weather: WeatherSignal
  mandi: MandiSignal | null
  plan: SchemePlan
  lang: 'en' | 'kn'
}) {
  const { profile, location, weather, mandi, plan, lang } = input
  const kn = lang === 'kn'
  const cat = profile.category
  const density = location.competitorDensity[cat]
  const radiusKm = location.radiusKm
  const area = areaKm2(radiusKm)
  const competitorCount = location.competitors.length
  const densityPerKm2 = location.competitorQueryOk ? competitorCount / area : null

  const reach =
    location.households != null && location.population != null
      ? Math.round(location.households * 1.8 + location.population * 0.35)
      : null

  const events = location.hasCuratedSignals ? getUpcomingEvents(location.id) : []
  const pricing = suggestPricing(cat, location, mandi)

  // Opportunity analysis: categories with lowest density relative to selected
  const underrepresented = (Object.keys(location.competitorDensity) as BusinessCategory[])
    .map((k) => ({
      key: k,
      density: location.competitorDensity[k],
      label: kn ? BUSINESS_META[k].labelKn : BUSINESS_META[k].label,
    }))
    .sort((a, b) => a.density - b.density)
    .slice(0, 3)

  const monthlyEmi = plan.quarterlyEmi / 3
  const priceCoversEmi =
    pricing.optimal > 0 && monthlyEmi > 0
      ? {
          unitsNeeded: Math.ceil(monthlyEmi / pricing.optimal),
          monthlyEmi,
          unitPrice: pricing.optimal,
        }
      : null

  const strengths = kn
    ? [
        reach != null
          ? `${location.nameKn}ನಲ್ಲಿ ~${reach.toLocaleString('en-IN')} ಗ್ರಾಹಕ ವ್ಯಾಪ್ತಿ (${radiusKm} ಕಿ.ಮೀ).`
          : `${location.nameKn} — ಜನಸಂಖ್ಯೆ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ (ಕಲ್ಪಿತವಲ್ಲ); ತ್ರಿಜ್ಯ ${radiusKm} ಕಿ.ಮೀ.`,
        `ಲಭ್ಯ ಮಾರ್ಜಿನ್ ₹${profile.availableMargin.toLocaleString('en-IN')} — NSFDC 10% ನಿಯಮಕ್ಕೆ ಸರಿ.`,
        location.provenanceLabelKn,
      ]
    : [
        reach != null
          ? `~${reach.toLocaleString('en-IN')} consumer reach within ${radiusKm} km of ${location.name}.`
          : `${location.name} — population unknown (not fabricated); radius ${radiusKm} km.`,
        `Margin ₹${profile.availableMargin.toLocaleString('en-IN')} maps to NSFDC 10% rule.`,
        location.provenanceLabelEn,
      ]

  const weaknesses = kn
    ? [
        profile.experienceYears < 2 ? 'ಕಡಿಮೆ ಅನುಭವ — 90 ದಿನ ಮಾರ್ಗದರ್ಶನ ಅಗತ್ಯ.' : 'ಕಾರ್ಯಾಚರಣೆ ಶಿಸ್ತು ನಿರ್ವಹಿಸಬೇಕು.',
        density > 0.65 ? 'ತ್ರಿಜ್ಯದಲ್ಲಿ ಸ್ಪರ್ಧಿ ಸಾಂದ್ರತೆ ಹೆಚ್ಚು.' : 'ಬ್ರ್ಯಾಂಡ್ ಗುರುತು ಇನ್ನೂ ರೂಪುಗೊಳ್ಳಬೇಕು.',
        'ಕಾರ್ಯ ಬಂಡವಾಳವನ್ನು ಸಾಲದಿಂದ ಬೇರ್ಪಡಿಸಿ ಇಡಬೇಕು.',
      ]
    : [
        profile.experienceYears < 2 ? 'Limited experience — needs 90-day mentor rails.' : 'Must enforce operating discipline early.',
        density > 0.65 ? 'High competitor density in the radius.' : 'Brand recognition still to be built.',
        'Working capital must be ring-fenced from loan principal.',
      ]

  const opportunities = kn
    ? [
        ...underrepresented.map(
          (u) => `${u.label}: ಸಾಂದ್ರತೆ ${(u.density * 100).toFixed(0)}% — ತುಲನಾತ್ಮಕವಾಗಿ ಕಡಿಮೆ ಪ್ರಾತಿನಿಧ್ಯ.`,
        ),
        ...(cat === 'dairy' && density > 0.55
          ? ['ಕಚ್ಚಾ ಹಾಲು ತುಂಬಿದೆ — ಪನೀರ್/ತುಪ್ಪ/ಮೊಸರು ಕಿಟ್‌ನಲ್ಲಿ ಅಂತರ.']
          : []),
        ...events.slice(0, 2).map((e) => `${e.nameKn}: ${e.actionKn}`),
      ]
    : [
        ...underrepresented.map(
          (u) => `${u.label}: density ${(u.density * 100).toFixed(0)}% — relatively under-represented nearby.`,
        ),
        ...(cat === 'dairy' && density > 0.55
          ? ['Raw milk saturated — gap in paneer/ghee/curd kits.']
          : []),
        ...events.slice(0, 2).map((e) => `${e.name}: ${e.action}`),
      ]

  const threats = kn
    ? [
        weather.source === 'unavailable'
          ? 'ಲೈವ್ ಹವಾಮಾನ ಲಭ್ಯವಿಲ್ಲ — ಋತು ಅಪಾಯವನ್ನು ಕೈಯಿಂದ ಪರಿಶೀಲಿಸಿ.'
          : weather.tempMax >= 36 && (cat === 'dairy' || cat === 'poultry')
            ? 'ಹೆಚ್ಚು ಉಷ್ಣತೆ — ಇಳುವರಿ/ಸಂಗ್ರಹ ವೆಚ್ಚ ಏರಿಕೆ.'
            : 'ಋತುಮಾನ ಬೇಡಿಕೆ ಏರಿಳಿತ.',
        'ಒಂದೇ ಖರೀದುದಾರ ಅವಲಂಬನೆ.',
        mandi?.source === 'seeded' && mandi.trend === 'down'
          ? `${mandi.commodity} ಬೆಲೆ ಇಳಿಕೆ (${mandi.changePct}%).`
          : mandi == null
            ? 'ಮಂಡಿ ಬೆಲೆ ಲಭ್ಯವಿಲ್ಲ (ಲೈವ್ ಸ್ಥಳ — ಕಲ್ಪಿತವಲ್ಲ).'
            : 'ಸರಬರಾಜು ಸರಪಳಿ ವಿಳಂಬ.',
      ]
    : [
        weather.source === 'unavailable'
          ? 'Live weather unavailable — verify seasonal risk manually.'
          : weather.tempMax >= 36 && (cat === 'dairy' || cat === 'poultry')
            ? 'Heat stress risk — yield / cold-chain costs rise.'
            : 'Seasonal demand swings.',
        'Single-buyer dependency.',
        mandi?.source === 'seeded' && mandi.trend === 'down'
          ? `${mandi.commodity} price softening (${mandi.changePct}%).`
          : mandi == null
            ? 'Mandi prices unavailable for live locations (not fabricated).'
            : 'Supply-chain delays on peak days.',
      ]

  const channels = kn
    ? [
        'ಮನೆ-ಮನೆ / WhatsApp ಗ್ರಾಹಕ ಪಟ್ಟಿ',
        location.milkCoopPresence ? 'ಸಹಕಾರಿ ಸಂಗ್ರಹ ಕೇಂದ್ರ' : 'ಸ್ಥಳೀಯ ಮಾರುಕಟ್ಟೆ / APMC',
        'ಜಾತ್ರೆ / ದೇವಸ್ಥಾನ ಸರತಿ ಅಂಗಡಿ',
        'ಹತ್ತಿರದ ಶಾಲೆ / ಆಫೀಸ್ ಬಲ್ಕ್',
      ]
    : [
        'Doorstep / WhatsApp customer list',
        location.milkCoopPresence ? 'Cooperative collection centre' : 'Local market / APMC',
        'Jatra / temple-queue stall',
        'Nearby school / office bulk',
      ]

  return {
    reach,
    radiusKm,
    competitorCount,
    densityPerKm2,
    strengths,
    weaknesses,
    opportunities,
    threats,
    channels,
    pricing,
    density,
    underrepresented,
    priceCoversEmi,
    saturationLabel: densityLabel(density, kn, location.competitorQueryOk),
    priceEmiNote: priceCoversEmi
      ? kn
        ? `ತಿಂಗಳ EMI ${formatINR(priceCoversEmi.monthlyEmi)} ಸೇವೆ ಮಾಡಲು ~${priceCoversEmi.unitsNeeded} ಘಟಕ/ತಿಂಗಳು @ ${formatINR(priceCoversEmi.unitPrice)} ಬೇಕು.`
        : `To service monthly EMI ${formatINR(priceCoversEmi.monthlyEmi)} need ~${priceCoversEmi.unitsNeeded} units/month at ${formatINR(priceCoversEmi.unitPrice)}.`
      : null,
  }
}

function densityLabel(d: number, kn: boolean, ok: boolean) {
  if (!ok) return kn ? 'ಲೈವ್ ಸ್ಪರ್ಧಿ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ' : 'Live competitor data unavailable'
  if (d < 0.4) return kn ? 'ಕಡಿಮೆ ಸಾಂದ್ರತೆ — ಅವಕಾಶ ಹೆಚ್ಚು' : 'Low density — greenfield opportunity'
  if (d < 0.65) return kn ? 'ಮಧ್ಯಮ ಸಾಂದ್ರತೆ — ವ್ಯತ್ಯಾಸ ಅಗತ್ಯ' : 'Moderate density — differentiate'
  return kn ? 'ಹೆಚ್ಚು ಸಾಂದ್ರತೆ — ನಿಚ್ / ಮೌಲ್ಯವರ್ಧನೆ' : 'High density — niche / value-add required'
}

function suggestPricing(
  cat: BusinessCategory,
  location: ResolvedLocation,
  mandi: MandiSignal | null,
) {
  const ppi = location.purchasingPowerIndex ?? 0.55
  if (cat === 'dairy') {
    const base = mandi?.modalPrice ?? 42
    return {
      unit: '₹/litre milk · paneer ₹/kg',
      low: Math.round(base * 0.95),
      optimal: Math.round(base * (1.02 + ppi * 0.05)),
      premium: Math.round(base * 1.15),
      valueAdd: 'Paneer ₹320–380/kg · Ghee ₹550–650/kg during festival week',
      valueAddKn: 'ಹಬ್ಬ ವಾರ: ಪನೀರ್ ₹320–380/ಕೆಜಿ · ತುಪ್ಪ ₹550–650/ಕೆಜಿ',
      sourcedFromMandi: mandi?.source === 'seeded',
    }
  }
  if (cat === 'food') {
    return {
      unit: '₹ per thali / combo',
      low: 40,
      optimal: Math.round(60 + ppi * 40),
      premium: Math.round(90 + ppi * 50),
      valueAdd: 'Festival veg combo + buttermilk bundle',
      valueAddKn: 'ಹಬ್ಬದ ಸಸ್ಯಾಹಾರಿ ಕಾಂಬೋ + ಮಜ್ಜಿಗೆ ಬಂಡಲ್',
      sourcedFromMandi: false,
    }
  }
  return {
    unit: mandi?.unit ?? '₹',
    low: Math.round((mandi?.minPrice ?? 100) * 0.98),
    optimal: Math.round((mandi?.modalPrice ?? 120) * (1 + ppi * 0.04)),
    premium: Math.round((mandi?.maxPrice ?? 140) * 1.05),
    valueAdd: 'Bundle with festival kit to lift basket size 18–25%',
    valueAddKn: 'ಹಬ್ಬದ ಕಿಟ್‌ನೊಂದಿಗೆ ಬಂಡಲ್ — ಬಾಸ್ಕೆಟ್ 18–25% ಏರಿಕೆ',
    sourcedFromMandi: mandi?.source === 'seeded',
  }
}
