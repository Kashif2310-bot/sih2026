import { createContext } from 'react'
import type { AuditEvent, DisbursementAuthorization, ReviewerAllocation, ApplicationSnapshot, AuthorizedReviewer, QuorumPolicy } from '../lib/approval/contracts'
import type { SchemePlan } from '../lib/finance'
import type {
  EntrepreneurProfile,
  LokScoreBreakdown,
  MandiSignal,
  WeatherSignal,
} from '../lib/lokScore'
import type { Attestation, SignatureRecord, Verifier } from '../lib/multisig'
import type { ResolvedLocation } from '../lib/resolveLocation'
import type { WorkingCapitalPlan } from '../lib/workingCapital'

export interface AppState {
  profile: EntrepreneurProfile | null
  location: ResolvedLocation | null
  weather: WeatherSignal | null
  week: Array<{ date: string; max: number; min: number; rain: number }>
  mandi: MandiSignal | null
  plan: SchemePlan | null
  workingCapital: WorkingCapitalPlan | null
  score: LokScoreBreakdown | null
  loading: boolean
  error: string | null
  errorKn: string | null
  attestation: Attestation | null
  signatures: SignatureRecord[]
  verifiers: Verifier[]
  escrowReleased: boolean
  applicationSnapshot: ApplicationSnapshot | null
  approvalPolicy: QuorumPolicy | null
  allocation: ReviewerAllocation | null
  authorizedPool: AuthorizedReviewer[]
  auditLog: AuditEvent[]
  disbursementAuth: DisbursementAuthorization | null
  approvalReady: boolean
  setProfileAndScan: (p: EntrepreneurProfile) => Promise<boolean>
  signAs: (verifierId: string) => Promise<void>
  releaseEscrow: () => void
  reset: () => void
}

export const AppCtx = createContext<AppState | null>(null)
