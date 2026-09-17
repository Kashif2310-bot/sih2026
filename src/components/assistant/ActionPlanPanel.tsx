import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import type { ActionPlanStep } from '../../assistant/orchestrator'

export function ActionPlanPanel({ steps }: { steps: ActionPlanStep[] }) {
  const { t } = useTranslation()

  return (
    <div className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-forest">
        <ListChecks className="h-4 w-4" />
        {t('assistant.actionPlanTitle')}
      </h2>
      {steps.length === 0 ? (
        <p className="mt-2 text-xs text-ink/50">{t('assistant.actionPlanEmpty')}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {steps.map((s) => (
            <li key={`${s.schemeId}-${s.order}`} className="flex gap-3 text-sm">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest text-[11px] font-bold text-white">
                {s.order}
              </span>
              <div>
                <p className="text-ink/80">{s.text}</p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink/40">{s.schemeName}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
