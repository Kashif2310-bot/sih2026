import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

export function StarterQuestions({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  const starters = [t('assistant.starter1'), t('assistant.starter2'), t('assistant.starter3'), t('assistant.starter4')]

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink/50">
        <Sparkles className="h-3.5 w-3.5" />
        {t('assistant.starterTitle')}
      </p>
      <div className="flex flex-col gap-2">
        {starters.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-left text-sm text-ink/80 transition hover:border-forest/40 hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
