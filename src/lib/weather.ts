import type { WeatherSignal } from './lokScore'

const WMO: Record<number, { en: string; kn: string }> = {
  0: { en: 'Clear sky', kn: 'ಸ್ವಚ್ಛ ಆಕಾಶ' },
  1: { en: 'Mainly clear', kn: 'ಬಹುತೇಕ ಸ್ವಚ್ಛ' },
  2: { en: 'Partly cloudy', kn: 'ಭಾಗಶಃ ಮೋಡ' },
  3: { en: 'Overcast', kn: 'ಮೋಡ ಕವಿದ' },
  45: { en: 'Fog', kn: 'ಮಂಜು' },
  61: { en: 'Slight rain', kn: 'ಸ್ವಲ್ಪ ಮಳೆ' },
  63: { en: 'Moderate rain', kn: 'ಮಧ್ಯಮ ಮಳೆ' },
  65: { en: 'Heavy rain', kn: 'ಭಾರೀ ಮಳೆ' },
  80: { en: 'Rain showers', kn: 'ಮಳೆ ಸುರಿತ' },
  95: { en: 'Thunderstorm', kn: 'ಗುಡುಗು ಮಳೆ' },
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherSignal> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
    `&timezone=Asia%2FKolkata&forecast_days=7`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather fetch failed')
  const data = await res.json()
  const code = Number(data.daily.weathercode?.[0] ?? 2)
  const label = WMO[code] ?? WMO[2]
  return {
    tempMax: Number(data.daily.temperature_2m_max[0]),
    tempMin: Number(data.daily.temperature_2m_min[0]),
    precipProb: Number(data.daily.precipitation_probability_max?.[0] ?? 20),
    precipMm: Number(data.daily.precipitation_sum?.[0] ?? 0),
    code,
    summary: label.en,
    summaryKn: label.kn,
    source: 'live',
  }
}

export async function fetchWeekTemps(lat: number, lng: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=Asia%2FKolkata&forecast_days=7`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather week failed')
  const data = await res.json()
  return (data.daily.time as string[]).map((date: string, i: number) => ({
    date,
    max: Number(data.daily.temperature_2m_max[i]),
    min: Number(data.daily.temperature_2m_min[i]),
    rain: Number(data.daily.precipitation_probability_max[i]),
  }))
}

export function unavailableWeather(): WeatherSignal {
  return {
    tempMax: 0,
    tempMin: 0,
    precipProb: 0,
    precipMm: 0,
    code: -1,
    summary: 'Live weather unavailable',
    summaryKn: 'ಲೈವ್ ಹವಾಮಾನ ಲಭ್ಯವಿಲ್ಲ',
    source: 'unavailable',
  }
}
