import { createContext } from 'react'
import type { ApprovalCaseView } from '../lib/approval/views'
import type { SchemePlan } from '../lib/finance'
import type {
  EntrepreneurProfile,
  LokScoreBreakdown,
  MandiSignal,
  WeatherSignal,
} from '../lib/lokScore'
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
  /** Read-only approval projection — no multisig internals reach the UI. */
  approvalCase: ApprovalCaseView | null
  escrowReleased: boolean
  setProfileAndScan: (p: EntrepreneurProfile) => Promise<boolean>
  signAs: (reviewerId: string) => Promise<void>
  releaseEscrow: () => void
  reset: () => void
}

export const AppCtx = createContext<AppState | null>(null)
