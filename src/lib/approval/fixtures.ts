/**
 * Fixture ApplicationSnapshot — the shape the approval layer expects the
 * Application layer (Adita) to hand over.
 *
 * This is a TEST DOUBLE, not an Application implementation. When Adita's
 * Application module ships, delete these builders and pass their real
 * snapshot into `openApprovalCase()`; nothing else in the approval layer
 * should need to change.
 */

import { LOKSCORE_WEIGHTS } from '../config'
import type { LokScoreBreakdown } from '../lokScore'
import { expectedQuorumFromTotal } from './quorum'
import type { ApplicationSnapshot } from './contracts'

/**
 * Builds a LokScore-shaped snapshot value whose quorum fields agree with the
 * locked 80/60 table. Mirrors what `computeLokScore` produces; it does not
 * reimplement any component weighting.
 */
export function fixtureLokScore(
  total: number,
  overrides: Partial<LokScoreBreakdown> = {},
): LokScoreBreakdown {
  const quorum = expectedQuorumFromTotal(total)
  const grade: LokScoreBreakdown['grade'] =
    total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : 'D'
  return {
    demand: 70,
    competitionGap: 70,
    weatherFit: 70,
    financialFit: 29,
    eligibility: 100,
    total,
    grade,
    quorumRequired: quorum.quorumRequired,
    quorumPool: quorum.quorumPool,
    mentorRequired: quorum.mentorRequired,
    rationale: [],
    rationaleKn: [],
    weights: LOKSCORE_WEIGHTS,
    ...overrides,
  }
}

export interface FixtureSnapshotOptions {
  applicationId?: string
  applicantRef?: string
  villageId?: string
  schemeId?: string
  projectCost?: number
  loanAmount?: number
  frozenAt?: number
  lokScore?: LokScoreBreakdown
}

/** A frozen snapshot in the shape Adita is expected to provide. */
export function fixtureApplicationSnapshot(
  total = 69,
  options: FixtureSnapshotOptions = {},
): ApplicationSnapshot {
  return {
    applicationId: options.applicationId ?? 'APP-2026-000123',
    applicantRef: options.applicantRef ?? 'Lakshmi S.',
    villageId: options.villageId ?? 'dinka-mandya',
    schemeId: options.schemeId ?? 'term_loan',
    projectCost: options.projectCost ?? 1_000_000,
    loanAmount: options.loanAmount ?? 900_000,
    lokScore: options.lokScore ?? fixtureLokScore(total),
    frozenAt: options.frozenAt ?? 1_700_000_000_000,
  }
}
