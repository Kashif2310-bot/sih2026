import { useTranslation } from 'react-i18next'
import { ClipboardList, HelpCircle } from 'lucide-react'
import { normalizeSectorLabel } from '../../assistant/lexicon'
import type { MissingFieldInfo } from '../../assistant/missingFields'
import type { UserProfile } from '../../assistant/types'

type FieldKey = keyof Omit<UserProfile, 'rawNotes'>

const FIELD_ORDER: FieldKey[] = [
  'businessSector',
  'proposedBusiness',
  'businessStage',
  'businessStatus',
  'financingRequired',
  'investmentRequired',
  'ownContribution',
  'state',
  'district',
  'areaType',
  'age',
  'gender',
  'socialCategory',
  'annualIncome',
  'occupation',
  'existingLoans',
  'education',
  'landOrAssets',
]

function renderValue(profile: UserProfile, key: FieldKey): string | undefined {
  switch (key) {
    case 'businessSector':
      return profile.businessSector ? normalizeSectorLabel(profile.businessSector) : undefined
    case 'socialCategory':
      return profile.socialCategory?.toUpperCase()
    case 'annualIncome':
    case 'investmentRequired':
    case 'ownContribution':
    case 'financingRequired': {
      const v = profile[key]
      return v !== undefined ? `₹${v.toLocaleString('en-IN')}` : undefined
    }
    case 'age':
      return profile.age?.toString()
    case 'businessStage':
      return profile.businessStage === 'existing_expansion' ? 'existing expansion' : profile.businessStage
    default: {
      const v = profile[key]
      return typeof v === 'string' ? v : undefined
    }
  }
}

export function ProfileSidebar({
  profile,
  missingFields,
}: {
  profile: UserProfile
  missingFields: MissingFieldInfo[]
}) {
  const { t } = useTranslation()
  const rows = FIELD_ORDER.map((key) => ({ key, value: renderValue(profile, key) })).filter(
    (r): r is { key: FieldKey; value: string } => r.value !== undefined,
  )

  return (
    <div className="glass space-y-5 rounded-2xl p-4">
      <div>
        <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-forest">
          <ClipboardList className="h-4 w-4" />
          {t('assistant.profileTitle')}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-xs text-ink/50">{t('assistant.profileEmpty')}</p>
        ) : (
          <dl className="mt-3 space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-ink/50">{t(`assistant.field.${r.key}`)}</dt>
                <dd className="truncate text-right font-medium text-ink/85" title={r.value}>
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="border-t border-forest/10 pt-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink/50">
          <HelpCircle className="h-3.5 w-3.5" />
          {t('assistant.missingTitle')}
        </h3>
        {missingFields.length === 0 ? (
          <p className="mt-2 text-xs text-ink/50">{t('assistant.missingEmpty')}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingFields.slice(0, 6).map((m) => (
              <span
                key={m.field}
                className="rounded-full border border-forest/15 bg-white px-2.5 py-1 text-xs text-ink/65"
              >
                {t(`assistant.field.${m.field}`, m.field)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
