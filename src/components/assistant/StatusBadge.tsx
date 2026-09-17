import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import clsx from 'clsx'
import type { EligibilityStatus } from '../../assistant/types'

const STYLES: Record<EligibilityStatus, { className: string; Icon: typeof CheckCircle2 }> = {
  likely_eligible: { className: 'bg-[#e8f6ee] text-forest border-forest/20', Icon: CheckCircle2 },
  possibly_eligible: { className: 'bg-[#fff7e8] text-[#8a6a00] border-gold/40', Icon: AlertTriangle },
  insufficient_data: { className: 'bg-[#e8f1f8] text-sky border-sky/25', Icon: HelpCircle },
  likely_ineligible: { className: 'bg-[#fff1ed] text-clay border-clay/25', Icon: XCircle },
}

export function StatusBadge({ status }: { status: EligibilityStatus }) {
  const { t } = useTranslation()
  const { className, Icon } = STYLES[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {t(`assistant.status.${status}`)}
    </span>
  )
}
