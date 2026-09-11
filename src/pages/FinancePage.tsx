import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { useApp } from '../state/useApp'
import { formatINR } from '../lib/finance'

export function FinancePage() {
  const { t, i18n } = useTranslation()
  const kn = i18n.language === 'kn'
  const { profile, plan, score } = useApp()

  if (!profile || !plan || !score) return <Navigate to="/scan" replace />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-forest">{t('finance.title')}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {kn
            ? 'ಮಾರ್ಜಿನ್ ÷ 10% = ಯೋಜನಾ ವೆಚ್ಚ · 90% ಸಾಲ · NSFDC ನಿಖರ ನಿಯಮ'
            : 'Margin ÷ 10% = project cost · 90% loan · exact NSFDC rules'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('finance.project')} value={formatINR(plan.projectCost)} />
        <Stat label={t('finance.loan')} value={formatINR(plan.loanAmount)} />
        <Stat
          label={t('finance.scheme')}
          value={kn ? plan.schemeNameKn : plan.schemeName}
          small
        />
      </div>

      <div className="glass grid gap-4 rounded-2xl p-5 sm:grid-cols-4">
        <Mini label={kn ? 'ಬಡ್ಡಿ' : 'Interest'} value={`${plan.interestRate}% p.a.`} />
        <Mini label={kn ? 'ಅವಧಿ' : 'Tenure'} value={`${plan.tenureYears} yrs`} />
        <Mini label={kn ? 'ಮೊರಟೋರಿಯಂ' : 'Moratorium'} value={`${plan.moratoriumMonths} mo`} />
        <Mini label={t('finance.emi')} value={formatINR(plan.quarterlyEmi)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-forest">{kn ? 'ಕಾರ್ಯ ಬಂಡವಾಳ ಸೂಚನೆ' : 'Working capital hint'}</h2>
          <p className="mt-2 font-display text-2xl font-bold">{formatINR(plan.workingCapitalHint)}</p>
          <p className="mt-1 text-sm text-ink/60">
            {kn ? 'ತಿಂಗಳ ಕಾರ್ಯಾಚರಣೆ ವೆಚ್ಚ' : 'Est. monthly ops'}: {formatINR(plan.opsCostMonthly)}
          </p>
          <p className="mt-3 text-sm text-ink/70">
            {kn
              ? 'ಮೊರಟೋರಿಯಂ ಕಾಲದಲ್ಲಿ ಬಡ್ಡಿ ಪಾವತಿ + ಕಾರ್ಯ ಬಂಡವಾಳವನ್ನು ಬೇರೆ ಇರಿಸಿ — ಇದು ವೈಫಲ್ಯದ ಮುಖ್ಯ ಕಾರಣ.'
              : 'Ring-fence working capital during moratorium — the #1 failure mode for new rural units.'}
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-forest">{kn ? 'ಯೋಜನೆ ತರ್ಕ' : 'Routing logic'}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-ink/75">
            <li>
              {kn ? 'ಯೋಜನಾ ವೆಚ್ಚ' : 'Project cost'} = {formatINR(profile.availableMargin)} / 10% ={' '}
              {formatINR(plan.projectCost)}
            </li>
            <li>
              {plan.projectCost <= 140000
                ? kn
                  ? '≤ ₹1.40L → ಮೈಕ್ರೋ ಫೈನಾನ್ಸ್ (6.5%, 3 ವರ್ಷ, 3 ತಿಂಗಳ ಮೊರಟೋರಿಯಂ)'
                  : '≤ ₹1.40L → Micro Finance (6.5%, 3 yrs, 3-mo moratorium)'
                : kn
                  ? '₹1.40L–₹50L → ಟರ್ಮ್ ಲೋನ್ (8%, 7 ವರ್ಷ, 6 ತಿಂಗಳ ಮೊರಟೋರಿಯಂ)'
                  : '₹1.40L–₹50L → Term Loan (8%, 7 yrs, 6-mo moratorium)'}
            </li>
            <li>
              {kn ? 'ಮಹಿಳಾ ಆದ್ಯತೆ ಗುರಿ 40% · SC + ಆದಾಯ ಮಿತಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ' : 'Women 40% target · SC + income ceiling checked'}
            </li>
          </ol>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-forest/10 px-5 py-3 font-semibold text-forest">
          {t('finance.schedule')}
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-mist text-xs uppercase text-ink/55">
              <tr>
                <th className="px-4 py-2">Q</th>
                <th className="px-4 py-2">{kn ? 'ದಿನಾಂಕ' : 'Due'}</th>
                <th className="px-4 py-2">{kn ? 'ಮೂಲ' : 'Principal'}</th>
                <th className="px-4 py-2">{kn ? 'ಬಡ್ಡಿ' : 'Interest'}</th>
                <th className="px-4 py-2">{kn ? 'ಒಟ್ಟು' : 'Total'}</th>
                <th className="px-4 py-2">{kn ? 'ಸ್ಥಿತಿ' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {plan.schedule.slice(0, 12).map((row) => (
                <tr key={row.quarter} className="border-t border-forest/5">
                  <td className="px-4 py-2">{row.quarter}</td>
                  <td className="px-4 py-2">{row.dueDateLabel}</td>
                  <td className="px-4 py-2">{formatINR(row.principal)}</td>
                  <td className="px-4 py-2">{formatINR(row.interest)}</td>
                  <td className="px-4 py-2 font-medium">{formatINR(row.total)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.status === 'moratorium' ? 'bg-gold/30 text-ink' : 'bg-mist text-forest'
                      }`}
                    >
                      {row.status === 'moratorium'
                        ? kn
                          ? 'ಮೊರಟೋರಿಯಂ'
                          : 'moratorium'
                        : kn
                          ? 'ಮರುಪಾವತಿ'
                          : 'repayment'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {plan.schedule.length > 12 && (
          <p className="border-t border-forest/10 px-5 py-2 text-xs text-ink/50">
            {kn ? `+${plan.schedule.length - 12} ಇನ್ನಷ್ಟು ತ್ರೈಮಾಸಿಕಗಳು` : `+${plan.schedule.length - 12} more quarters`}
          </p>
        )}
      </div>

      <Link
        to="/sanction"
        className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-white"
      >
        {t('finance.continue')} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className={`mt-1 font-display font-bold text-forest ${small ? 'text-base leading-snug' : 'text-2xl'}`}>
        {value}
      </p>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink/50">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
    </div>
  )
}
