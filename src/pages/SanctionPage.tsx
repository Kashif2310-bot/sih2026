import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, FileDown, Lock, Shield, Sparkles } from 'lucide-react'
import { useApp } from '../state/useApp'
import { formatINR } from '../lib/finance'
import { quorumMet } from '../lib/multisig'

export function SanctionPage() {
  const { t, i18n } = useTranslation()
  const kn = i18n.language === 'kn'
  const {
    profile,
    plan,
    score,
    attestation,
    signatures,
    verifiers,
    escrowReleased,
    signAs,
    releaseEscrow,
  } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!profile || !plan || !score || !attestation) return <Navigate to="/scan" replace />

  const pool = verifiers.slice(0, score.quorumPool)
  const met = quorumMet(score, signatures)

  const onSign = async (id: string) => {
    setBusy(id)
    setErr(null)
    try {
      await signAs(id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-forest">{t('sanction.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">{t('sanction.subtitle')}</p>
        <p className="mt-3 inline-block rounded-full border border-gold/40 bg-gold/20 px-3 py-1 text-xs font-semibold text-ink">
          {t('sanction.fixtureIdentities')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-forest">
            <Shield className="h-4 w-4" /> {t('sanction.hash')}
          </div>
          <p className="mt-3 break-all rounded-xl bg-ink px-3 py-3 font-mono text-xs text-gold">
            {attestation.reportHash}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink/45">{kn ? 'ಉದ್ಯಮಿ' : 'Entrepreneur'}</dt>
              <dd className="font-medium">{profile.name}</dd>
            </div>
            <div>
              <dt className="text-ink/45">LokScore</dt>
              <dd className="font-medium">
                {score.total} / {score.grade}
              </dd>
            </div>
            <div>
              <dt className="text-ink/45">{kn ? 'ಸಾಲ' : 'Loan'}</dt>
              <dd className="font-medium">{formatINR(plan.loanAmount)}</dd>
            </div>
            <div>
              <dt className="text-ink/45">{kn ? 'ಕೋರಂ' : 'Quorum'}</dt>
              <dd className="font-medium">
                {signatures.length}/{score.quorumRequired} of {score.quorumPool}
              </dd>
            </div>
          </dl>
          {score.mentorRequired && (
            <p className="mt-4 rounded-xl bg-[#fff7e8] px-3 py-2 text-sm text-clay">
              {kn
                ? 'ಕಡಿಮೆ ಲೋಕ್‌ಸ್ಕೋರ್ — ಮಾರ್ಗದರ್ಶಕ ನಿಯೋಜನೆ ಕಡ್ಡಾಯ + ಹೆಚ್ಚು ಪರಿಶೀಲಕರು.'
                : 'Lower LokScore — mentor assignment mandatory + more verifiers.'}
            </p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold text-forest">
            {kn ? 'ಅಡಾಪ್ಟಿವ್ ಕೋರಂ ನಿಯಮ' : 'Adaptive quorum rule'}
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink/75">
            <li className={score.total >= 80 ? 'font-bold text-forest' : ''}>
              ≥ 80 → 2 of 3 SCA officers
            </li>
            <li className={score.total >= 60 && score.total < 80 ? 'font-bold text-forest' : ''}>
              60–79 → 3 of 5 verifiers
            </li>
            <li className={score.total < 60 ? 'font-bold text-forest' : ''}>
              &lt; 60 → 4 of 5 + mentor
            </li>
          </ul>
          <p className="mt-4 text-xs text-ink/50">
            {kn
              ? 'ಪ್ರತಿ ಸಹಿ ನಿಜವಾದ secp256k1 ECDSA (ethers.js). ನಕಲಿ ಟಿಕ್ ಅಲ್ಲ.'
              : 'Each signature is real secp256k1 ECDSA via ethers.js — not a fake checkbox.'}
          </p>
        </div>
      </div>

      <p className="rounded-xl border border-gold/30 bg-[#fff7e8] px-4 py-2 text-xs font-semibold text-ink">
        {t('sanction.fixtureIdentities')}
      </p>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {pool.map((v) => {
          const signed = signatures.find((s) => s.verifierId === v.id)
          return (
            <div key={v.id} className="glass rounded-2xl p-4">
              <p className="font-semibold text-ink">{kn ? v.nameKn : v.name}</p>
              <p className="text-xs text-ink/50">{kn ? v.roleKn : v.role}</p>
              <p className="mt-2 truncate font-mono text-[10px] text-ink/40">{v.wallet.address}</p>
              {signed ? (
                <div className="mt-3 space-y-2">
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-leaf">
                    <CheckCircle2 className="h-4 w-4" /> {t('sanction.signed')}
                  </p>
                  <p className="break-all font-mono text-[10px] text-ink/45">{signed.signature.slice(0, 42)}…</p>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void onSign(v.id)}
                  aria-label={`${t('sanction.sign')} — ${kn ? v.nameKn : v.name}`}
                  className="mt-3 rounded-full bg-forest px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busy === v.id ? '…' : t('sanction.sign')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-forest">
              {kn ? 'ಸಿಮ್ಯುಲೇಟೆಡ್ ಎಸ್ಕ್ರೋ ಸ್ಕೆಚ್' : 'Simulated escrow sketch'}
            </h2>
            <p className="text-sm text-ink/60">{t('sanction.escrowSketch')}</p>
          </div>
          {met ? (
            <button
              type="button"
              onClick={releaseEscrow}
              disabled={escrowReleased}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {escrowReleased ? t('sanction.released') : t('sanction.release')}
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-mist px-4 py-2 text-sm font-semibold text-ink/60">
              <Lock className="h-4 w-4" /> {t('sanction.locked')}
            </span>
          )}
        </div>

        {escrowReleased && (
          <div className="mt-4 rounded-xl border border-leaf/30 bg-[#e8f6ee] p-4 text-sm text-forest">
            <p className="font-bold">{t('sanction.simulatedRelease')}</p>
            <p className="mt-1">
              {formatINR(plan.loanAmount)} → {profile.name} · attestation {attestation.reportHash.slice(0, 18)}…
            </p>
            <p className="mt-2 text-xs">{t('sanction.escrowSketch')}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/export"
          className="inline-flex items-center gap-2 rounded-full border border-forest/20 bg-white px-4 py-2 text-sm font-semibold text-forest"
        >
          <FileDown className="h-4 w-4" /> {t('nav.export')}
        </Link>
        <Link to="/" className="text-sm font-semibold text-forest underline-offset-2 hover:underline">
          {kn ? '← ಮುಖಪುಟಕ್ಕೆ' : '← Back to home'}
        </Link>
      </div>
    </div>
  )
}
