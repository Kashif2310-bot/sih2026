import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { useApp } from '../state/useApp'
import { VILLAGES } from '../data/villages'
import { buildFeasibility } from '../lib/feasibility'

export function ReportPage() {
  const { t, i18n } = useTranslation()
  const kn = i18n.language === 'kn'
  const { profile, weather, mandi, score } = useApp()

  if (!profile || !weather || !mandi || !score) return <Navigate to="/scan" replace />

  const village = VILLAGES.find((v) => v.id === profile.villageId)!
  const report = buildFeasibility({
    profile,
    village,
    weather,
    mandi,
    lang: kn ? 'kn' : 'en',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-forest">{t('report.title')}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {kn ? village.nameKn : village.name} · LokScore {score.total} ({score.grade})
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Block title={t('report.swot')}>
          <SwotGrid
            s={report.strengths}
            w={report.weaknesses}
            o={report.opportunities}
            t={report.threats}
            kn={kn}
          />
        </Block>
        <div className="space-y-4">
          <Block title={t('report.competitors')}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink/70">{report.saturationLabel}</p>
              <p className="font-display text-2xl font-bold text-forest">
                {Math.round(report.density * 100)}%
              </p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-mist">
              <div className="h-full rounded-full bg-clay" style={{ width: `${report.density * 100}%` }} />
            </div>
          </Block>
          <Block title={t('report.pricing')}>
            <p className="text-xs text-ink/50">{report.pricing.unit}</p>
            <div className="mt-2 flex gap-2 text-center text-sm">
              <PriceChip label={kn ? 'ಕಡಿಮೆ' : 'Floor'} value={report.pricing.low} />
              <PriceChip label={kn ? 'ಆದರ್ಶ' : 'Optimal'} value={report.pricing.optimal} highlight />
              <PriceChip label={kn ? 'ಪ್ರೀಮಿಯಂ' : 'Premium'} value={report.pricing.premium} />
            </div>
            <p className="mt-3 text-sm text-forest">
              {kn ? report.pricing.valueAddKn : report.pricing.valueAdd}
            </p>
          </Block>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Block title={t('report.opportunities')}>
          <ul className="space-y-2 text-sm text-ink/80">
            {report.opportunities.map((x) => (
              <li key={x} className="rounded-xl bg-mist/80 px-3 py-2">
                {x}
              </li>
            ))}
          </ul>
        </Block>
        <Block title={t('report.threats')}>
          <ul className="space-y-2 text-sm text-ink/80">
            {report.threats.map((x) => (
              <li key={x} className="rounded-xl bg-[#fff1ed] px-3 py-2 text-clay">
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/45">
            {kn ? 'ವಿತರಣಾ ಮಾರ್ಗಗಳು' : 'Distribution channels'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.channels.map((c) => (
              <span key={c} className="rounded-full border border-forest/15 bg-white px-3 py-1 text-xs">
                {c}
              </span>
            ))}
          </div>
        </Block>
      </div>

      <Link
        to="/finance"
        className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-white"
      >
        {t('report.continue')} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-display text-lg font-bold text-forest">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function PriceChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex-1 rounded-xl px-2 py-3 ${highlight ? 'bg-forest text-white' : 'bg-mist'}`}>
      <p className={`text-[10px] uppercase ${highlight ? 'text-white/70' : 'text-ink/50'}`}>{label}</p>
      <p className="font-bold">₹{value}</p>
    </div>
  )
}

function SwotGrid({
  s,
  w,
  o,
  t,
  kn,
}: {
  s: string[]
  w: string[]
  o: string[]
  t: string[]
  kn: boolean
}) {
  const cells = [
    { title: kn ? 'ಶಕ್ತಿ' : 'Strengths', items: s, bg: 'bg-[#e8f6ee]' },
    { title: kn ? 'ದುರ್ಬಲತೆ' : 'Weaknesses', items: w, bg: 'bg-[#fff7e8]' },
    { title: kn ? 'ಅವಕಾಶ' : 'Opportunities', items: o, bg: 'bg-[#e8f1f8]' },
    { title: kn ? 'ಅಪಾಯ' : 'Threats', items: t, bg: 'bg-[#ffece8]' },
  ]
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cells.map((c) => (
        <div key={c.title} className={`rounded-xl ${c.bg} p-3`}>
          <p className="text-xs font-bold uppercase tracking-wide text-ink/55">{c.title}</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink/80">
            {c.items.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
