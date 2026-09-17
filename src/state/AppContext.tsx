import { useCallback, useRef, useState, type ReactNode } from 'react'
import { buildSchemePlan } from '../lib/finance'
import { computeLokScore, type EntrepreneurProfile, type WeatherSignal } from '../lib/lokScore'
import { fetchMandiSignal } from '../lib/mandi'
import { fetchWeather, fetchWeekTemps, unavailableWeather } from '../lib/weather'
import { resolveCuratedVillage, resolveLiveLocation, type ResolvedLocation } from '../lib/resolveLocation'
import { buildWorkingCapital, type WorkingCapitalPlan } from '../lib/workingCapital'
import { AppCtx, type AppState } from './app-state'
import { REACH_KM } from '../lib/config'

// The approval layer pulls in ethers (real ECDSA) and is not cheap to
// parse/execute, so it is dynamically imported on first scan rather than
// bundled into the eagerly-loaded app shell. The UI only ever touches the
// approval *service* — never multisig internals.
let approvalModulePromise: Promise<{
  service: typeof import('../lib/approval/service')
  contracts: typeof import('../lib/approval/contracts')
}> | null = null

function loadApproval() {
  if (!approvalModulePromise) {
    approvalModulePromise = Promise.all([
      import('../lib/approval/service'),
      import('../lib/approval/contracts'),
    ]).then(([service, contracts]) => ({ service, contracts }))
  }
  return approvalModulePromise
}

type ApprovalService = ReturnType<
  Awaited<ReturnType<typeof loadApproval>>['service']['createApprovalService']
>

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
  const [approvalCase, setApprovalCase] = useState<AppState['approvalCase']>(null)
  const [escrowReleased, setEscrowReleased] = useState(false)
  const serviceRef = useRef<ApprovalService | null>(null)
  const applicationIdRef = useRef<string | null>(null)

  const setProfileAndScan = useCallback(async (p: EntrepreneurProfile) => {
    setLoading(true)
    setError(null)
    setErrorKn(null)
    setApprovalCase(null)
    setEscrowReleased(false)
    const radiusKm = p.radiusKm || REACH_KM.default

    try {
      let resolved: ResolvedLocation
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
        w = unavailableWeather()
        wk = []
      } else {
        try {
          ;[w, wk] = await Promise.all([
            fetchWeather(resolved.lat, resolved.lng),
            fetchWeekTemps(resolved.lat, resolved.lng),
          ])
        } catch {
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

      const approval = await loadApproval()
      // A fresh service per scan keeps one demo session isolated from the next.
      const svc = approval.service.createApprovalService()
      serviceRef.current = svc

      // Adita owns Application/applicationId. Until that layer ships, the
      // session mints a provisional id; the snapshot shape below is exactly
      // what the approval boundary expects to receive from them.
      const frozenAt = Date.now()
      const applicationId = approval.contracts.provisionalApplicationId({
        applicantRef: p.name,
        villageId: resolved.id,
        schemeId: scheme.schemeId,
        frozenAt,
      })
      const view = svc.openApprovalCase({
        applicationId,
        applicantRef: p.name,
        villageId: resolved.id,
        schemeId: scheme.schemeId,
        projectCost: scheme.projectCost,
        loanAmount: scheme.loanAmount,
        lokScore: lok,
        frozenAt,
      })
      applicationIdRef.current = applicationId

      setProfile(p)
      setLocation(resolved)
      setWeather(w)
      setWeek(wk)
      setMandi(m)
      setPlan(scheme)
      setWorkingCapital(wc)
      setScore(lok)
      setApprovalCase(view)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed')
      setErrorKn('ಸ್ಕ್ಯಾನ್ ವಿಫಲವಾಗಿದೆ')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const signAs = useCallback(async (reviewerId: string) => {
    const svc = serviceRef.current
    const applicationId = applicationIdRef.current
    if (!svc || !applicationId) return
    setApprovalCase(await svc.submitSignature(applicationId, reviewerId))
  }, [])

  const releaseEscrow = useCallback(() => {
    const svc = serviceRef.current
    const applicationId = applicationIdRef.current
    if (!svc || !applicationId) return
    try {
      svc.authorizeDisbursement(applicationId)
      setEscrowReleased(true)
    } finally {
      setApprovalCase(svc.getApprovalCase(applicationId))
    }
  }, [])

  const reset = useCallback(() => {
    setProfile(null)
    setLocation(null)
    setWeather(null)
    setWeek([])
    setMandi(null)
    setPlan(null)
    setWorkingCapital(null)
    setScore(null)
    setApprovalCase(null)
    setEscrowReleased(false)
    setError(null)
    setErrorKn(null)
    serviceRef.current = null
    applicationIdRef.current = null
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
    approvalCase,
    escrowReleased,
    setProfileAndScan,
    signAs,
    releaseEscrow,
    reset,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
