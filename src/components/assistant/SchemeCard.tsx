import { useTranslation } from 'react-i18next'
import { ChevronRight, Landmark } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { RankedScheme } from '../../assistant/types'

export function SchemeCard({ ranked, onViewDetails }: { ranked: RankedScheme; onViewDetails: () => void }) {
  const { t } = useTranslation()
  const { scheme, eligibility } = ranked
  // A scheme can accumulate positive reasons (e.g. age fits) even when a
  // single hard mismatch elsewhere (e.g. an excluded sector) makes it
  // "Unlikely match" overall — showing that positive line as the headline
  // would misleadingly imply a better fit than the badge says. So for an
  // ineligible card, lead with the actual disqualifying reason instead.
  // A scheme with only a missing-info gap (no reason or mismatch yet, e.g.
  // "possibly eligible" pending one unknown field) would otherwise show a
  // blank summary line, which reads as an unexplained status rather than
  // an honest "here's what's still needed".
  const missingLine =
    eligibility.missingInfo.length > 0 ? `${t('assistant.missingForThis')}: ${eligibility.missingInfo[0]}` : undefined
  const topLine =
    eligibility.status === 'likely_ineligible'
      ? (eligibility.mismatchReasons[0] ?? eligibility.reasons[0] ?? missingLine)
      : (eligibility.reasons[0] ?? eligibility.mismatchReasons[0] ?? missingLine)

  return (
    <article aria-label={scheme.name} className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/45">
            <Landmark className="h-3 w-3" />
            {scheme.scope === 'state' ? scheme.state : t('assistant.detail.central')}
          </p>
          <h3 className="mt-0.5 line-clamp-2 font-display text-base font-bold text-forest" title={scheme.name}>
            {scheme.name}
          </h3>
        </div>
        <StatusBadge status={eligibility.status} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-ink/50">
          <span>{t('assistant.matchScore')}</span>
          <span className="font-bold text-ink/70">{eligibility.score}/100</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-mist">
          <div
            className="h-full rounded-full bg-forest transition-all"
            style={{ width: `${eligibility.score}%` }}
          />
        </div>
      </div>

      {topLine && <p className="mt-3 line-clamp-2 text-xs text-ink/70">{topLine}</p>}

      <button
        type="button"
        onClick={onViewDetails}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
      >
        {t('assistant.viewDetails')}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </article>
  )
}
