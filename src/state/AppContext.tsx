import { useCallback, useRef, useState, type ReactNode } from 'react'
import { buildSchemePlan } from '../lib/finance'
import { computeLokScore, type EntrepreneurProfile, type WeatherSignal } from '../lib/lokScore'
import { fetchMandiSignal } from '../lib/mandi'
import { fetchWeather, fetchWeekTemps, unavailableWeather } from '../lib/weather'
import type { Verifier } from '../lib/multisig'
import { resolveCuratedVillage, resolveLiveLocation, type ResolvedLocation } from '../lib/resolveLocation'
import { buildWorkingCapital, type WorkingCapitalPlan } from '../lib/workingCapital'
import { AppCtx, type AppState } from './app-state'
import { REACH_KM } from '../lib/config'

// ethers (via multisig.ts) is real ECDSA crypto and not cheap to parse/execute,
// so it's dynamically imported on first scan rather than bundled into the
// eagerly-loaded app shell (landing page never touches signatures at all).
// Cached so repeated scans don't re-trigger the network request.
let multisigModulePromise: Promise<typeof import('../lib/multisig')> | null = null
function loadMultisig() {
  if (!multisigModulePromise) multisigModulePromise = import('../lib/multisig')
  return multisigModulePromise
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<EntrepreneurProfile | null>(null)
  const [location, setLocation] = useState<ResolvedLocation | null>(null)
  const [weather, setWeather] = useState<WeatherSignal | null>(null)
  const [week, setWeek] = useState<AppState['week']>([])
  const [mandi, setMandi] = useState<AppState['mandi']>(null)
  const [plan, setPlan] = useState<AppState['plan']>(null)
  const [workingCapital, setWorkingCapital] = useState<WorkingCapitalPlan | null>(null)
  const [score, setScore] = useState<AppState['score']>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKn, setErrorKn] = useState<string | null>(null)
  const [attestation, setAttestation] = useState<AppState['attestation']>(null)
  const [signatures, setSignatures] = useState<AppState['signatures']>([])
  const [escrowReleased, setEscrowReleased] = useState(false)
  const [verifiers, setVerifiers] = useState<Verifier[]>([])
  const multisigRef = useRef<Awaited<ReturnType<typeof loadMultisig>> | null>(null)

  const setProfileAndScan = useCallback(async (p: EntrepreneurProfile) => {
    setLoading(true)
    setError(null)
    setErrorKn(null)
    setSignatures([])
    setEscrowReleased(false)
    const radiusKm = p.radiusKm || REACH_KM.default

    try {
      let resolved: ResolvedLocation
      // Demo Mode is a presenter safety switch: even if locationMode somehow
      // ended up 'live' (shouldn't happen — the UI locks it to curated),
      // never attempt a live call once it's on. Zero network calls, seeded
      // villages only.
      if (p.locationMode === 'live' && !p.demoMode) {
        const live = await resolveLiveLocation({
          query: p.liveQuery,
          lat: p.liveLat,
          lng: p.liveLng,
          category: p.category,
          radiusKm,
        })
        if (!live.ok) {
          setError(live.error)
          setErrorKn(live.errorKn)
          return false
        }
        resolved = live.location
      } else {
        resolved = await resolveCuratedVillage(p.villageId, p.category, radiusKm, p.demoMode)
      }

      const scheme = buildSchemePlan(p.availableMargin)
      const wc = buildWorkingCapital({
        category: p.category,
        projectCostRupees: scheme.projectCost,
        monthlyOpexRupees: scheme.opsCostMonthly,
      })

      let w: WeatherSignal
      let wk: AppState['week'] = []
      if (p.demoMode) {
        // Demo Mode: don't even attempt the call.
        w = unavailableWeather()
        wk = []
      } else {
        try {
          ;[w, wk] = await Promise.all([
            fetchWeather(resolved.lat, resolved.lng),
            fetchWeekTemps(resolved.lat, resolved.lng),
          ])
        } catch {
          // Covers both a real failure and the 2.5s abort timeout inside
          // fetchWeather/fetchWeekTemps — either way, fail fast to the
          // honest "unavailable" state rather than hanging.
          w = unavailableWeather()
          wk = []
        }
      }

      const m = await fetchMandiSignal(resolved, p.category)
      const lok = computeLokScore({
        profile: p,
        location: resolved,
        weather: w,
        mandi: m,
        plan: scheme,
      })

      const multisig = await loadMultisig()
      multisigRef.current = multisig
      const pool = multisig.createVerifierPool()
      const att = multisig.buildAttestation({
        entrepreneurName: p.name,
        villageId: resolved.id,
        lokScore: lok.total,
        schemeId: scheme.schemeId,
        projectCost: scheme.projectCost,
        loanAmount: scheme.loanAmount,
        quorumRequired: lok.quorumRequired,
        quorumPool: lok.quorumPool,
      })

      setProfile(p)
      setLocation(resolved)
      setWeather(w)
      setWeek(wk)
      setMandi(m)
      setPlan(scheme)
      setWorkingCapital(wc)
      setScore(lok)
      setVerifiers(pool)
      setAttestation(att)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setErrorKn('ಸ್ಕ್ಯಾನ್ ವಿಫಲವಾಗಿದೆ')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const signAs = useCallback(
    async (verifierId: string) => {
      if (!attestation || !score || !multisigRef.current) return
      const { signAttestation, verifySignature } = multisigRef.current
      const verifier = verifiers.find((v) => v.id === verifierId)
      if (!verifier) return
      if (signatures.some((s) => s.verifierId === verifierId)) return
      const active = verifiers.slice(0, score.quorumPool)
      if (!active.some((v) => v.id === verifierId)) return
      const record = await signAttestation(verifier, attestation)
      if (!verifySignature(attestation, record)) throw new Error('Signature invalid')
      setSignatures((prev) => [...prev, record])
    },
    [attestation, score, signatures, verifiers],
  )

  const releaseEscrow = useCallback(() => {
    if (!score || !multisigRef.current || !multisigRef.current.quorumMet(score, signatures)) return
    setEscrowReleased(true)
  }, [score, signatures])

  const reset = useCallback(() => {
    setProfile(null)
    setLocation(null)
    setWeather(null)
    setWeek([])
    setMandi(null)
    setPlan(null)
    setWorkingCapital(null)
    setScore(null)
    setAttestation(null)
    setSignatures([])
    setVerifiers([])
    setEscrowReleased(false)
    setError(null)
    setErrorKn(null)
  }, [])

  const value: AppState = {
    profile,
    location,
    weather,
    week,
    mandi,
    plan,
    workingCapital,
    score,
    loading,
    error,
    errorKn,
    attestation,
    signatures,
    verifiers,
    escrowReleased,
    setProfileAndScan,
    signAs,
    releaseEscrow,
    reset,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
