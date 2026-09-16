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
import type { ApprovalSignature, AuditEvent } from '../lib/approval/contracts'

// ethers (via multisig.ts / approval hashing) is real ECDSA crypto and not
// cheap to parse/execute, so it's dynamically imported on first scan rather
// than bundled into the eagerly-loaded app shell.
let cryptoModulePromise: Promise<{
  multisig: typeof import('../lib/multisig')
  contracts: typeof import('../lib/approval/contracts')
  quorum: typeof import('../lib/approval/quorum')
  allocate: typeof import('../lib/approval/allocate')
  audit: typeof import('../lib/approval/audit')
  disbursement: typeof import('../lib/approval/disbursement')
}> | null = null

function loadCrypto() {
  if (!cryptoModulePromise) {
    cryptoModulePromise = Promise.all([
      import('../lib/multisig'),
      import('../lib/approval/contracts'),
      import('../lib/approval/quorum'),
      import('../lib/approval/allocate'),
      import('../lib/approval/audit'),
      import('../lib/approval/disbursement'),
    ]).then(([multisig, contracts, quorum, allocate, audit, disbursement]) => ({
      multisig,
      contracts,
      quorum,
      allocate,
      audit,
      disbursement,
    }))
  }
  return cryptoModulePromise
}

function toApprovalSigs(records: AppState['signatures']): ApprovalSignature[] {
  return records.map((s) => ({
    reviewerId: s.verifierId,
    address: s.address,
    signature: s.signature,
    signedAt: s.signedAt,
  }))
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
  const [applicationSnapshot, setApplicationSnapshot] = useState<AppState['applicationSnapshot']>(null)
  const [approvalPolicy, setApprovalPolicy] = useState<AppState['approvalPolicy']>(null)
  const [allocation, setAllocation] = useState<AppState['allocation']>(null)
  const [authorizedPool, setAuthorizedPool] = useState<AppState['authorizedPool']>([])
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([])
  const [disbursementAuth, setDisbursementAuth] = useState<AppState['disbursementAuth']>(null)
  const [approvalReady, setApprovalReady] = useState(false)
  const cryptoRef = useRef<Awaited<ReturnType<typeof loadCrypto>> | null>(null)

  const setProfileAndScan = useCallback(async (p: EntrepreneurProfile) => {
    setLoading(true)
    setError(null)
    setErrorKn(null)
    setSignatures([])
    setEscrowReleased(false)
    setDisbursementAuth(null)
    setApprovalReady(false)
    setAuditLog([])
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

      const crypto = await loadCrypto()
      cryptoRef.current = crypto
      const policy = crypto.quorum.freezeQuorumPolicy(lok)
      const frozenAt = Date.now()
      const applicationId = crypto.contracts.provisionalApplicationId({
        applicantRef: p.name,
        villageId: resolved.id,
        schemeId: scheme.schemeId,
        frozenAt,
      })
      const snapshot = {
        applicationId,
        applicantRef: p.name,
        villageId: resolved.id,
        schemeId: scheme.schemeId,
        projectCost: scheme.projectCost,
        loanAmount: scheme.loanAmount,
        lokScore: lok,
        frozenAt,
      }
      const snapshotDigest = crypto.contracts.hashApplicationSnapshot(snapshot)
      const verifiersPool = crypto.multisig.createVerifierPool()
      const pool = crypto.allocate.demoAuthorizedPool(verifiersPool)
      const nextAllocation = crypto.allocate.allocateReviewers({
        snapshot,
        snapshotDigest,
        policy,
        pool,
        allocatedAt: frozenAt,
      })
      const att = crypto.multisig.buildAttestationFromSnapshot(snapshot)
      let log = crypto.audit.appendAuditEvent([], {
        applicationId,
        eventType: 'application_opened',
        timestamp: frozenAt,
        dataRef: snapshotDigest,
      })
      log = crypto.audit.appendAuditEvent(log, {
        applicationId,
        eventType: 'reviewer_allocation_created',
        timestamp: frozenAt,
        dataRef: nextAllocation.allocationDigest,
      })

      setProfile(p)
      setLocation(resolved)
      setWeather(w)
      setWeek(wk)
      setMandi(m)
      setPlan(scheme)
      setWorkingCapital(wc)
      setScore(lok)
      setVerifiers(verifiersPool)
      setAttestation(att)
      setApplicationSnapshot(snapshot)
      setApprovalPolicy(policy)
      setAllocation(nextAllocation)
      setAuthorizedPool(pool)
      setAuditLog(log)
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
      if (!attestation || !applicationSnapshot || !approvalPolicy || !allocation || !cryptoRef.current) return
      const crypto = cryptoRef.current
      const verifier = verifiers.find((v) => v.id === verifierId)
      if (!verifier) return
      if (signatures.some((s) => s.verifierId === verifierId)) return

      const requested = crypto.audit.appendAuditEvent(auditLog, {
        applicationId: applicationSnapshot.applicationId,
        eventType: 'signature_requested',
        actorRef: verifierId,
        dataRef: allocation.allocationDigest,
      })

      if (!allocation.allocatedReviewerIds.includes(verifierId)) {
        setAuditLog(
          crypto.audit.appendAuditEvent(requested, {
            applicationId: applicationSnapshot.applicationId,
            eventType: 'signature_rejected',
            actorRef: verifierId,
            dataRef: 'outside_allocated_set',
          }),
        )
        throw new Error('Reviewer is not in the allocated set')
      }

      const record = await crypto.multisig.signAttestation(verifier, attestation)
      const addressOk = crypto.multisig.verifySignatureForReviewer(
        attestation,
        record,
        verifier.wallet.address,
      )
      if (!addressOk) {
        setAuditLog(
          crypto.audit.appendAuditEvent(requested, {
            applicationId: applicationSnapshot.applicationId,
            eventType: 'signature_rejected',
            actorRef: verifierId,
            dataRef: 'invalid_signature',
          }),
        )
        throw new Error('Signature invalid')
      }

      const nextSigs = [...signatures, record]
      const evaluation = crypto.quorum.evaluateApproval({
        snapshot: applicationSnapshot,
        snapshotDigest: attestation.reportHash,
        policy: approvalPolicy,
        allocation,
        pool: authorizedPool,
        attestation,
        signatures: toApprovalSigs(nextSigs),
      })
      let log = crypto.audit.appendAuditEvent(requested, {
        applicationId: applicationSnapshot.applicationId,
        eventType: 'signature_collected',
        actorRef: verifierId,
        dataRef: record.signature.slice(0, 18),
      })
      log = crypto.audit.appendAuditEvent(log, {
        applicationId: applicationSnapshot.applicationId,
        eventType: 'quorum_evaluated',
        dataRef: `${evaluation.uniqueValidCount}/${approvalPolicy.quorumRequired}`,
      })
      log = crypto.audit.appendAuditEvent(log, {
        applicationId: applicationSnapshot.applicationId,
        eventType: 'mentor_condition_evaluated',
        dataRef: evaluation.mentorSatisfied ? 'mentor_ok' : 'mentor_pending',
      })
      if (evaluation.ok) {
        log = crypto.audit.appendAuditEvent(log, {
          applicationId: applicationSnapshot.applicationId,
          eventType: 'quorum_reached',
          dataRef: attestation.reportHash,
        })
      }
      setSignatures(nextSigs)
      setAuditLog(log)
      setApprovalReady(evaluation.ok)
    },
    [
      attestation,
      applicationSnapshot,
      approvalPolicy,
      allocation,
      authorizedPool,
      auditLog,
      signatures,
      verifiers,
    ],
  )

  const releaseEscrow = useCallback(() => {
    if (
      !applicationSnapshot ||
      !approvalPolicy ||
      !allocation ||
      !attestation ||
      !cryptoRef.current
    ) {
      return
    }
    const crypto = cryptoRef.current
    const result = crypto.disbursement.authorizeDisbursement({
      snapshot: applicationSnapshot,
      snapshotDigest: attestation.reportHash,
      policy: approvalPolicy,
      allocation,
      pool: authorizedPool,
      attestation,
      signatures: toApprovalSigs(signatures),
      auditLog,
    })
    if (!result.ok) {
      setAuditLog(
        crypto.audit.appendAuditEvent(auditLog, {
          applicationId: applicationSnapshot.applicationId,
          eventType: 'disbursement_blocked',
          dataRef: result.reasons[0],
        }),
      )
      return
    }
    setDisbursementAuth(result.authorization)
    setEscrowReleased(true)
    setAuditLog(
      crypto.audit.appendAuditEvent(auditLog, {
        applicationId: applicationSnapshot.applicationId,
        eventType: 'disbursement_authorized',
        dataRef: result.authorization.authorizationDigest,
      }),
    )
  }, [
    applicationSnapshot,
    approvalPolicy,
    allocation,
    attestation,
    authorizedPool,
    signatures,
    auditLog,
  ])

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
    setApplicationSnapshot(null)
    setApprovalPolicy(null)
    setAllocation(null)
    setAuthorizedPool([])
    setAuditLog([])
    setDisbursementAuth(null)
    setApprovalReady(false)
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
    applicationSnapshot,
    approvalPolicy,
    allocation,
    authorizedPool,
    auditLog,
    disbursementAuth,
    approvalReady,
    setProfileAndScan,
    signAs,
    releaseEscrow,
    reset,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
